const admin = require("firebase-admin");
const crypto = require("crypto");

const DATABASE_URL = process.env.FIREBASE_DATABASE_URL;
const SERVICE_ACCOUNT_BASE64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
if (!DATABASE_URL || !SERVICE_ACCOUNT_BASE64) throw new Error("Missing Firebase GitHub Actions secrets.");

const serviceAccount = JSON.parse(Buffer.from(SERVICE_ACCOUNT_BASE64, "base64").toString("utf8"));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount), databaseURL: DATABASE_URL });
const db = admin.database();
const ROOT = "playwinV2";
const DEFAULTS = { startTime:"09:00", endTime:"22:00", interval2D:15, interval3D:15, intervalTitli:5 };
const TITLI = [["🐘","Elephant"],["🍎","Fruits"],["☂️","Umbrella"],["☀️","Sun"],["👧","Girl"],["🐄","Cow"],["🐘","Elephant"],["🦁","Lion"],["🐅","Tiger"],["🍎","Apple"],["🍌","Banana"],["🥭","Mango"]];
const rand = n => crypto.randomInt(0,n);
const make2D = () => [...Array.from({length:10},(_,i)=>10+i),...Array.from({length:10},(_,i)=>30+i),...Array.from({length:10},(_,i)=>50+i)].map(p=>`${p}${String(rand(100)).padStart(2,"0")}`);
const make3D = () => ({A:String(rand(1000)).padStart(3,"0"),B:String(rand(1000)).padStart(3,"0"),C:String(rand(1000)).padStart(3,"0")});
const makeTitli = () => { const x=TITLI[rand(TITLI.length)]; return {emoji:x[0],name:x[1]}; };
function istDateParts(d){const a=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);return Object.fromEntries(a.map(x=>[x.type,x.value]));}
function epoch(y,m,d,h,min){return Date.UTC(y,m-1,d,h,min)-330*60000;}
function slots(day,start,end,interval){
 const [sh,sm]=start.split(":").map(Number),[eh,em]=end.split(":").map(Number);
 const first=sh*60+sm,last=eh*60+em;if(!Number.isFinite(first)||!Number.isFinite(last)||first>=last)throw Error("Invalid schedule window");
 const out=[];for(let n=first;n<=last;n+=interval)out.push(epoch(+day.year,+day.month,+day.day,Math.floor(n/60),n%60));return out;
}
async function main(){
 const s=(await db.ref(`${ROOT}/settings`).once("value")).val()||{};
 const cfg={...DEFAULTS,...s},day=istDateParts(new Date());
 const games=[["2D Fourth",Number(cfg.interval2D)||15,make2D],["3D Result",Number(cfg.interval3D)||15,make3D],["Titli Goda",Number(cfg.intervalTitli)||5,makeTitli]];
 const updates={};let created=0,preserved=0;
 for(const [type,interval,make] of games){
  for(const drawAt of slots(day,cfg.startTime,cfg.endTime,interval)){
   const key=type.replace(/[^a-zA-Z0-9]/g,"_")+"_"+drawAt;
   const ref=db.ref(`${ROOT}/futureDraws/${key}`);
   if((await ref.once("value")).exists()){preserved++;continue;}
   updates[`${ROOT}/futureDraws/${key}`]={type,drawAt,result:make(),status:"scheduled",generatedAt:Date.now(),timezone:"Asia/Kolkata",generatorVersion:1};
   created++;
  }
 }
 if(Object.keys(updates).length)await db.ref().update(updates);
 console.log(JSON.stringify({dateIST:`${day.year}-${day.month}-${day.day}`,created,preserved},null,2));
}
main().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1);});
