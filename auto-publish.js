const admin = require('firebase-admin');
const crypto = require('crypto');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://playwinlotto-e5808-default-rtdb.asia-southeast1.firebasedatabase.app'
});
const db = admin.database();
const ROOT = 'playwinV2';
const TZ = 'Asia/Kolkata';
const symbols = [
  ['🐘','Elephant'],['🍎','Fruits'],['☂️','Umbrella'],['☀️','Sun'],['👧','Girl'],['🐄','Cow'],
  ['🐘','Elephant'],['🦁','Lion'],['🐅','Tiger'],['🍎','Apple'],['🍌','Banana'],['🥭','Mango']
];
const pad = n => String(n).padStart(2,'0');
function parts(date) {
  const p = new Intl.DateTimeFormat('en-GB',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);
  return Object.fromEntries(p.map(x=>[x.type,x.value]));
}
function istInstant(y,m,d,hh,mm) { return new Date(Date.UTC(+y,+m-1,+d,+hh,+mm)-330*60000); }
function rand(n) { return crypto.randomInt(0,n); }
function makeResult(type) {
  if (type === '2D Fourth') {
    const prefixes = [...Array.from({length:10},(_,i)=>10+i),...Array.from({length:10},(_,i)=>30+i),...Array.from({length:10},(_,i)=>50+i)];
    return prefixes.map(p=>String(p)+pad(rand(100)));
  }
  if (type === '3D Result') return {A:pad3(rand(1000)),B:pad3(rand(1000)),C:pad3(rand(1000))};
  const s = symbols[rand(symbols.length)]; return {emoji:s[0],name:s[1]};
}
function pad3(n){return String(n).padStart(3,'0');}
function typeCode(type){return type==='2D Fourth'?'2D':type==='3D Result'?'3D':'TG';}
function slotKey(type,p){return `${typeCode(type)}_${p.year}${p.month}${p.day}_${p.hour}${p.minute}`;}
function isOnGrid(minutes,start,interval){return minutes>=start && (minutes-start)%interval===0;}
async function main(){
  const now = new Date();
  const settingsSnap = await db.ref(`${ROOT}/settings`).once('value');
  const s = settingsSnap.val() || {};
  const [sh,sm]=(s.startTime||'09:00').split(':').map(Number);
  const [eh,em]=(s.endTime||'22:00').split(':').map(Number);
  const start=sh*60+sm, end=eh*60+em;
  const intervals=[['2D Fourth',Number(s.interval2D)||15],['3D Result',Number(s.interval3D)||15],['Titli Goda',Number(s.intervalTitli)||5]];
  const futureRef=db.ref(`${ROOT}/futureDraws`);
  const futureSnap=await futureRef.once('value');
  const future=futureSnap.val()||{};
  // Prepare the next 24 hours of draws; never overwrite an existing/admin-edited draw.
  for(let day=0;day<=1;day++){
    const today=parts(new Date(now.getTime()+day*86400000));
    for(const [type,interval] of intervals){
      for(let mins=start;mins<=end;mins+=interval){
        const hh=Math.floor(mins/60), mm=mins%60;
        const at=istInstant(today.year,today.month,today.day,hh,mm);
        if(at.getTime()<=now.getTime()) continue;
        const p={...today,hour:pad(hh),minute:pad(mm)};
        const key=slotKey(type,p);
        if(future[key]) continue;
        const result=makeResult(type);
        await futureRef.child(key).transaction(current=>current || {
          type,result,ref:key,drawAt:at.getTime(),drawAtISO:at.toISOString(),status:'scheduled',createdAt:Date.now(),source:'github-actions'
        });
      }
    }
  }
  // Publish due items once; transaction claim prevents overlapping workflow runs.
  const fresh=(await futureRef.once('value')).val()||{};
  for(const [key,item] of Object.entries(fresh)){
    if(!item || item.status!=='scheduled' || !item.drawAt || item.drawAt>Date.now()) continue;
    const claim=await futureRef.child(key).transaction(cur=>cur && cur.status==='scheduled' && cur.drawAt<=Date.now() ? {...cur,status:'publishing',publishingAt:Date.now()} : undefined);
    if(!claim.committed) continue;
    try{
      const record={type:item.type,result:item.result,ref:item.ref||key,time:item.drawAtISO||new Date(item.drawAt).toISOString(),publishedAt:Date.now(),status:'published',source:'github-actions'};
      const updates={};
      updates[`${ROOT}/history/${key}`]=record;
      updates[`${ROOT}/current/${item.type}`]={...record,historyKey:key};
      updates[`${ROOT}/auditLog/${key}`]={action:'AUTO_PUBLISH',type:item.type,historyKey:key,timestamp:Date.now(),source:'github-actions'};
      await db.ref().update(updates);
      await futureRef.child(key).update({status:'published',publishedAt:Date.now()});
      console.log(`Published ${key}`);
    }catch(err){
      await futureRef.child(key).update({status:'scheduled',lastError:String(err).slice(0,500)});
      throw err;
    }
  }
  console.log('Auto-publish cycle completed');
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
