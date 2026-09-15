(function(){
"use strict";
var KEY="margin.v2", PREV_KEY="margin.v2.prev", APP_VERSION="2.1", ARC=386.4, FULL=515.2;
var HUES=["--jade","--cyan","--amber","--violet","--pink","--lime","--blue","--coral"];

function blank(){
  return {
    v:2, rate:3.35, startDay:25, mode:"period", accent:"jade", theme:"midnight", historyView:"list", lastExport:null, nextId:100,
    cats:[
      {id:"c1",name:"Food",       icon:"fork", cap:0,quick:[500,1000,2000,5000]},
      {id:"c2",name:"Groceries",  icon:"cart", cap:0,quick:[1000,2000,3000,5000]},
      {id:"c3",name:"Dining out", icon:"cup", cap:0,quick:[1500,3000,5000,8000]},
      {id:"c4",name:"Transport",  icon:"car", cap:0,quick:[300,500,1000,2000]},
      {id:"c5",name:"Shopping",   icon:"bag", cap:0,quick:[2000,5000,10000,20000]},
      {id:"c6",name:"Fun",        icon:"spark", cap:0,quick:[1000,2500,5000,10000]},
      {id:"c7",name:"Other",      icon:"dots", cap:0,quick:[500,1000,2000,5000]}
    ],
    debts:[],
    txns:[], pays:[], recs:[], bookmarks:[], accounts:[], recurring:[], recurringDone:{}, defaultAccount:""
  };
}
var S=load();
function load(){
  try{
    var r=localStorage.getItem(KEY); if(!r) return blank();
    var p=JSON.parse(r); if(!p||!Array.isArray(p.cats)||!Array.isArray(p.txns)) return blank();
    var d=blank(); for(var k in d) if(!(k in p)) p[k]=d[k];
    var defaults=["fork","cart","cup","car","bag","spark","dots"];
    p.cats.forEach(function(c,i){ if(!c.icon)c.icon=defaults[i%defaults.length]; });
    if(!Array.isArray(p.bookmarks))p.bookmarks=[];
    if(!Array.isArray(p.accounts))p.accounts=[];
    if(!Array.isArray(p.recurring))p.recurring=[];
    if(!p.recurringDone||typeof p.recurringDone!=="object")p.recurringDone={};
    if(!p.defaultAccount)p.defaultAccount="";
    if(!p.theme)p.theme="midnight"; if(!p.historyView)p.historyView="list";
    return p;
  }catch(e){ return blank(); }
}
function save(){
  try{
    var next=JSON.stringify(S), old=localStorage.getItem(KEY);
    if(old&&old!==next) localStorage.setItem(PREV_KEY,old);
    localStorage.setItem(KEY,next);
  }catch(e){ toast("Storage is blocked, nothing saved"); }
  updateRecoveryState();
}
function uid(){ S.nextId=(S.nextId||100)+1; return "t"+S.nextId; }

function grp(s){ return s.replace(/\B(?=(\d{3})+(?!\d))/g,","); }
function money(c,dec){ var v=Math.abs(Math.round(c));
  return (c<0?"-":"")+"S$"+(dec===false?grp(String(Math.round(v/100))):grp((v/100).toFixed(2))); }
function rmf(c){ return "RM"+grp((Math.abs(c)/100).toFixed(2)); }
function toCents(x){ var n=parseFloat(String(x).replace(/[^0-9.]/g,"")); return (isNaN(n)||n<0)?0:Math.round(n*100); }
function p2(n){ return n<10?"0"+n:""+n; }
function iso(d){ return d.getFullYear()+"-"+p2(d.getMonth()+1)+"-"+p2(d.getDate()); }
function pIso(s){ var a=String(s).split("-"); return new Date(+a[0],+a[1]-1,+a[2]); }
function today(){ var n=new Date(); return new Date(n.getFullYear(),n.getMonth(),n.getDate()); }
function pStart(d){ var k=S.startDay||1;
  return d.getDate()>=k?new Date(d.getFullYear(),d.getMonth(),k):new Date(d.getFullYear(),d.getMonth()-1,k); }
function pShift(s,n){ return new Date(s.getFullYear(),s.getMonth()+n,S.startDay||1); }
var MO=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function pLabel(s){
  if((S.startDay||1)===1){ var F=["January","February","March","April","May","June","July","August","September","October","November","December"];
    return F[s.getMonth()]+(s.getFullYear()!==today().getFullYear()?" "+s.getFullYear():""); }
  var e=new Date(pShift(s,1).getTime()-864e5);
  return s.getDate()+" "+MO[s.getMonth()]+" to "+e.getDate()+" "+MO[e.getMonth()];
}
function inR(t,a,b){ var d=pIso(t.date); return d>=a&&d<b; }
function days(a,b){ return Math.round((b-a)/864e5); }
function dayLab(s){
  var W=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"],d=pIso(s),t=today();
  if(s===iso(t)) return "Today";
  if(s===iso(new Date(t.getFullYear(),t.getMonth(),t.getDate()-1))) return "Yesterday";
  return W[d.getDay()]+" "+d.getDate()+" "+MO[d.getMonth()];
}
function el(t,c,x){ var e=document.createElement(t); if(c)e.className=c; if(x!=null)e.textContent=x; return e; }
function esc(s){ return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c];}); }
function catOf(id){ for(var i=0;i<S.cats.length;i++) if(S.cats[i].id===id) return S.cats[i]; return null; }
function catName(id){ var c=catOf(id); return c?c.name:"Removed envelope"; }
function accountOf(id){ for(var i=0;i<S.accounts.length;i++) if(S.accounts[i].id===id) return S.accounts[i]; return null; }
function accountName(id){ var a=accountOf(id); return a?a.name:"Unassigned"; }
function accountIcon(type){ return type==="credit"?"card":type==="cash"?"cash":"bank"; }
function hueOf(id){ for(var i=0;i<S.cats.length;i++) if(S.cats[i].id===id) return "var("+HUES[i%HUES.length]+")"; return "var(--dim)"; }
function spent(a,b,cid){ var s=0;
  for(var i=0;i<S.txns.length;i++){ var t=S.txns[i]; if(inR(t,a,b)&&(!cid||t.cat===cid)) s+=t.sgd; } return s; }
function capAll(){ var s=0; S.cats.forEach(function(c){ s+=c.cap||0; }); return s; }
function tone(f){ return f>=1?"var(--coral)":f>=0.8?"var(--amber)":"var(--jade)"; }

var ICON_NAMES=["fork","cart","cup","car","bag","spark","home","heart","plane","game","gift","paw","dots"];
var ICON_LABELS={fork:"Food",cart:"Groceries",cup:"Dining",car:"Transport",bag:"Shopping",spark:"Fun",home:"Home",heart:"Health",plane:"Travel",game:"Games",gift:"Gift",paw:"Pets",dots:"Other"};
function iconSvg(name,cls){
  var paths={
    fork:'<path d="M7 3v7M4.5 3v4.5A2.5 2.5 0 0 0 7 10v11M9.5 3v4.5A2.5 2.5 0 0 1 7 10M15 3v8c0 2 1 3 3 3V3v18"/>',
    cart:'<path d="M3 5h2l2 10h10l2-7H6.5"/><circle cx="9" cy="19" r="1.3"/><circle cx="17" cy="19" r="1.3"/>',
    cup:'<path d="M5 7h11v6a5 5 0 0 1-10 0V7Z"/><path d="M16 9h2a2.5 2.5 0 0 1 0 5h-2M7 3c0 1 1 1.5 1 2.5M11 3c0 1 1 1.5 1 2.5"/>',
    car:'<path d="M5 16h14l-1-6-2-3H8l-2 3-1 6Z"/><path d="M4 13h16M7 16v2M17 16v2"/><circle cx="8" cy="13" r="1"/><circle cx="16" cy="13" r="1"/>',
    bag:'<path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/>',
    spark:'<path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z"/><path d="m18 16 .7 2.3L21 19l-2.3.7L18 22l-.7-2.3L15 19l2.3-.7L18 16Z"/>',
    home:'<path d="m4 11 8-7 8 7v9h-6v-6h-4v6H4v-9Z"/>',
    heart:'<path d="M20 8.5C20 14 12 20 12 20S4 14 4 8.5A4.5 4.5 0 0 1 12 5a4.5 4.5 0 0 1 8 3.5Z"/>',
    plane:'<path d="m3 13 18-8-7 15-2-6-9-1Z"/><path d="m12 14 5-5"/>',
    game:'<path d="M7 9h10l3 7a3 3 0 0 1-5 3l-2-2h-2l-2 2a3 3 0 0 1-5-3l3-7Z"/><path d="M8 12v4M6 14h4M16 13h.01M18 15h.01"/>',
    gift:'<path d="M4 10h16v11H4V10ZM3 7h18v4H3V7ZM12 7v14"/><path d="M12 7c-4 0-5-1.5-5-3 0-1 1-2 2.2-2C11 2 12 4.5 12 7Zm0 0c4 0 5-1.5 5-3 0-1-1-2-2.2-2C13 2 12 4.5 12 7Z"/>',
    paw:'<circle cx="8" cy="7" r="2"/><circle cx="16" cy="7" r="2"/><circle cx="5" cy="12" r="1.7"/><circle cx="19" cy="12" r="1.7"/><path d="M8 18c0-3 1.8-5 4-5s4 2 4 5c0 2-1.7 3-4 3s-4-1-4-3Z"/>',
    bank:'<path d="M3 9h18L12 4 3 9Zm2 2h14M6 11v7M10 11v7M14 11v7M18 11v7M3 20h18"/>',
    card:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h4"/>',
    cash:'<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 9h.01M18 15h.01"/>',
    calendar:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
    dots:'<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>'
  };
  return '<svg class="'+(cls||'cat-svg')+'" viewBox="0 0 24 24" aria-hidden="true">'+(paths[name]||paths.dots)+'</svg>';
}
function iconBadge(c){ var b=el("span","cat-icon"); b.style.color=hueOf(c.id); b.innerHTML=iconSvg(c.icon||"dots"); return b; }

var ACCENTS={jade:"var(--jade)",cyan:"var(--cyan)",violet:"var(--violet)",amber:"var(--amber)",pink:"var(--pink)"};
function applyAccent(){
  if(!ACCENTS[S.accent]) S.accent="jade";
  document.documentElement.style.setProperty("--accent",ACCENTS[S.accent]);
  Array.prototype.forEach.call(document.querySelectorAll(".accent-dot"),function(b){
    b.setAttribute("aria-checked",b.dataset.accent===S.accent?"true":"false");
  });
}
function applyTheme(){
  if(S.theme!=="coral")S.theme="midnight";
  document.documentElement.dataset.theme=S.theme;
  Array.prototype.forEach.call(document.querySelectorAll(".theme-choice"),function(b){ b.setAttribute("aria-checked",b.dataset.theme===S.theme?"true":"false"); });
  var meta=document.querySelector('meta[name="theme-color"]'); if(meta)meta.setAttribute("content",S.theme==="coral"?"#F35F52":"#08171F");
}
function updateRecoveryState(){
  var b=document.getElementById("recoverPrev"); if(!b)return;
  try{ b.disabled=!localStorage.getItem(PREV_KEY); }catch(e){ b.disabled=true; }
}

