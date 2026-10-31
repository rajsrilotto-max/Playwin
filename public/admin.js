import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getDatabase, ref, onValue, get, set, push } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app);
const $=s=>document.querySelector(s), games=["2d","3d","titliGhoda"];
const labels={2d:"2D",3d:"3D",titliGhoda:"Titli Ghoda"};
const symbol={Titli:"🦋 Titli",Ghoda:"🐎 Ghoda"};
let user=null;
$("#login").onclick=async()=>{try{await signInWithEmailAndPassword(auth,$("#email").value,$("#password").value);$("#login-msg").textContent="";}catch(e){$("#login-msg").textContent=e.message;}};
$("#logout").onclick=()=>signOut(auth);
onAuthStateChanged(auth,async u=>{user=u;$("#login-card").hidden=!!u;$("#dashboard").hidden=!u;if(u){const token=await u.getIdTokenResult(true);if(token.claims.admin!==true){await signOut(auth);$("#login-msg").textContent="This account is not an authorized admin.";return;}bindDashboard();}});
function nextTime(minutes){const d=new Date(),m=d.getMinutes(),next=(Math.floor(m/minutes)+1)*minutes;d.setSeconds(0,0);d.setMinutes(next);return d;}
function tick(){for(const [g,m] of [["2d",15],["3d",15],["titliGhoda",5]]){const d=nextTime(m),left=Math.max(0,d-Date.now()),el=$("#next-"+(g==="titliGhoda"?"tg":g));el.textContent=`${String(Math.floor(left/60000)).padStart(2,"0")}:${String(Math.floor(left/1000)%60).padStart(2,"0")}`;$("#time-"+(g==="titliGhoda"?"tg":g)).textContent=d.toLocaleTimeString();}}
setInterval(tick,1000);tick();
function bindDashboard(){
 onValue(ref(db,"settings/autoPublish"),s=>$("#auto-publish").checked=s.val()!==false);
 $("#auto-publish").onchange=()=>set(ref(db,"settings/autoPublish"),$("#auto-publish").checked);
 onValue(ref(db,"current"),s=>{const d=s.val()||{};$("#current-results").innerHTML=games.map(g=>`<article class="result-card"><h4>${labels[g]} · AUTO / MANUAL</h4><div class="result-value">${d[g]?.value??"—"}</div><p class="muted">${d[g]?.drawAt?new Date(d[g].drawAt).toLocaleString():"Not published"}</p></article>`).join("");});
 onValue(ref(db,"history"),s=>{let rows=[];s.forEach(c=>rows.push(c.val()));rows.sort((a,b)=>b.publishedAt-a.publishedAt);$("#admin-history").innerHTML=`<div class="table-wrap"><table><thead><tr><th>Game</th><th>Result</th><th>Draw time</th><th>Status</th></tr></thead><tbody>${rows.slice(0,30).map(r=>`<tr><td>${labels[r.game]}</td><td>${r.value}</td><td>${new Date(r.drawAt).toLocaleString()}</td><td class="status">${r.locked?"Locked":"Published"}</td></tr>`).join("")}</tbody></table></div>`;});
}
document.querySelectorAll("[data-game]").forEach(btn=>btn.onclick=async()=>{
 const game=btn.dataset.game;let value=game==="2d"?$("#manual-2d").value:game==="3d"?$("#manual-3d").value:$("#manual-tg").value;
 if(game==="2d"&&!/^\d{1,2}$/.test(value)){ $("#override-msg").textContent="Enter a number from 0 to 99.";return;}
 if(game==="3d"&&!/^\d{1,3}$/.test(value)){ $("#override-msg").textContent="Enter a number from 0 to 999.";return;}
 if(game==="titliGhoda"&&!["Titli","Ghoda"].includes(value)){ $("#override-msg").textContent="Choose Titli or Ghoda.";return;}
 const minutes=game==="titliGhoda"?5:15,drawAt=nextTime(minutes).getTime();
 await set(ref(db,`manualNext/${game}`),{value:game==="titliGhoda"?value:Number(value),drawAt,createdBy:user.uid,createdAt:Date.now()});
 $("#override-msg").textContent=`${labels[game]} manual result saved for next draw.`;
});