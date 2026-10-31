const { initializeApp, cert } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || "{}");
const databaseURL = process.env.FIREBASE_DATABASE_URL;
if (!serviceAccount.project_id || !databaseURL) {
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT or FIREBASE_DATABASE_URL GitHub secret.");
}
initializeApp({ credential: cert(serviceAccount), databaseURL });
const db = getDatabase();

const GAMES = [{ key: "2d", minutes: 15 }, { key: "3d", minutes: 15 }, { key: "titliGhoda", minutes: 5 }];
const slotStart = (now, minutes) => Math.floor(now / (minutes * 60_000)) * minutes * 60_000;
const randomResult = game => game === "2d" ? Math.floor(Math.random() * 100)
  : game === "3d" ? Math.floor(Math.random() * 1000)
  : (Math.random() < 0.5 ? "Titli" : "Ghoda");

async function main() {
  const now = Date.now();
  const settings = (await db.ref("settings").get()).val() || {};
  if (settings.autoPublish === false) {
    console.log("Auto publish is paused in admin settings.");
    return;
  }

  for (const game of GAMES) {
    const slot = slotStart(now, game.minutes);
    const key = `${game.key}_${slot}`;
    const processedRef = db.ref(`processed/${key}`);
    const processed = await processedRef.get();
    if (processed.exists()) continue;

    const manualRef = db.ref(`manualNext/${game.key}`);
    const manualSnap = await manualRef.get();
    const manual = manualSnap.val();
    const useManual = !!manual && Number(manual.drawAt) === slot;
    const value = useManual ? manual.value : randomResult(game.key);
    const record = {
      game: game.key,
      value,
      drawAt: slot,
      publishedAt: now,
      source: useManual ? "admin-override" : "random",
      locked: true
    };

    // A transaction on the processed marker prevents duplicate publication
    // if two scheduled workflow runs overlap.
    const claim = await processedRef.transaction(current => current ? undefined : true);
    if (!claim.committed) continue;

    try {
      const updates = {};
      updates[`current/${game.key}`] = record;
      updates[`history/${key}`] = record;
      await db.ref().update(updates);
      if (useManual) await manualRef.remove();
      console.log(`Published ${game.key} for ${new Date(slot).toISOString()} (${record.source})`);
    } catch (error) {
      await processedRef.remove();
      throw error;
    }
  }
}
main().then(() => process.exit(0)).catch(error => {
  console.error(error);
  process.exit(1);
});