var reduceMotion=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var motionValues={};
function haptic(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms||8); }catch(e){} }
function animateValue(key,target,draw,duration){
  var from=Object.prototype.hasOwnProperty.call(motionValues,key)?motionValues[key]:target;
  motionValues[key]=target;
  if(reduceMotion||from===target){ draw(target); return; }
  var st=performance.now(), dur=duration||340;
  function tick(now){
    var p=Math.min(1,(now-st)/dur), e=1-Math.pow(1-p,3);
    draw(Math.round(from+(target-from)*e));
    if(p<1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
function grip(){
  var g=el("span","drag-handle");
  g.setAttribute("role","button"); g.setAttribute("aria-label","Hold and drag to reorder envelope");
  g.innerHTML='<svg viewBox="0 0 12 18" aria-hidden="true"><circle cx="3" cy="3" r="1.25"/><circle cx="9" cy="3" r="1.25"/><circle cx="3" cy="9" r="1.25"/><circle cx="9" cy="9" r="1.25"/><circle cx="3" cy="15" r="1.25"/><circle cx="9" cy="15" r="1.25"/></svg>';
  return g;
}


/* ── planning: accounts + recurring commitments ── */
function amountSgd(r){ return r.cur==="MYR"?Math.round((r.amount||0)/(S.rate||3.35)):(r.amount||0); }
function clampDate(y,m,d){ var last=new Date(y,m+1,0).getDate(); return new Date(y,m,Math.min(d,last)); }
function advanceRecurring(d,freq,anchorDay){
  if(freq==="weekly") return new Date(d.getFullYear(),d.getMonth(),d.getDate()+7);
  if(freq==="yearly") return clampDate(d.getFullYear()+1,d.getMonth(),anchorDay||d.getDate());
  return clampDate(d.getFullYear(),d.getMonth()+1,anchorDay||d.getDate());
}
function occurrenceKey(r,ds){ return r.id+"@"+ds; }
function occurrencesBetween(r,a,b){
  var out=[]; if(!r||r.active===false||!r.start||!(r.amount>0))return out;
  var d=pIso(r.start), anchor=d.getDate(), guard=0;
  while(d<a&&guard++<600)d=advanceRecurring(d,r.freq||"monthly",anchor);
  while(d<b&&guard++<800){ var ds=iso(d); out.push({rec:r,date:ds,done:!!S.recurringDone[occurrenceKey(r,ds)]}); d=advanceRecurring(d,r.freq||"monthly",anchor); }
  return out;
}
function periodOccurrences(a,b){ var out=[]; S.recurring.forEach(function(r){out=out.concat(occurrencesBetween(r,a,b));}); return out.sort(function(x,y){return x.date.localeCompare(y.date);}); }
function reservedCommitments(a,b){ var occ=periodOccurrences(a,b).filter(function(o){return !o.done&&o.rec.type!=="income"&&o.rec.reserve!==false;}); return {amount:occ.reduce(function(n,o){return n+amountSgd(o.rec);},0),count:occ.length,items:occ}; }
function expectedIncome(a,b){ var occ=periodOccurrences(a,b).filter(function(o){return !o.done&&o.rec.type==="income";}); return {amount:occ.reduce(function(n,o){return n+amountSgd(o.rec);},0),count:occ.length,items:occ}; }
function nextOccurrence(r){ var a=new Date(today().getFullYear(),today().getMonth(),today().getDate()-31), b=new Date(today().getFullYear()+2,today().getMonth(),today().getDate()+1); var all=occurrencesBetween(r,a,b).filter(function(o){return !o.done&&pIso(o.date)>=today();}); return all[0]||null; }
function dateShort(ds){ var d=pIso(ds); return d.getDate()+" "+MO[d.getMonth()]; }
function accountTypeLabel(t){ return t==="credit"?"Credit card":t==="cash"?"Cash":"Bank account"; }

/* week window anchored to period start, with carry-over */
function weekWin(){
  var ps=pStart(today()), pe=pShift(ps,1), n=Math.floor(days(ps,today())/7);
  var ws=new Date(ps.getFullYear(),ps.getMonth(),ps.getDate()+n*7);
  var we=new Date(ws.getFullYear(),ws.getMonth(),ws.getDate()+7); if(we>pe) we=pe;
  return {ps:ps,pe:pe,ws:ws,we:we,n:n};
}
function weekBudget(){
  var w=weekWin(), pd=days(w.ps,w.pe), cap=capAll();
  var perDay=cap/pd;
  var thisWeekDays=days(w.ws,w.we);
  var priorDays=days(w.ps,w.ws);
  var priorBudget=perDay*priorDays, priorSpent=spent(w.ps,w.ws);
  return {w:w, budget:perDay*thisWeekDays+(priorBudget-priorSpent), sp:spent(w.ws,w.we)};
}

var tT; var lastId=null, undoAction=null;
function toast(m,undoable){
  var t=document.getElementById("toast");
  document.getElementById("tMsg").textContent=m;
  if(typeof undoable==="function") undoAction=undoable;
  else if(undoable&&lastId){
    var id=lastId;
    undoAction=function(){ S.txns=S.txns.filter(function(x){return x.id!==id;}); save(); redraw(); toast("Entry removed"); };
  } else undoAction=null;
  document.getElementById("undo").style.display=undoAction?"block":"none";
  t.classList.add("on"); clearTimeout(tT);
  tT=setTimeout(function(){ t.classList.remove("on"); lastId=null; undoAction=null; },6000);
}
document.getElementById("undo").addEventListener("click",function(){
  if(!undoAction) return;
  var fn=undoAction; undoAction=null; lastId=null;
  document.getElementById("toast").classList.remove("on");
  fn();
});

/* ── spend gauge ── */
function drawGauge(){
  var left,cap,sp,dl,lab,ps,pe,pd,elapsed;
  if(S.mode==="week"){
    var wb=weekBudget(); cap=wb.budget; sp=wb.sp; left=cap-sp;
    dl=Math.max(1,days(today(),wb.w.we)); lab="left this week";
    ps=wb.w.ws; pe=wb.w.we;
  } else {
    ps=pStart(today()); pe=pShift(ps,1);
    cap=capAll(); sp=spent(ps,pe); left=cap-sp;
    dl=Math.max(1,days(today(),pe)); lab="left of "+money(cap,false);
  }
  pd=Math.max(1,days(ps,pe));
  elapsed=Math.max(0,Math.min(pd,days(ps,today())+1));
  var safe=document.getElementById("safeToday"), pspent=document.getElementById("periodSpent"), reset=document.getElementById("daysReset");
  var actual=document.getElementById("paceActual"), marker=document.getElementById("paceMarker"), status=document.getElementById("paceStatus"), pct=document.getElementById("pacePercent");
  if(cap<=0){
    document.getElementById("gauge").classList.remove("over");
    document.documentElement.style.setProperty("--sig","var(--jade)");
    document.getElementById("gFill").setAttribute("stroke-dasharray","0 "+FULL);
    document.getElementById("gAmt").innerHTML='<span class="p">S$</span>0';
    motionValues.gAmt=0;
    document.getElementById("gCap").textContent="No budget set yet";
    document.getElementById("gPace").textContent="Open Setup and give each envelope a cap";
    if(safe)safe.textContent="—"; if(pspent)pspent.textContent=money(sp,false); if(reset)reset.textContent=dl+(dl===1?" day":" days");
    if(actual)actual.style.width="0%"; if(marker)marker.style.left="0%"; if(status)status.textContent="Set your envelope caps to start."; if(pct)pct.textContent=""; var cn0=document.getElementById("commitmentNote"); if(cn0)cn0.hidden=true;
    document.getElementById("mWeek").setAttribute("aria-pressed",S.mode==="week");
    document.getElementById("mPeriod").setAttribute("aria-pressed",S.mode!=="week");
    return;
  }
  var used=sp/cap, remain=Math.max(0,Math.min(1,1-used));
  document.getElementById("gauge").classList.toggle("over",left<0);
  document.documentElement.style.setProperty("--sig",tone(used));
  document.getElementById("gFill").setAttribute("stroke-dasharray",(ARC*remain).toFixed(1)+" "+FULL);
  animateValue("gAmt",Math.abs(left),function(v){
    document.getElementById("gAmt").innerHTML='<span class="p">S$</span>'+grp(String(Math.round(v/100)));
  },380);
  document.getElementById("gCap").textContent = left<0 ? money(-left,false)+" over" : lab;
  var reserveNow=reservedCommitments(ps,pe), freeNow=left-reserveNow.amount;
  document.getElementById("gPace").textContent = left<0
    ? "Resets in "+dl+" "+(dl===1?"day":"days")
    : (reserveNow.amount?money(Math.max(0,freeNow)/dl,false)+" a day after reserved bills":money(left/dl,false)+" a day for "+dl+" more "+(dl===1?"day":"days"));
  var reserve=reservedCommitments(ps,pe), freeAfter=left-reserve.amount;
  if(safe)safe.textContent=freeAfter>0?money(freeAfter/dl,false):"S$0";
  var cn=document.getElementById("commitmentNote");
  if(cn){ if(reserve.count){ cn.hidden=false; cn.innerHTML=iconSvg("calendar","mini-svg")+" "+money(reserve.amount,false)+" reserved for "+reserve.count+" upcoming "+(reserve.count===1?"commitment":"commitments")+" · view Plan"; } else cn.hidden=true; }
  if(pspent)pspent.textContent=money(sp,false);
  if(reset)reset.textContent=dl+(dl===1?" day":" days");
  var ideal=Math.min(1,elapsed/pd), paceDelta=sp-(cap*ideal), usedClamp=Math.max(0,Math.min(1,used));
  if(actual)actual.style.width=(usedClamp*100).toFixed(1)+"%";
  if(marker)marker.style.left=(ideal*100).toFixed(1)+"%";
  if(status){
    if(Math.abs(paceDelta)<Math.max(500,cap*.015)) status.textContent="Right on budget pace";
    else if(paceDelta>0) status.textContent=money(paceDelta,false)+" ahead of spending pace";
    else status.textContent=money(-paceDelta,false)+" under spending pace";
  }
  if(pct)pct.textContent=Math.round(used*100)+"% used";
  document.getElementById("mWeek").setAttribute("aria-pressed",S.mode==="week");
  document.getElementById("mPeriod").setAttribute("aria-pressed",S.mode!=="week");
} 
function drawList(){
  var box=document.getElementById("list"); box.innerHTML="";
  var a,b,scale=1;
  if(S.mode==="week"){ var w=weekWin(); a=w.ws; b=w.we; scale=days(w.ws,w.we)/days(w.ps,w.pe); }
  else { a=pStart(today()); b=pShift(a,1); }
  S.cats.forEach(function(c){
    var cap=(c.cap||0)*scale, sp=spent(a,b,c.id), left=cap-sp, f=cap>0?sp/cap:0;
    var wrap=el("div","envelope-wrap"); wrap.dataset.cid=c.id;
    var btn=el("button","row"), top=el("div","top");
    var nm=el("span","nm"), gh=grip();
    nm.appendChild(gh); nm.appendChild(iconBadge(c)); nm.appendChild(el("span",null,c.name));
    var r=el("span","rm tab");
    if(cap<=0){ r.textContent="Set cap"; r.style.color="var(--faint)"; }
    else {
      r.style.color=left<0?"var(--coral)":hueOf(c.id);
      animateValue("cat:"+c.id+":"+S.mode,Math.abs(left),function(v){ r.textContent=money(v,false)+(left<0?" over":""); });
    }
    top.appendChild(nm); top.appendChild(r); btn.appendChild(top);
    var ru=el("div","rule"), fi=el("i");
    fi.style.width=cap<=0?"0%":Math.max(0,Math.min(100,(1-f)*100))+"%";
    fi.style.background=(cap>0&&f>=1)?"var(--coral)":hueOf(c.id);
    ru.appendChild(fi); btn.appendChild(ru);
    var meta=el("div","envelope-meta");
    meta.appendChild(el("span",null,cap>0?money(sp,false)+" spent":"No cap yet"));
    meta.appendChild(el("span",null,cap>0?money(cap,false)+" budget":"Tap Setup to set one"));
    btn.appendChild(meta);
    btn.addEventListener("click",function(){ if(reorderMode||Date.now()<suppressEnvelopeClick) return; openSpend(c.id); });
    wrap.appendChild(btn); box.appendChild(wrap); setupEnvelopeDrag(wrap,gh);
  });
}
var suppressEnvelopeClick=0, reorderMode=false;
function setReorderMode(on){
  reorderMode=!!on;
  document.body.classList.toggle("reorder-mode",reorderMode);
  var b=document.getElementById("reorderToggle"), tip=document.getElementById("reorderTip");
  if(b){ b.textContent=reorderMode?"Done":"Reorder"; b.setAttribute("aria-pressed",reorderMode?"true":"false"); }
  if(tip){ tip.classList.toggle("active",reorderMode); tip.querySelector("span").textContent=reorderMode?"Drag a handle up or down. Tap Done when finished.":"Tap Reorder, then drag the handles. This avoids iPhone text selection."; }
  if(!reorderMode){
    Array.prototype.forEach.call(document.querySelectorAll(".envelope-wrap.dragging,.envelope-wrap.drag-target"),function(x){x.classList.remove("dragging","drag-target");});
  }
}
function setupEnvelopeDrag(wrap,handle){
  var dragging=false,pid=null,startY=0;
  function start(e){
    if(!reorderMode) return;
    if(e.button!=null&&e.button!==0) return;
    e.preventDefault(); e.stopPropagation();
    pid=e.pointerId; startY=e.clientY; dragging=true; suppressEnvelopeClick=Date.now()+900; haptic(9);
    wrap.classList.add("dragging"); document.body.classList.add("drag-active");
    try{handle.setPointerCapture(pid);}catch(x){}
  }
  function move(e){
    if(!dragging||e.pointerId!==pid)return;
    e.preventDefault(); e.stopPropagation();
    var hit=document.elementFromPoint(e.clientX,e.clientY), target=hit&&hit.closest?hit.closest(".envelope-wrap"):null;
    Array.prototype.forEach.call(document.querySelectorAll(".envelope-wrap.drag-target"),function(x){x.classList.remove("drag-target");});
    if(target&&target!==wrap&&target.parentNode===wrap.parentNode){
      target.classList.add("drag-target");
      var rect=target.getBoundingClientRect();
      if(e.clientY<rect.top+rect.height/2) wrap.parentNode.insertBefore(wrap,target);
      else wrap.parentNode.insertBefore(wrap,target.nextSibling);
    }
  }
  function end(e){
    if(!dragging)return;
    if(e&&pid!=null&&e.pointerId!=null&&e.pointerId!==pid)return;
    dragging=false; suppressEnvelopeClick=Date.now()+500;
    wrap.classList.remove("dragging"); document.body.classList.remove("drag-active");
    Array.prototype.forEach.call(document.querySelectorAll(".envelope-wrap.drag-target"),function(x){x.classList.remove("drag-target");});
    var ids=Array.prototype.map.call(document.querySelectorAll("#list .envelope-wrap"),function(x){return x.dataset.cid;});
    S.cats.sort(function(a,b){return ids.indexOf(a.id)-ids.indexOf(b.id);});
    save(); haptic(6);
    try{ if(pid!=null)handle.releasePointerCapture(pid); }catch(x){}
    pid=null;
  }
  handle.addEventListener("pointerdown",start,{passive:false});
  handle.addEventListener("pointermove",move,{passive:false});
  handle.addEventListener("pointerup",end,{passive:false}); handle.addEventListener("pointercancel",end,{passive:false});
  handle.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();});
  handle.addEventListener("contextmenu",function(e){e.preventDefault();});
  handle.addEventListener("selectstart",function(e){e.preventDefault();});
}

/* ── spend sheet ── */
var cents=0, mode="SGD", active=null;
function openSheet(h){
  var sb=document.getElementById("sheetBody"); sb.innerHTML=h;
  if(sb.querySelector(".pull")) sb.querySelector(".pull").insertAdjacentHTML("afterend",'<div class="sheethint">drag down to close</div>');
  sb.style.removeProperty("--sheet-drag"); document.getElementById("sheet").classList.add("on");
}
function shut(){
  var sh=document.getElementById("sheet"), sb=document.getElementById("sheetBody");
  sh.classList.remove("dragging"); sb.style.removeProperty("--sheet-drag"); sh.classList.remove("on");
}
document.getElementById("sheet").addEventListener("click",function(e){ if(e.target.id==="sheet") shut(); });
var sheetDrag={on:false,startY:0,lastY:0,lastT:0,velocity:0,pid:null};
document.getElementById("sheetBody").addEventListener("pointerdown",function(e){
  if(!e.target.closest||!e.target.closest(".pull")) return;
  sheetDrag.on=true; sheetDrag.startY=e.clientY; sheetDrag.lastY=e.clientY; sheetDrag.lastT=performance.now(); sheetDrag.velocity=0; sheetDrag.pid=e.pointerId;
  document.getElementById("sheet").classList.add("dragging");
  try{ this.setPointerCapture(e.pointerId); }catch(x){}
});
document.getElementById("sheetBody").addEventListener("pointermove",function(e){
  if(!sheetDrag.on||e.pointerId!==sheetDrag.pid) return;
  var dy=Math.max(0,e.clientY-sheetDrag.startY), now=performance.now(), dt=Math.max(1,now-sheetDrag.lastT);
  sheetDrag.velocity=(e.clientY-sheetDrag.lastY)/dt; sheetDrag.lastY=e.clientY; sheetDrag.lastT=now;
  this.style.setProperty("--sheet-drag",dy+"px"); e.preventDefault();
},{passive:false});
function finishSheetDrag(e){
  if(!sheetDrag.on||e.pointerId!==sheetDrag.pid) return;
  var dy=Math.max(0,e.clientY-sheetDrag.startY), close=dy>105||sheetDrag.velocity>.72;
  sheetDrag.on=false; document.getElementById("sheet").classList.remove("dragging");
  document.getElementById("sheetBody").style.removeProperty("--sheet-drag");
  if(close){ haptic(7); shut(); }
}
document.getElementById("sheetBody").addEventListener("pointerup",finishSheetDrag);
document.getElementById("sheetBody").addEventListener("pointercancel",finishSheetDrag);
document.addEventListener("keydown",function(e){ if(e.key==="Escape") shut(); });


function accountSelectHtml(id,selected,label){
  if(!S.accounts.length)return "";
  var h='<div class="field sheet-account"><label for="'+id+'">'+(label||"Account")+'</label><select id="'+id+'"><option value="">Unassigned</option>';
  S.accounts.forEach(function(a){h+='<option value="'+a.id+'"'+(a.id===selected?' selected':'')+'>'+esc(a.name)+'</option>';});
  return h+'</select></div>';
}
function openSpend(cid){
  active=cid; cents=0; mode="SGD";
  var c=catOf(cid), ps=pStart(today()), left=(c.cap||0)-spent(ps,pShift(ps,1),cid);
  openSheet('<div class="pull"></div>'+
    '<div class="flex"><b style="font-size:17px">'+esc(c.name)+'</b>'+
    '<span class="tiny dim tab">'+(left<0?money(-left,false)+" over":money(left,false)+" left")+'</span></div>'+
    '<div class="flex" style="margin-top:12px"><span class="seg">'+
      '<button id="mS" aria-pressed="true">SGD</button><button id="mM" aria-pressed="false">MYR</button></span>'+
      '<span class="tiny dim" id="conv"></span></div>'+
    '<div class="disp tab zero" id="disp"><span class="p">S$</span>0.00</div>'+
    '<div class="quick" id="quick"></div>'+
    '<input id="note" class="note" placeholder="What was it for? (optional)" autocomplete="off" enterkeyhint="done">'+
    accountSelectHtml("spAccount",S.defaultAccount,"Paid from")+
    '<label class="quick-save-row"><input id="saveQuick" type="checkbox"><span>'+iconSvg("spark","mini-svg")+' Save this amount as a Quick log</span></label>'+
    '<div class="pad" id="pad"></div>'+
    '<button class="go" id="ok" disabled>Add</button><button class="flat" id="cx">Cancel</button>');
  document.getElementById("cx").onclick=shut;
  document.getElementById("ok").onclick=function(){ commit(cents); };
  document.getElementById("mS").onclick=function(){ setMode("SGD"); };
  document.getElementById("mM").onclick=function(){ setMode("MYR"); };
  quickRow(c); padRow(); paint();
}
function setMode(m){ mode=m; cents=0;
  document.getElementById("mS").setAttribute("aria-pressed",m==="SGD");
  document.getElementById("mM").setAttribute("aria-pressed",m==="MYR");
  quickRow(catOf(active)); paint(); }
function quickRow(c){
  var q=document.getElementById("quick"); q.innerHTML="";
  ((c.quick&&c.quick.length)?c.quick:[500,1000,2000,5000]).slice(0,4).forEach(function(v){
    var amt=mode==="SGD"?v:Math.round(v*S.rate);
    var b=el("button","q",mode==="SGD"?(amt/100).toFixed(2):"RM"+Math.round(amt/100));
    b.addEventListener("click",function(){ commit(amt); });
    q.appendChild(b);
  });
}
function padRow(){
  var p=document.getElementById("pad"); p.innerHTML="";
  ["1","2","3","4","5","6","7","8","9","00","0","\u232B"].forEach(function(k){
    var b=el("button","key",k); b.setAttribute("aria-label",k==="\u232B"?"Delete":k);
    b.addEventListener("click",function(){
      if(k==="\u232B") cents=Math.floor(cents/10);
      else if(k==="00"){ if(cents*100<1e8) cents=cents*100; }
      else if(cents*10<1e8) cents=cents*10+parseInt(k,10);
      paint();
    });
    p.appendChild(b);
  });
}
function paint(){
  var d=document.getElementById("disp"); if(!d) return;
  d.innerHTML='<span class="p">'+(mode==="SGD"?"S$":"RM")+'</span>'+grp((cents/100).toFixed(2));
  d.classList.toggle("zero",cents===0);
  document.getElementById("ok").disabled=!(cents>0);
  document.getElementById("conv").textContent =
    mode==="MYR"?(cents>0?"about "+money(Math.round(cents/S.rate)):"at "+S.rate+" to the dollar"):"";
}
function logSpend(cid,amtCents,cur,note,account){
  var s = cur==="MYR"?Math.round(amtCents/S.rate):amtCents;
  var id=uid();
  S.txns.push({id:id,date:iso(today()),sgd:s,cur:cur,orig:amtCents,cat:cid,note:(note||"").trim(),account:account||""});
  lastId=id; save(); redraw();
  var ps=pStart(today()), left=(catOf(cid).cap||0)-spent(ps,pShift(ps,1),cid);
  toast((cur==="SGD"?money(s):rmf(amtCents))+" · "+(left<0?money(-left,false)+" over":money(left,false)+" left"),true);
}
function addQuickLog(cid,amt,cur,note,account){
  if(!(amt>0)||!cid)return;
  var key=cid+":"+cur+":"+amt+":"+(account||"")+":"+(note||"").trim().toLowerCase();
  var exists=S.bookmarks.some(function(b){return (b.cat+":"+b.cur+":"+b.amt+":"+(b.account||"")+":"+(b.note||"").trim().toLowerCase())===key;});
  if(exists)return;
  S.bookmarks.unshift({id:"b"+Date.now(),cat:cid,amt:amt,cur:cur,note:(note||"").trim(),account:account||""});
  S.bookmarks=S.bookmarks.slice(0,12);
}
function commit(raw){
  if(!(raw>0)||!active) return;
  var n=document.getElementById("note"), v=n?n.value:"", q=document.getElementById("saveQuick"), ac=document.getElementById("spAccount"), aid=ac?ac.value:"";
  if(aid)S.defaultAccount=aid;
  if(q&&q.checked)addQuickLog(active,raw,mode,v,aid);
  shut(); logSpend(active,raw,mode,v,aid);
}
function drawQuickLogs(){
  var box=document.getElementById("quickLogs"), hint=document.getElementById("quickLogHint"); if(!box)return; box.innerHTML="";
  if(!S.bookmarks.length){ box.appendChild(el("div","quick-empty","Save a frequent amount while logging and it will appear here.")); if(hint)hint.textContent="saved favourites"; return; }
  if(hint)hint.textContent=S.bookmarks.length+(S.bookmarks.length===1?" favourite":" favourites");
  S.bookmarks.slice(0,8).forEach(function(b){
    var c=catOf(b.cat); if(!c)return;
    var card=el("div","quick-log-card"); card.setAttribute("role","button"); card.tabIndex=0; card.style.setProperty("--quick-hue",hueOf(c.id));
    var top=el("span","quick-log-top"); top.appendChild(iconBadge(c)); top.appendChild(el("b",null,c.name));
    var x=el("button","quick-log-x","×"); x.type="button"; x.setAttribute("aria-label","Remove quick log");
    x.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();S.bookmarks=S.bookmarks.filter(function(z){return z.id!==b.id;});save();drawQuickLogs();toast("Quick log removed");});
    top.appendChild(x); card.appendChild(top);
    card.appendChild(el("span","quick-log-amount tab",b.cur==="MYR"?rmf(b.amt):money(b.amt)));
    if(b.note)card.appendChild(el("small",null,b.note));
    card.addEventListener("click",function(){haptic(6);logSpend(b.cat,b.amt,b.cur,b.note||"",b.account||"");}); card.addEventListener("keydown",function(e){if(e.key==="Enter"||e.key===" "){e.preventDefault();card.click();}});
    box.appendChild(card);
  });
}

