const admin = require("firebase-admin");
const DATABASE_URL = process.env.FIREBASE_DATABASE_URL;
const SERVICE_ACCOUNT_BASE64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!DATABASE_URL || !SERVICE_ACCOUNT_BASE64) throw new Error("Missing Firebase GitHub Actions secrets.");

const serviceAccount = JSON.parse(Buffer.from(SERVICE_ACCOUNT_BASE64, "base64").toString("utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), databaseURL: DATABASE_URL });
const db = admin.database();
const ROOT = "playwinV2";

function safeKey(type, drawAt) {
  return String(type).replace(/[^a-zA-Z0-9]/g, "_") + "_" + Number(drawAt);
}
function fourDayCutoff(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(now);
  const get = (key) => Number(parts.find((part) => part.type === key).value);
  // Midnight IST three calendar days before today = four calendar dates retained.
  return Date.UTC(get("year"), get("month") - 1, get("day") - 3, -5, -30);
}

async function main() {
  const now = Date.now();
  const cutoff = fourDayCutoff(new Date(now));
  const snap = await db.ref(`${ROOT}/futureDraws`).once("value");
  const future = snap.val() || {};
  const updates = {};
  let published = 0, skipped = 0;

  for (const [futureKey, item] of Object.entries(future)) {
    if (!item || item.status !== "scheduled" || !Number(item.drawAt) || Number(item.drawAt) > now) continue;
    if (!item.type || !item.result) { skipped++; continue; }

    const historyKey = safeKey(item.type, item.drawAt);
    const record = {
      type: item.type,
      result: item.result,
      ref: item.ref || "",
      time: new Date(Number(item.drawAt)).toISOString(),
      drawKey: historyKey,
      publishedAt: now,
      editedAt: item.editedAt || null,
      status: "published",
      source: "scheduled-future-draw"
    };

    // Deterministic history key means retries update the same draw instead of creating duplicates.
    updates[`${ROOT}/history/${historyKey}`] = record;
    updates[`${ROOT}/current/${item.type}`] = { ...record, historyKey };
    updates[`${ROOT}/futureDraws/${futureKey}/status`] = "published";
    updates[`${ROOT}/futureDraws/${futureKey}/publishedAt`] = now;
    updates[`${ROOT}/futureDraws/${futureKey}/historyKey`] = historyKey;
    updates[`${ROOT}/auditLog/${db.ref(`${ROOT}/auditLog`).push().key}`] = {
      action: "SCHEDULED_PUBLISH",
      type: item.type,
      drawKey: historyKey,
      drawAt: Number(item.drawAt),
      timestamp: now,
      source: "github-actions"
    };
    published++;
  }

  if (Object.keys(updates).length) await db.ref().update(updates);

  // Remove only published history/future records older than the 4-day IST window.
  // Scheduled future draws are never removed by this retention task.
  const historyRef = db.ref(`${ROOT}/history`);
  const historySnap = await historyRef.once("value");
  const history = historySnap.val() || {};
  const cleanup = {};
  let deletedHistory = 0;
  for (const [key, record] of Object.entries(history)) {
    if (!record || typeof record !== "object") continue;
    const drawTime = Date.parse(record.time || "") || Number(record.publishedAt || 0);
    if (drawTime && drawTime < cutoff) {
      cleanup[`${ROOT}/history/${key}`] = null;
      deletedHistory++;
    }
  }

  let deletedFuture = 0;
  for (const [key, item] of Object.entries(future)) {
    if (item && item.status === "published" && Number(item.drawAt) && Number(item.drawAt) < cutoff) {
      cleanup[`${ROOT}/futureDraws/${key}`] = null;
      deletedFuture++;
    }
  }

  const demoRef = db.ref(`${ROOT}/demoHistory`);
  const demoSnap = await demoRef.once("value");
  const demoHistory = demoSnap.val() || {};
  let deletedDemo = 0;
  for (const [key, record] of Object.entries(demoHistory)) {
    if (!record || typeof record !== "object") continue;
    const drawTime = Date.parse(record.time || "") || Number(record.publishedAt || 0);
    if (drawTime && drawTime < cutoff) {
      cleanup[`${ROOT}/demoHistory/${key}`] = null;
      deletedDemo++;
    }
  }

  if (Object.keys(cleanup).length) await db.ref().update(cleanup);
  console.log(JSON.stringify({ checkedAt: now, published, skipped, retainedSinceIST: new Date(cutoff).toISOString(), deletedHistory, deletedDemoHistory: deletedDemo, deletedOldPublishedFuture: deletedFuture }, null, 2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
