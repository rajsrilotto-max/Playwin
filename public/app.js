import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, query, orderByChild, limitToLast } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";
const app=initializeApp(firebaseConfig), db=getDatabase(app);
const games=["2d","3d","titliGhoda"];
const labels={2d:"2D Result",3d:"3D Result",titliGhoda:"Titli Ghoda Result"};
const symbols={Titli:"🦋 Titli",Ghoda:"🐎 Ghoda"};
const live=document.querySelector("#live-results"), history=document.querySelector("#history-list");
function showValue(game,value){return game==="titliGhoda"?(symbols[value]||value):String(value).padStart(game==="2d"?2:3,"0")}
onValue(ref(db,"current"),snap=>{
 const data=snap.val()||{};
 live.innerHTML=games.map(g=>`<article class="result-card"><h4>${labels[g]}</h4><div class="result-value">${data[g]?.value!=null?showValue(g,data[g].value):"—"}</div><p class="muted">${data[g]?.drawAt?new Date(data[g].drawAt).toLocaleString():"No result published yet"}</p></article>`).join("");
});
onValue(query(ref(db,"history"),orderByChild("publishedAt"),limitToLast(30)),snap=>{
 const rows=[];snap.forEach(c=>rows.push(c.val()));rows.reverse();
 history.innerHTML=rows.length?`<div class="table-wrap"><table><thead><tr><th>Game</th><th>Result</th><th>Draw time</th><th>Status</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${labels[r.game]||r.game}</td><td>${showValue(r.game,r.value)}</td><td>${new Date(r.drawAt).toLocaleString()}</td><td>Published</td></tr>`).join("")}</tbody></table></div>`:"No history yet.";
});