/* ── Plan screen ── */
function drawPlan(){
  var ps=pStart(today()), pe=pShift(ps,1), envelopeLeft=capAll()-spent(ps,pe), res=reservedCommitments(ps,pe), inc=expectedIncome(ps,pe), free=envelopeLeft-res.amount;
  var pl=document.getElementById("planPeriodLabel"); if(!pl)return;
  pl.textContent=pLabel(ps); document.getElementById("planEnvelopeLeft").textContent=money(envelopeLeft,false); document.getElementById("planReserved").textContent=money(res.amount,false); document.getElementById("planIncome").textContent=money(inc.amount,false); document.getElementById("planFree").textContent=(free<0?"-":"")+money(Math.abs(free),false);
  document.getElementById("planFree").classList.toggle("danger",free<0);
  drawAccounts(); drawUpcoming(); drawSchedules();
}
function drawAccounts(){
  var box=document.getElementById("accountList"), sum=document.getElementById("accountSummary"); if(!box)return; box.innerHTML=""; sum.innerHTML="";
  var liquid=0, credit=0; S.accounts.forEach(function(a){if(a.type==="credit")credit+=a.balance||0;else liquid+=a.balance||0;});
  sum.innerHTML='<div><span>Liquid snapshot</span><b class="tab">'+money(liquid,false)+'</b></div><div><span>Cards owing</span><b class="tab">'+money(credit,false)+'</b></div>';
  if(!S.accounts.length){box.appendChild(el("div","empty compact","Add the accounts you actually use, then tag spending to them."));return;}
  S.accounts.forEach(function(a){ var b=el("button","account-card"), left=el("span","account-left"), ico=el("span","account-icon"); ico.innerHTML=iconSvg(accountIcon(a.type)); left.appendChild(ico); var cp=el("span"); cp.appendChild(el("b",null,a.name)); cp.appendChild(el("small",null,accountTypeLabel(a.type)+(a.updated?" · updated "+dateShort(a.updated):""))); left.appendChild(cp); b.appendChild(left); var right=el("span","account-balance"); right.appendChild(el("b","tab",money(a.balance||0,false))); right.appendChild(el("small",null,a.type==="credit"?"owing":"snapshot")); b.appendChild(right); b.addEventListener("click",function(){openAccount(a.id);}); box.appendChild(b); });
}
function openAccount(id){
  var a=id?accountOf(id):null; if(!a)a={id:"a"+Date.now(),name:"",type:"bank",balance:0,updated:iso(today())};
  openSheet('<div class="pull"></div><b style="font-size:17px">'+(id?'Edit account':'Add account')+'</b>'+ '<div class="field" style="margin-top:14px"><label for="aName">Name</label><input id="aName" autocomplete="off" value="'+esc(a.name)+'" placeholder="DBS Everyday"></div>'+ '<div class="field"><label for="aType">Type</label><select id="aType"><option value="bank"'+(a.type==='bank'?' selected':'')+'>Bank account</option><option value="cash"'+(a.type==='cash'?' selected':'')+'>Cash</option><option value="credit"'+(a.type==='credit'?' selected':'')+'>Credit card</option></select></div>'+ '<div class="field"><label for="aBal">'+(a.type==='credit'?'Amount owing':'Current balance')+'</label><input id="aBal" type="text" inputmode="decimal" value="'+((a.balance||0)/100).toFixed(2)+'"></div>'+ '<p class="hint">This is a manual snapshot. Budget Margin will not alter it behind your back when you log spending.</p>'+ '<button class="go" id="aSave">Save account</button>'+ (id?'<button class="flat danger" id="aDelete">Remove account</button>':'')+'<button class="flat" id="aCancel">Cancel</button>');
  document.getElementById("aCancel").onclick=shut;
  document.getElementById("aSave").onclick=function(){var name=document.getElementById("aName").value.trim();if(!name){toast("Give the account a name");return;}a.name=name;a.type=document.getElementById("aType").value;a.balance=toCents(document.getElementById("aBal").value);a.updated=iso(today());if(!id){S.accounts.push(a);if(!S.defaultAccount)S.defaultAccount=a.id;}save();shut();redraw();toast(id?"Account updated":"Account added");};
  if(id)document.getElementById("aDelete").onclick=function(){if(!confirm("Remove "+a.name+"? Existing transactions will become unassigned."))return;S.accounts=S.accounts.filter(function(x){return x.id!==id;});S.txns.forEach(function(t){if(t.account===id)t.account="";});S.recurring.forEach(function(r){if(r.account===id)r.account="";});if(S.defaultAccount===id)S.defaultAccount="";save();shut();redraw();toast("Account removed");};
}
function drawUpcoming(){
  var box=document.getElementById("upcomingList"); if(!box)return; box.innerHTML="";
  var ps=pStart(today()), start=ps>new Date(today().getFullYear(),today().getMonth(),today().getDate()-14)?ps:new Date(today().getFullYear(),today().getMonth(),today().getDate()-14), end=new Date(today().getFullYear(),today().getMonth(),today().getDate()+31);
  var list=periodOccurrences(start,end).filter(function(o){return !o.done;}).slice(0,10);
  if(!list.length){box.appendChild(el("div","empty compact","Nothing scheduled for the next 30 days."));return;}
  list.forEach(function(o){var r=o.rec, row=el("div","upcoming-card"), left=el("span","upcoming-left"), ico=el("span","upcoming-icon "+(r.type==='income'?'income':'expense'));ico.innerHTML=iconSvg(r.type==='income'?'spark':'calendar');left.appendChild(ico);var cp=el("span");cp.appendChild(el("b",null,r.name));var d=pIso(o.date), overdue=d<today();cp.appendChild(el("small",null,(overdue?'Overdue · ':'')+dateShort(o.date)+(r.account?' · '+accountName(r.account):'')));left.appendChild(cp);row.appendChild(left);var side=el("span","upcoming-side");side.appendChild(el("b","tab "+(r.type==='income'?'income-text':''),(r.type==='income'?'+':'-')+money(amountSgd(r),false)));var act=el("button","mini-action",r.type==='income'?"Received":(r.cat?"Log":"Paid"));act.addEventListener("click",function(){completeOccurrence(o);});side.appendChild(act);row.appendChild(side);box.appendChild(row);});
}
function completeOccurrence(o){var r=o.rec,key=occurrenceKey(r,o.date);if(r.type!=="income"&&r.cat){logSpend(r.cat,r.amount,r.cur||"SGD",r.name,r.account||"");}S.recurringDone[key]=true;save();redraw();toast(r.type==='income'?"Income marked received":(r.cat?"Commitment logged":"Marked paid"));}
function drawSchedules(){
  var box=document.getElementById("scheduleList"), count=document.getElementById("recurringCount"); if(!box)return; box.innerHTML="";var active=S.recurring.filter(function(r){return r.active!==false;});if(count)count.textContent=active.length+" active";if(!S.recurring.length){box.appendChild(el("div","empty compact","Schedule rent, subscriptions, insurance, salary or any predictable cash flow."));return;}S.recurring.forEach(function(r){var b=el("button","schedule-card"), left=el("span","schedule-left"), ico=el("span","schedule-icon");ico.innerHTML=iconSvg(r.type==='income'?'spark':'calendar');left.appendChild(ico);var cp=el("span");cp.appendChild(el("b",null,r.name));var nx=nextOccurrence(r);cp.appendChild(el("small",null,(r.freq||'monthly')+(nx?' · next '+dateShort(nx.date):'')+(r.reserve!==false&&r.type!=='income'?' · reserved':'')));left.appendChild(cp);b.appendChild(left);b.appendChild(el("span","tab",(r.type==='income'?'+':'')+(r.cur==='MYR'?rmf(r.amount):money(r.amount,false))));b.addEventListener("click",function(){openRecurring(r.id);});box.appendChild(b);});
}
function recurringOptions(list,selected,none){var h='<option value="">'+none+'</option>';list.forEach(function(x){h+='<option value="'+x.id+'"'+(x.id===selected?' selected':'')+'>'+esc(x.name)+'</option>';});return h;}
function openRecurring(id){
  var r=null;S.recurring.forEach(function(x){if(x.id===id)r=x;});if(!r)r={id:"r"+Date.now(),name:"",type:"expense",amount:0,cur:"SGD",freq:"monthly",start:iso(today()),reserve:true,cat:"",account:"",active:true};
  openSheet('<div class="pull"></div><b style="font-size:17px">'+(id?'Edit schedule':'New recurring item')+'</b>'+ '<div class="field" style="margin-top:14px"><label for="rName">Name</label><input id="rName" value="'+esc(r.name)+'" placeholder="Rent, Netflix, salary…"></div>'+ '<div class="two-fields"><div class="field"><label for="rType">Flow</label><select id="rType"><option value="expense"'+(r.type==='expense'?' selected':'')+'>Expense</option><option value="income"'+(r.type==='income'?' selected':'')+'>Income</option></select></div><div class="field"><label for="rCur">Currency</label><select id="rCur"><option value="SGD"'+(r.cur==='SGD'?' selected':'')+'>SGD</option><option value="MYR"'+(r.cur==='MYR'?' selected':'')+'>MYR</option></select></div></div>'+ '<div class="field"><label for="rAmount">Amount</label><input id="rAmount" inputmode="decimal" value="'+((r.amount||0)/100).toFixed(2)+'"></div>'+ '<div class="two-fields"><div class="field"><label for="rFreq">Repeats</label><select id="rFreq"><option value="monthly"'+(r.freq==='monthly'?' selected':'')+'>Monthly</option><option value="weekly"'+(r.freq==='weekly'?' selected':'')+'>Weekly</option><option value="yearly"'+(r.freq==='yearly'?' selected':'')+'>Yearly</option></select></div><div class="field"><label for="rStart">First / next due</label><input id="rStart" type="date" value="'+r.start+'"></div></div>'+ '<div class="field"><label for="rCat">Envelope when paid</label><select id="rCat">'+recurringOptions(S.cats,r.cat||'',"No envelope / reminder only")+'</select></div>'+ '<div class="field"><label for="rAccount">Account</label><select id="rAccount">'+recurringOptions(S.accounts,r.account||'',"Unassigned")+'</select></div>'+ '<label class="toggle-row"><input id="rReserve" type="checkbox"'+(r.reserve!==false?' checked':'')+'><span><b>Reserve this expense</b><small>Subtract upcoming unpaid amounts from Safe today. Ignored for income.</small></span></label>'+ '<button class="go" id="rSave">Save schedule</button>'+ (id?'<button class="flat danger" id="rDelete">Remove schedule</button>':'')+'<button class="flat" id="rCancel">Cancel</button>');
  document.getElementById("rCancel").onclick=shut;document.getElementById("rSave").onclick=function(){var name=document.getElementById("rName").value.trim(),amt=toCents(document.getElementById("rAmount").value);if(!name||!amt){toast("Enter a name and amount");return;}r.name=name;r.type=document.getElementById("rType").value;r.cur=document.getElementById("rCur").value;r.amount=amt;r.freq=document.getElementById("rFreq").value;r.start=document.getElementById("rStart").value||iso(today());r.cat=document.getElementById("rCat").value;r.account=document.getElementById("rAccount").value;r.reserve=document.getElementById("rReserve").checked;if(!id)S.recurring.push(r);save();shut();redraw();toast(id?"Schedule updated":"Schedule added");};
  if(id)document.getElementById("rDelete").onclick=function(){if(!confirm("Remove "+r.name+"?"))return;S.recurring=S.recurring.filter(function(x){return x.id!==id;});save();shut();redraw();toast("Schedule removed");};
}

