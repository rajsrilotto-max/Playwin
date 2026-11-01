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
async function main() {
  const now = Date.now();
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
  console.log(JSON.stringify({ checkedAt: now, published, skipped }, null, 2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