/* ── debt ── */
function debtTotals(){
  var st=0,bal=0; S.debts.forEach(function(d){ st+=d.start||0; bal+=d.bal||0; });
  return {start:st,bal:bal,cleared:st-bal};
}
function drawDebt(){
  var t=debtTotals(), frac=t.start>0?t.cleared/t.start:0;
  document.getElementById("dFill").setAttribute("stroke-dasharray",(ARC*Math.max(0,Math.min(1,frac))).toFixed(1)+" "+FULL);
  document.getElementById("dFill").style.stroke = t.bal<=0?"var(--jade)":"var(--violet)";
  animateValue("dAmt",t.bal,function(v){
    document.getElementById("dAmt").innerHTML='<span class="p">S$</span>'+grp(String(Math.round(v/100)));
  },420);
  document.getElementById("dCap").textContent = t.bal<=0 ? "All clear" : "still owing of "+money(t.start,false);
  document.getElementById("dPace").textContent = t.bal<=0 ? "Nothing left to pay"
    : money(t.cleared,false)+" cleared so far, "+Math.round(frac*100)+" per cent done";
  var box=document.getElementById("dList"); box.innerHTML="";
  S.debts.forEach(function(d,i){
    var f=d.start>0?(d.start-d.bal)/d.start:0;
    var b=el("button","row"), top=el("div","top");
    var nm=el("span","nm"); var dot=el("span","dot");
    var hue=d.bal<=0?"var(--jade)":"var(--violet)";
    dot.style.background=hue; dot.style.color=hue;
    nm.appendChild(dot); nm.appendChild(el("span",null,d.name+(d.rate?"  "+d.rate+"%":"")));
    var r=el("span","rm tab",d.bal<=0?"Cleared":money(d.bal,false));
    r.style.color=hue; top.appendChild(nm); top.appendChild(r); b.appendChild(top);
    var ru=el("div","rule"), fi=el("i");
    fi.style.width=Math.max(0,Math.min(100,f*100))+"%"; fi.style.background=hue;
    ru.appendChild(fi); b.appendChild(ru);
    b.addEventListener("click",function(){ openPay(d.id); });
    box.appendChild(b);
  });
}
function openPay(id){
  var d=null; S.debts.forEach(function(x){ if(x.id===id) d=x; }); if(!d) return;
  openSheet('<div class="pull"></div><b style="font-size:17px">'+esc(d.name)+'</b>'+
    '<div class="field" style="margin-top:14px"><label for="pA">Payment in Singapore dollars</label>'+
    '<input id="pA" type="text" inputmode="decimal" placeholder="0.00"></div>'+
    '<button class="go" id="pOk">Record payment</button>'+
    '<div class="field" style="margin-top:18px"><label for="pB">Or correct the balance owing</label>'+
    '<input id="pB" type="text" inputmode="decimal" value="'+(d.bal/100).toFixed(2)+'"></div>'+
    '<div class="field"><label for="pR">Interest rate per year</label>'+
    '<input id="pR" type="text" inputmode="decimal" value="'+(d.rate||0)+'"></div>'+
    '<button class="sm" id="pSave" style="width:100%;text-align:center">Save these details</button>'+
    '<div class="flex" style="gap:8px;margin-top:10px">'+
    '<button class="flat" id="pX" style="flex:1">Close</button>'+
    '<button class="flat danger" id="pD" style="flex:1">Remove debt</button></div>');
  document.getElementById("pX").onclick=shut;
  document.getElementById("pOk").onclick=function(){
    var a=toCents(document.getElementById("pA").value);
    if(a<=0){ toast("Enter an amount above zero"); return; }
    d.bal=Math.max(0,d.bal-a);
    S.pays.push({id:uid(),date:iso(today()),debt:d.id,amt:a});
    save(); shut(); redraw();
    toast(d.bal<=0?d.name+" is cleared":money(a)+" paid · "+money(d.bal,false)+" to go");
  };
  document.getElementById("pSave").onclick=function(){
    var b=toCents(document.getElementById("pB").value), r=parseFloat(document.getElementById("pR").value);
    d.bal=b; if(b>d.start) d.start=b; d.rate=isNaN(r)?0:r;
    save(); shut(); redraw(); toast("Saved");
  };
  document.getElementById("pD").onclick=function(){
    if(!confirm("Remove "+d.name+"?")) return;
    S.debts=S.debts.filter(function(x){ return x.id!==id; }); save(); shut(); redraw();
  };
}

/* ── recent activity ── */
function drawRecent(){
  var box=document.getElementById("recentList"); if(!box)return; box.innerHTML="";
  var list=S.txns.slice().sort(function(a,b){ return (b.date.localeCompare(a.date)) || String(b.id).localeCompare(String(a.id)); }).slice(0,3);
  if(!list.length){ box.appendChild(el("div","empty compact","Your latest entries will appear here.")); return; }
  list.forEach(function(t){
    var row=el("button","recent-item"), left=el("span","recent-left"), copy=el("span","recent-copy"), c=catOf(t.cat);
    copy.appendChild(el("b",null,catName(t.cat)));
    copy.appendChild(el("span",null,(t.note?t.note+" · ":"")+(t.account?accountName(t.account)+" · ":"")+dayLab(t.date)));
    if(c)left.appendChild(iconBadge(c)); left.appendChild(copy); row.appendChild(left); row.appendChild(el("span","recent-amt tab",money(t.sgd)));
    row.addEventListener("click",function(){ openEdit(t.id); }); box.appendChild(row);
  });
}

/* ── reconcile ── */
function lastClosedPeriod(){ return pShift(pStart(today()),-1); }
function recFor(k){ for(var i=0;i<S.recs.length;i++) if(S.recs[i].p===k) return S.recs[i]; return null; }
function drawRecPrompt(){
  var box=document.getElementById("recBox"); box.innerHTML="";
  var lp=lastClosedPeriod(), k=iso(lp);
  if(recFor(k)) return;
  var logged=spent(lp,pShift(lp,1));
  if(logged<=0) return;
  var b=el("div","block flag");
  b.appendChild(el("div",null,"Check "+pLabel(lp)+" against your bank"));
  b.appendChild(el("div","tiny dim","You logged "+money(logged,false)+". What did your accounts actually show?"));
  var go=el("button","sm","Do the check"); go.style.marginTop="10px";
  go.addEventListener("click",function(){ openRec(lp); });
  b.appendChild(go); box.appendChild(b);
}
function openRec(lp){
  var k=iso(lp), logged=spent(lp,pShift(lp,1));
  openSheet('<div class="pull"></div><b style="font-size:17px">'+esc(pLabel(lp))+'</b>'+
    '<div class="tiny dim" style="margin-top:6px">Add up the spending on your accounts for this period and put the total here. Leave out the loan, allowance and insurance.</div>'+
    '<div class="flex" style="margin-top:14px"><span class="dim">You logged</span><b class="tab">'+money(logged,false)+'</b></div>'+
    '<div class="field" style="margin-top:12px"><label for="rA">Your accounts actually show</label>'+
    '<input id="rA" type="text" inputmode="decimal" placeholder="0.00"></div>'+
    '<button class="go" id="rOk">Save the check</button>'+
    '<button class="flat" id="rX">Not now</button>');
  document.getElementById("rX").onclick=shut;
  document.getElementById("rOk").onclick=function(){
    var a=toCents(document.getElementById("rA").value);
    if(a<=0){ toast("Enter the amount your accounts show"); return; }
    S.recs.push({p:k,logged:logged,actual:a}); save(); shut(); redraw();
    var gap=a-logged;
    toast(gap>0?money(gap,false)+" never got logged":gap<0?"You logged "+money(-gap,false)+" more than you spent":"Spot on");
  };
}
function drawRecHist(){
  var box=document.getElementById("recHist"); box.innerHTML="";
  if(!S.recs.length){ box.textContent="No checks done yet."; return; }
  S.recs.slice(-6).reverse().forEach(function(r){
    var gap=r.actual-r.logged;
    var d=el("div",null,pLabel(pIso(r.p))+" — missed "+money(Math.max(0,gap),false));
    d.style.marginBottom="4px";
    if(gap>r.logged*0.15) d.style.color="var(--coral)";
    box.appendChild(d);
  });
}

/* ── history ── */
var hStart=pStart(today());
function drawHistoryList(){
  document.getElementById("hLabel").textContent=pLabel(hStart);
  var body=document.getElementById("hBody"); body.innerHTML="";
  var a=hStart,b=pShift(hStart,1);
  var q=(document.getElementById("hSearch").value||"").trim().toLowerCase();
  var cf=document.getElementById("hCatFilter").value||"", af=(document.getElementById("hAccountFilter")||{}).value||"";
  var list=S.txns.filter(function(t){
    if(!inR(t,a,b)) return false;
    if(cf&&t.cat!==cf) return false; if(af==="__none"&&(t.account||""))return false; if(af&&af!=="__none"&&(t.account||"")!==af) return false;
    if(q){ var hay=(catName(t.cat)+" "+(t.note||"")+" "+t.date).toLowerCase(); if(hay.indexOf(q)<0) return false; }
    return true;
  });
  var sumAll=list.reduce(function(x,t){return x+t.sgd;},0), hs=document.getElementById("hSummary");
  if(hs) hs.innerHTML='<span>'+list.length+(list.length===1?' entry':' entries')+'</span><b class="tab">'+money(sumAll,false)+'</b>';
  if(!list.length){ body.appendChild(el("div","empty",q||cf||af?"No entries match this filter.":"Nothing spent in this period.")); return; }
  var by={}; list.forEach(function(t){ (by[t.date]=by[t.date]||[]).push(t); });
  Object.keys(by).sort().reverse().forEach(function(day){
    var items=by[day], sum=items.reduce(function(x,t){return x+t.sgd;},0);
    var h=el("div","daybar"); h.appendChild(el("span",null,dayLab(day)));
    h.appendChild(el("span","tab",money(sum))); body.appendChild(h);
    items.slice().reverse().forEach(function(t){
      var shell=el("div","swipe-shell"), acts=el("div","swipe-actions");
      var rep=el("button","swipe-action repeat"); rep.innerHTML='<svg viewBox="0 0 24 24"><path d="M8 8H4v-4"/><path d="M4.5 8.5A8 8 0 1 1 5 17"/></svg><span>Repeat</span>';
      var del=el("button","swipe-action delete"); del.innerHTML='<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M8 10v8M12 10v8M16 10v8M6 7l1 14h10l1-14"/></svg><span>Delete</span>';
      acts.appendChild(rep); acts.appendChild(del); shell.appendChild(acts);
      var btn=el("button","txn"), L=el("span");
      var n=el("div","nm"), tc=catOf(t.cat);
      if(tc)n.appendChild(iconBadge(tc)); n.appendChild(el("span",null,catName(t.cat))); L.appendChild(n);
      var sub=[]; if(t.note) sub.push(t.note); if(t.account) sub.push(accountName(t.account)); if(t.cur==="MYR") sub.push(rmf(t.orig));
      if(sub.length){ var s2=el("div","tiny dim",sub.join("  ·  ")); s2.style.marginTop="2px"; L.appendChild(s2); }
      btn.appendChild(L); btn.appendChild(el("span","tab",money(t.sgd))); btn.style.fontWeight="500";
      shell.appendChild(btn); body.appendChild(shell); setupTxnSwipe(shell,btn,t);
      rep.addEventListener("click",function(e){ e.stopPropagation(); shell.classList.remove("open"); haptic(7); logSpend(t.cat,t.cur==="MYR"?t.orig:t.sgd,t.cur,t.note||"",t.account||""); });
      del.addEventListener("click",function(e){ e.stopPropagation(); deleteTxn(t.id); });
    });
  });
}

function drawCalendar(){
  document.getElementById("hLabel").textContent=pLabel(hStart);
  var grid=document.getElementById("calendarGrid"), detail=document.getElementById("calendarDayDetail"); if(!grid)return;
  grid.innerHTML=""; detail.innerHTML="";
  var a=hStart,b=pShift(hStart,1), cursor=new Date(a), first=(a.getDay()+6)%7;
  for(var z=0;z<first;z++)grid.appendChild(el("span","calendar-blank"));
  while(cursor<b){
    (function(d){
      var ds=iso(d), sum=spent(d,new Date(d.getFullYear(),d.getMonth(),d.getDate()+1)), count=S.txns.filter(function(t){return t.date===ds;}).length;
      var cell=el("button","calendar-day"); if(ds===iso(today()))cell.classList.add("today"); if(sum>0)cell.classList.add("has-spend");
      cell.appendChild(el("span","calendar-num",String(d.getDate())));
      cell.appendChild(el("span","calendar-amt",sum>0?money(sum,false):""));
      if(count>0){var dots=el("span","calendar-dots"); for(var i=0;i<Math.min(3,count);i++)dots.appendChild(el("i")); cell.appendChild(dots);}
      cell.addEventListener("click",function(){
        Array.prototype.forEach.call(grid.querySelectorAll(".calendar-day.selected"),function(x){x.classList.remove("selected");}); cell.classList.add("selected");
        drawCalendarDay(ds,detail);
      });
      grid.appendChild(cell);
    })(new Date(cursor));
    cursor.setDate(cursor.getDate()+1);
  }
  var td=iso(today()); if(pIso(td)>=a&&pIso(td)<b){ var c=grid.querySelector('.calendar-day.today'); if(c){c.classList.add('selected');drawCalendarDay(td,detail);} }
}
function drawCalendarDay(ds,detail){
  detail.innerHTML=""; var list=S.txns.filter(function(t){return t.date===ds;}).slice().reverse();
  var head=el("div","calendar-detail-head"); head.appendChild(el("b",null,dayLab(ds))); head.appendChild(el("span","tab",money(list.reduce(function(a,t){return a+t.sgd;},0),false))); detail.appendChild(head);
  if(!list.length){detail.appendChild(el("div","empty compact","No spending logged on this day."));return;}
  list.forEach(function(t){var row=el("button","calendar-txn"),c=catOf(t.cat),l=el("span","calendar-txn-left");if(c)l.appendChild(iconBadge(c));var cp=el("span");cp.appendChild(el("b",null,catName(t.cat)));if(t.note||t.account)cp.appendChild(el("small",null,[t.note||"",t.account?accountName(t.account):""].filter(Boolean).join(" · ")));l.appendChild(cp);row.appendChild(l);row.appendChild(el("b","tab",money(t.sgd)));row.addEventListener("click",function(){openEdit(t.id);});detail.appendChild(row);});
}
function drawStats(){
  document.getElementById("hLabel").textContent=pLabel(hStart);
  var box=document.getElementById("statsBody"); if(!box)return; box.innerHTML="";
  var a=hStart,b=pShift(hStart,1), list=S.txns.filter(function(t){return inR(t,a,b);}), total=list.reduce(function(x,t){return x+t.sgd;},0);
  if(!list.length){box.appendChild(el("div","empty","Nothing to analyse in this period yet."));return;}
  var by={}; list.forEach(function(t){by[t.cat]=(by[t.cat]||0)+t.sgd;});
  var items=Object.keys(by).map(function(cid){return {cid:cid,amt:by[cid]};}).sort(function(x,y){return y.amt-x.amt;});
  var card=el("div","stats-card"), top=el("div","stats-top"), donut=el("div","donut"), center=el("div","donut-center");
  var pos=0, seg=[]; items.forEach(function(it){var pct=it.amt/total*100;seg.push(hueOf(it.cid)+" "+pos.toFixed(2)+"% "+(pos+pct).toFixed(2)+"%");pos+=pct;});
  donut.style.background="conic-gradient("+seg.join(",")+")"; center.appendChild(el("small",null,"Spent"));center.appendChild(el("b","tab",money(total,false)));donut.appendChild(center);top.appendChild(donut);
  var summary=el("div","stats-summary");summary.appendChild(el("span",null,list.length+(list.length===1?" transaction":" transactions")));summary.appendChild(el("b",null,items.length+" categories"));summary.appendChild(el("small",null,"Tap a category in List view to inspect entries."));top.appendChild(summary);card.appendChild(top);
  var cats=el("div","stats-cats");items.forEach(function(it){var c=catOf(it.cid),r=el("div","stats-cat"),l=el("span","stats-cat-left");if(c)l.appendChild(iconBadge(c));var tx=el("span");tx.appendChild(el("b",null,catName(it.cid)));tx.appendChild(el("small",null,Math.round(it.amt/total*100)+"% of spending"));l.appendChild(tx);r.appendChild(l);r.appendChild(el("b","tab",money(it.amt,false)));cats.appendChild(r);});card.appendChild(cats);box.appendChild(card);
  var trend=el("div","stats-card"), title=el("div","stats-title");title.appendChild(el("b",null,"Weekly pace"));title.appendChild(el("span",null,"within this budget period"));trend.appendChild(title);
  var bars=el("div","trend-bars"), vals=[], cur=new Date(a), wi=1;while(cur<b){var e=new Date(cur.getFullYear(),cur.getMonth(),cur.getDate()+7);if(e>b)e=b;vals.push({lab:"W"+wi,amt:spent(cur,e)});cur=e;wi++;}
  var mx=Math.max.apply(null,vals.map(function(v){return v.amt;}));vals.forEach(function(v){var col=el("div","trend-col"),bar=el("i","trend-bar");bar.style.height=(mx?Math.max(5,v.amt/mx*100):0)+"%";bar.title=money(v.amt);col.appendChild(el("span","trend-value tab",money(v.amt,false)));col.appendChild(bar);col.appendChild(el("small",null,v.lab));bars.appendChild(col);});trend.appendChild(bars);box.appendChild(trend);
}
function drawHist(){
  var cf=document.getElementById("hCatFilter"), af=document.getElementById("hAccountFilter");
  if(cf){var ck=cf.value;cf.innerHTML='<option value="">All envelopes</option>';S.cats.forEach(function(c){var o=document.createElement("option");o.value=c.id;o.textContent=c.name;cf.appendChild(o);});cf.value=ck;}
  if(af){var ak=af.value;af.innerHTML='<option value="">All accounts</option><option value="__none">Unassigned</option>';S.accounts.forEach(function(a){var o=document.createElement("option");o.value=a.id;o.textContent=a.name;af.appendChild(o);});af.value=ak;}
  var v=S.historyView||"list", lv=document.getElementById("historyListView"), cv=document.getElementById("historyCalendarView"), sv=document.getElementById("historyStatsView");
  if(lv)lv.hidden=v!=="list"; if(cv)cv.hidden=v!=="calendar"; if(sv)sv.hidden=v!=="stats";
  Array.prototype.forEach.call(document.querySelectorAll("[data-hview]"),function(b){b.setAttribute("aria-pressed",b.dataset.hview===v?"true":"false");});
  if(v==="calendar")drawCalendar(); else if(v==="stats")drawStats(); else drawHistoryList();
}

function setupTxnSwipe(shell,btn,t){
  var sx=0,sy=0,pid=null,moved=false,base=0;
  btn.addEventListener("pointerdown",function(e){ sx=e.clientX; sy=e.clientY; pid=e.pointerId; moved=false; base=shell.classList.contains("open")?-148:0; try{btn.setPointerCapture(pid);}catch(x){} });
  btn.addEventListener("pointermove",function(e){
    if(e.pointerId!==pid) return; var dx=e.clientX-sx, dy=e.clientY-sy;
    if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>8) return;
    if(Math.abs(dx)>5) moved=true;
    var x=Math.max(-148,Math.min(8,base+dx)); btn.style.transition="none"; btn.style.transform="translateX("+x+"px)"; if(moved)e.preventDefault();
  },{passive:false});
  function end(e){
    if(e.pointerId!==pid)return; var dx=e.clientX-sx, target=(base+dx)<-54?-148:0;
    btn.style.transition=""; btn.style.transform=""; shell.classList.toggle("open",target===-148); if(moved) btn.dataset.swiped=String(Date.now()); pid=null;
  }
  btn.addEventListener("pointerup",end); btn.addEventListener("pointercancel",end);
  btn.addEventListener("click",function(){ var sw=+(btn.dataset.swiped||0); if(Date.now()-sw<350)return; if(shell.classList.contains("open")){shell.classList.remove("open");return;} openEdit(t.id); });
}
function deleteTxn(id){
  var idx=-1,t=null; for(var i=0;i<S.txns.length;i++) if(S.txns[i].id===id){idx=i;t=S.txns[i];break;} if(!t)return;
  S.txns.splice(idx,1); save(); redraw(); haptic(10);
  toast("Deleted "+money(t.sgd),function(){ S.txns.splice(Math.min(idx,S.txns.length),0,t); save(); redraw(); toast("Restored"); });
}
function openEdit(id){
  var t=null; S.txns.forEach(function(x){ if(x.id===id) t=x; }); if(!t) return;
  var opts=S.cats.map(function(c){ return '<option value="'+c.id+'"'+(c.id===t.cat?" selected":"")+'>'+esc(c.name)+'</option>'; }).join("");
  openSheet('<div class="pull"></div><b style="font-size:17px">Edit this entry</b>'+
    '<div class="field" style="margin-top:14px"><label for="eA">Amount in Singapore dollars</label>'+
    '<input id="eA" type="text" inputmode="decimal" value="'+(t.sgd/100).toFixed(2)+'"></div>'+
    '<div class="field"><label for="eC">Envelope</label><select id="eC">'+opts+'</select></div>'+
    accountSelectHtml("eAccount",t.account||"","Paid from")+
    '<div class="field"><label for="eD">Date</label><input id="eD" type="date" value="'+t.date+'"></div>'+
    '<div class="field"><label for="eN">Notes</label>'+
    '<textarea id="eN" rows="3" placeholder="What was it for, who was there, why">'+esc(t.note||"")+'</textarea></div>'+
    '<button class="sm quick-bookmark" id="eQ" style="width:100%;margin-bottom:9px">'+iconSvg("spark","mini-svg")+' Save as Quick log</button>'+
    '<button class="go" id="eS">Save changes</button>'+
    '<div class="flex" style="gap:8px;margin-top:10px">'+
    '<button class="flat" id="eX" style="flex:1">Cancel</button>'+
    '<button class="flat danger" id="eK" style="flex:1">Delete</button></div>');
  document.getElementById("eX").onclick=shut;
  document.getElementById("eQ").onclick=function(){ addQuickLog(t.cat,t.cur==="MYR"?t.orig:t.sgd,t.cur||"SGD",t.note||"",t.account||""); save(); drawQuickLogs(); toast("Saved to Quick log"); };
  document.getElementById("eS").onclick=function(){
    var a=toCents(document.getElementById("eA").value);
    if(a<=0){ toast("Enter an amount above zero"); return; }
    t.sgd=a; t.cur="SGD"; t.orig=a; t.cat=document.getElementById("eC").value;
    t.date=document.getElementById("eD").value||t.date;
    t.note=document.getElementById("eN").value.trim(); var ea=document.getElementById("eAccount"); t.account=ea?ea.value:"";
    save(); shut(); redraw(); toast("Saved");
  };
  document.getElementById("eK").onclick=function(){
    if(!confirm("Delete this entry?")) return;
    S.txns=S.txns.filter(function(x){ return x.id!==id; }); save(); shut(); redraw(); toast("Deleted");
  };
}

/* ── setup ── */
function drawSetup(){
  var sel=document.getElementById("sStart");
  if(!sel.options.length){ for(var i=1;i<=28;i++){ var o=document.createElement("option"); o.value=i; o.textContent=i; sel.appendChild(o); } }
  sel.value=S.startDay||1;
  document.getElementById("sRate").value=S.rate;
  var hf=document.getElementById("hCatFilter");
  if(hf){ var keep=hf.value; hf.innerHTML='<option value="">All envelopes</option>'; S.cats.forEach(function(c){ var o=document.createElement("option"); o.value=c.id; o.textContent=c.name; hf.appendChild(o); }); hf.value=keep; }
  applyTheme(); applyAccent(); updateRecoveryState();
  var ed=document.getElementById("editor"); ed.innerHTML="";
  S.cats.forEach(function(c){
    var box=el("div","block"), r=el("div","flex");
    var nm=el("input"); nm.value=c.name; nm.style.flex="2";
    nm.addEventListener("change",function(){ c.name=nm.value.trim()||c.name; save(); redraw(); });
    var cp=el("input"); cp.type="text"; cp.inputMode="decimal"; cp.value=(c.cap/100).toFixed(0);
    cp.style.maxWidth="84px"; cp.style.textAlign="right";
    cp.addEventListener("change",function(){ c.cap=toCents(cp.value); save(); redraw(); });
    r.appendChild(nm); r.appendChild(cp); box.appendChild(r);
    var ip=el("div","icon-picker");
    ICON_NAMES.forEach(function(name){ var ib=el("button","icon-choice"); ib.type="button"; ib.innerHTML=iconSvg(name); ib.title=ICON_LABELS[name]||name; ib.setAttribute("aria-label",ib.title); ib.setAttribute("aria-pressed",(c.icon||"dots")===name?"true":"false"); ib.addEventListener("click",function(){c.icon=name;save();redraw();}); ip.appendChild(ib); });
    box.appendChild(ip);
    var q=el("input"); q.placeholder="One-tap amounts, such as 3,5,8,12";
    q.value=(c.quick||[]).map(function(v){return (v/100).toFixed(2).replace(/\.00$/,"");}).join(",");
    q.style.margin="9px 0";
    q.addEventListener("change",function(){
      c.quick=q.value.split(",").map(toCents).filter(function(x){return x>0;}).slice(0,4); save(); redraw(); });
    box.appendChild(q);
    var dl=el("button","sm danger","Remove");
    dl.addEventListener("click",function(){
      var n=S.txns.filter(function(t){return t.cat===c.id;}).length;
      if(n&&!confirm(n+" entries use this envelope. Remove it anyway?")) return;
      S.cats=S.cats.filter(function(x){return x.id!==c.id;}); save(); redraw(); });
    box.appendChild(dl); ed.appendChild(box);
  });
  document.getElementById("capTotal").textContent=money(capAll(),false);
  var n=S.txns.length;
  document.getElementById("cnt").textContent=n+(n===1?" entry logged":" entries logged");
  var sc=document.getElementById("shortcuts"); sc.innerHTML="";
  var base=location.href.split("?")[0];
  S.cats.slice(0,4).forEach(function(c){
    var v=(c.quick&&c.quick[0])||500;
    var d=el("div",null,c.name+" "+(v/100).toFixed(2)+" → "+base+"?log="+c.id+"&amt="+v);
    d.style.cssText="word-break:break-all;margin-bottom:7px;color:var(--dim)";
    sc.appendChild(d);
  });
  drawRecHist();
  var wb=document.getElementById("warnBox"); wb.innerHTML="";
  var le=document.getElementById("lastExp");
  if(S.lastExport){
    var ago=days(pIso(S.lastExport),today());
    le.textContent="Last export "+dayLab(S.lastExport).toLowerCase()+".";
    if(ago>=14&&n){ var w=el("div","block flag"); w.appendChild(el("div","tiny","No backup for "+ago+" days. Export it now, it takes one tap.")); wb.appendChild(w); }
  } else {
    le.textContent="You have not exported a backup yet.";
    if(n>=10){ var w2=el("div","block flag"); w2.appendChild(el("div","tiny","No backup yet. Export it now, it takes one tap.")); wb.appendChild(w2); }
  }
}
function download(name,text,type){
  var b=new Blob([text],{type:type}),u=URL.createObjectURL(b),a=document.createElement("a");
  a.href=u; a.download=name; document.body.appendChild(a); a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(u); },400);
  S.lastExport=iso(today()); save(); drawSetup();
}

function go(v){
  var tabs=["spend","plan","history","setup"];
  tabs.forEach(function(x){ document.getElementById("v-"+x).classList.toggle("on",x===v); });
  Array.prototype.forEach.call(document.querySelectorAll(".nav button"),function(b){ b.setAttribute("aria-current",b.dataset.go===v); });
  var ni=document.getElementById("navIndicator"), ix=tabs.indexOf(v); if(ni&&ix>=0) ni.style.transform="translateX("+(ix*100)+"%)";
  window.scrollTo(0,0);
  if(v==="history"){ hStart=pStart(today()); drawHist(); }
  if(v==="plan") drawPlan();
  if(v==="setup") drawSetup();
}
Array.prototype.forEach.call(document.querySelectorAll(".nav button"),function(b){
  b.addEventListener("click",function(){ haptic(5); go(b.dataset.go); }); });
document.getElementById("mWeek").addEventListener("click",function(){ S.mode="week"; save(); redraw(); });
document.getElementById("mPeriod").addEventListener("click",function(){ S.mode="period"; save(); redraw(); });
document.getElementById("hPrev").addEventListener("click",function(){ hStart=pShift(hStart,-1); drawHist(); });
document.getElementById("hNext").addEventListener("click",function(){ hStart=pShift(hStart,1); drawHist(); });
document.getElementById("sStart").addEventListener("change",function(){ S.startDay=parseInt(this.value,10)||1; save(); hStart=pStart(today()); redraw(); });
document.getElementById("sRate").addEventListener("change",function(){ var r=parseFloat(this.value); S.rate=(r>0?r:3.35); save(); redraw(); });
document.getElementById("addCat").addEventListener("click",function(){
  var i=document.getElementById("newCat"), v=i.value.trim(); if(!v) return;
  S.cats.push({id:"c"+Date.now(),name:v,icon:"dots",cap:0,quick:[500,1000,2000,5000]}); i.value=""; save(); redraw(); });
document.getElementById("addAccount").addEventListener("click",function(){openAccount();});
document.getElementById("addRecurring").addEventListener("click",function(){openRecurring();});
document.getElementById("commitmentNote").addEventListener("click",function(){go("plan");});
document.getElementById("addDebt").addEventListener("click",function(){
  var i=document.getElementById("newDebt"), v=i.value.trim(); if(!v) return;
  S.debts.push({id:"d"+Date.now(),name:v,start:0,bal:0,rate:0}); i.value=""; save(); redraw();
  toast("Tap it to set the balance"); });
document.getElementById("recNow").addEventListener("click",function(){ openRec(lastClosedPeriod()); });
document.getElementById("expJson").addEventListener("click",function(){
  download("budget-margin-backup-"+iso(today())+".json",JSON.stringify(S),"application/json"); toast("Backup exported"); });
document.getElementById("expCsv").addEventListener("click",function(){
  var l=["date,sgd,currency,original,envelope,account,notes"];
  S.txns.forEach(function(t){ l.push([t.date,(t.sgd/100).toFixed(2),t.cur,(t.orig/100).toFixed(2),
    '"'+catName(t.cat).replace(/"/g,'""')+'"','"'+accountName(t.account||"").replace(/"/g,'""')+'"','"'+String(t.note||"").replace(/"/g,'""')+'"'].join(",")); });
  download("budget-margin-"+iso(today())+".csv",l.join("\n"),"text/csv"); toast("CSV exported"); });
document.getElementById("impBtn").addEventListener("click",function(){ document.getElementById("impFile").click(); });
document.getElementById("impFile").addEventListener("change",function(){
  var f=this.files[0]; if(!f) return; var r=new FileReader();
  r.onload=function(){
    try{
      var p=JSON.parse(r.result);
      if(!p||!Array.isArray(p.txns)||!Array.isArray(p.cats)) throw 0;
      if(!confirm("Replace everything on this phone with the backup, which holds "+p.txns.length+" entries?")) return;
      S=p; if(!S.accent)S.accent="jade"; if(!S.theme)S.theme="midnight"; if(!S.historyView)S.historyView="list"; if(!Array.isArray(S.bookmarks))S.bookmarks=[]; if(!Array.isArray(S.accounts))S.accounts=[]; if(!Array.isArray(S.recurring))S.recurring=[]; if(!S.recurringDone||typeof S.recurringDone!=="object")S.recurringDone={}; if(!S.defaultAccount)S.defaultAccount=""; var defs=["fork","cart","cup","car","bag","spark","dots"]; S.cats.forEach(function(c,i){if(!c.icon)c.icon=defs[i%defs.length];}); save(); hStart=pStart(today()); redraw(); toast("Backup restored");
    }catch(e){ toast("That file is not a Budget Margin backup"); }
  };
  r.readAsText(f); this.value=""; });
document.getElementById("wipe").addEventListener("click",function(){
  if(!confirm("Erase every entry and setting on this phone?")) return;
  if(!confirm("This cannot be undone. Export a backup first if you are unsure.")) return;
  S=blank(); save(); hStart=pStart(today()); redraw(); go("spend"); toast("Erased"); });

document.getElementById("seeHistory").addEventListener("click",function(){ go("history"); });
document.getElementById("reorderToggle").addEventListener("click",function(){ setReorderMode(!reorderMode); haptic(5); });
Array.prototype.forEach.call(document.querySelectorAll("[data-hview]"),function(b){ b.addEventListener("click",function(){ S.historyView=b.dataset.hview; save(); drawHist(); haptic(4); }); });
document.getElementById("hSearch").addEventListener("input",drawHist);
document.getElementById("hCatFilter").addEventListener("change",drawHist);
document.getElementById("hAccountFilter").addEventListener("change",drawHist);
Array.prototype.forEach.call(document.querySelectorAll(".theme-choice"),function(b){
  b.addEventListener("click",function(){ S.theme=b.dataset.theme; if(S.theme==="coral"&&S.accent==="jade")S.accent="pink"; save(); applyTheme(); applyAccent(); haptic(5); });
});
Array.prototype.forEach.call(document.querySelectorAll(".accent-dot"),function(b){
  b.addEventListener("click",function(){ S.accent=b.dataset.accent; save(); applyAccent(); haptic(5); });
});
document.getElementById("recoverPrev").addEventListener("click",function(){
  var raw=null; try{raw=localStorage.getItem(PREV_KEY);}catch(e){}
  if(!raw){toast("No previous local state is available");return;}
  if(!confirm("Replace the current state with the previous locally saved state?"))return;
  try{ var p=JSON.parse(raw); if(!p||!Array.isArray(p.txns)||!Array.isArray(p.cats))throw 0; S=p; if(!S.accent)S.accent="jade"; if(!S.theme)S.theme="midnight"; if(!S.historyView)S.historyView="list"; if(!Array.isArray(S.bookmarks))S.bookmarks=[]; if(!Array.isArray(S.accounts))S.accounts=[]; if(!Array.isArray(S.recurring))S.recurring=[]; if(!S.recurringDone||typeof S.recurringDone!=="object")S.recurringDone={}; if(!S.defaultAccount)S.defaultAccount=""; localStorage.setItem(KEY,JSON.stringify(S)); redraw(); toast("Previous state recovered"); }
  catch(e){toast("The previous local state could not be recovered");}
});
document.getElementById("checkUpdate").addEventListener("click",function(){
  if(updateReady&&swReg&&swReg.waiting){ swReg.waiting.postMessage({type:"SKIP_WAITING"}); return; }
  if(swReg){ document.getElementById("updateText").textContent="Checking…"; swReg.update().then(function(){ setTimeout(function(){ if(!updateReady){document.getElementById("updateText").textContent="You already have the latest Budget Margin 2.1 files.";} },500); }).catch(function(){toast("Could not check for updates");}); }
  else toast("Update checks work after Budget Margin is served over HTTPS");
});

/* one-tap logging from a home screen shortcut */
function handleURL(){
  var q=location.search; if(!q) return;
  var p={}; q.replace(/^\?/,"").split("&").forEach(function(kv){
    var a=kv.split("="); if(a[0]) p[decodeURIComponent(a[0])]=decodeURIComponent(a[1]||""); });
  if(!p.log||!p.amt) return;
  var c=catOf(p.log), amt=parseInt(p.amt,10);
  if(c&&amt>0) logSpend(c.id,amt,p.cur==="MYR"?"MYR":"SGD","",S.defaultAccount||"");
  else toast("That shortcut does not match an envelope");
  if(history.replaceState) history.replaceState({},"",location.pathname);
}


var swReg=null, updateReady=false;
function updatePwaState(){
  var box=document.getElementById("pwaState"); if(!box)return;
  var standalone=(window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches)||window.navigator.standalone===true;
  var secure=location.protocol==="https:"||location.hostname==="localhost";
  var online=navigator.onLine!==false;
  box.classList.toggle("ready",standalone&&secure);
  document.getElementById("pwaTitle").textContent=standalone?"Home Screen app":"Browser mode";
  document.getElementById("pwaText").textContent=!secure?"Publish through HTTPS (GitHub Pages works) to unlock offline app caching.":standalone?(online?"Installed and ready. Your data remains local on this device.":"Offline — Budget Margin is running from its cached app shell."):"Add Budget Margin to your Home Screen for a standalone app experience.";
  var u=document.getElementById("updateText"), b=document.getElementById("checkUpdate");
  if(u)u.textContent=updateReady?"Budget Margin 2.1 update ready — apply it now.":(online?"Budget Margin 2.1 · updates checked when the app opens.":"Offline · update check paused.");
  if(b)b.textContent=updateReady?"Update":"Check now";
}
function watchWorker(reg){
  swReg=reg;
  if(reg.waiting){ updateReady=true; updatePwaState(); }
  reg.addEventListener("updatefound",function(){
    var w=reg.installing; if(!w)return;
    w.addEventListener("statechange",function(){
      if(w.state==="installed"&&navigator.serviceWorker.controller){ updateReady=true; updatePwaState(); toast("App update ready"); }
    });
  });
}
window.addEventListener("online",updatePwaState); window.addEventListener("offline",updatePwaState);
if("serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost")){
  window.addEventListener("load",function(){ navigator.serviceWorker.register("./sw.js").then(function(reg){watchWorker(reg);updatePwaState();}).catch(updatePwaState); });
  navigator.serviceWorker.addEventListener("controllerchange",function(){ if(updateReady) location.reload(); });
}

function redraw(){ applyTheme(); applyAccent(); drawGauge(); drawList(); drawQuickLogs(); drawRecent(); drawRecPrompt(); drawPlan(); drawDebt(); drawHist(); drawSetup(); updatePwaState(); setReorderMode(false); }
redraw(); go("spend"); handleURL();
})();
