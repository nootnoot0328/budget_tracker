(function(){
"use strict";
var KEY="margin.v2", PREV_KEY="margin.v2.prev", APP_VERSION="3.4", ARC=386.4, FULL=515.2;
var HUES=["--jade","--cyan","--amber","--violet","--pink","--lime","--blue","--coral"];

function blank(){
  return {
    v:2, rate:3.35, startDay:25, dailyCap:0, debtPlan:{strategy:"avalanche",monthlyBudget:0}, mode:"period", accent:"jade", theme:"midnight", historyView:"list", lastExport:null, nextId:100,
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
    txns:[], pays:[], recs:[], bookmarks:[], accounts:[], recurring:[], recurringDone:{}, defaultAccount:"", ledger:[], goals:[], goalContrib:[], imports:[], merchantRules:{}, captures:[], historicalImports:[]
  };
}
var S=load();
var lmOpenEnvelope=null, lmIsolatedCategory=null, lmSelectedDay=null, lmActiveMonth=-1;
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
    if(!Array.isArray(p.ledger))p.ledger=[];
    if(!Array.isArray(p.goals))p.goals=[];
    if(!Array.isArray(p.goalContrib))p.goalContrib=[];
    if(!Array.isArray(p.imports))p.imports=[];
    if(!p.merchantRules||typeof p.merchantRules!=="object")p.merchantRules={};
    if(!Array.isArray(p.captures))p.captures=[];
    if(!Array.isArray(p.historicalImports))p.historicalImports=[];
    if(p.dailyCap==null)p.dailyCap=0;
    if(!p.debtPlan||typeof p.debtPlan!=="object")p.debtPlan={strategy:"avalanche",monthlyBudget:0};
    if(!p.debtPlan.strategy)p.debtPlan.strategy="avalanche";
    if(p.debtPlan.monthlyBudget==null)p.debtPlan.monthlyBudget=0;
    p.debts.forEach(function(d){if(d.minPay==null)d.minPay=0;});
    p.accounts.forEach(function(a){
      if(a.baseBalance==null)a.baseBalance=a.balance||0;
      if(!a.snapshotAt)a.snapshotAt=Date.now();
    });
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
function rmf(c){ return (c<0?"-":"")+"RM"+grp((Math.abs(c)/100).toFixed(2)); }
function accountMoney(c,cur,dec){
  cur=(cur||"SGD").toUpperCase();var v=Math.abs(Math.round(c)),sign=c<0?"-":"";
  var n=dec===false?grp(String(Math.round(v/100))):grp((v/100).toFixed(2));
  return sign+(cur==="MYR"?"RM":cur==="SGD"?"S$":cur+" ")+n;
}
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
function accountTypeLabel(t){ return t==="credit"?"Credit card":t==="cash"?"Cash":t==="loan"?"Loan":"Bank account"; }
function ledgerAmountSgd(x){ return x.cur==="MYR"?Math.round((x.amount||0)/(S.rate||3.35)):(x.amount||0); }
function accountCurrent(a){
  var v=(a.baseBalance!=null?a.baseBalance:(a.balance||0)), snap=a.snapshotAt||0;
  S.txns.forEach(function(t){
    if(t.account!==a.id||t.source==="historical_import"||!t.createdAt||t.createdAt<=snap)return;
    v += a.type==="credit" ? (t.sgd||0) : -(t.sgd||0);
  });
  S.ledger.forEach(function(x){
    if(x.source==="historical_import"||!x.createdAt||x.createdAt<=snap)return;
    var amt=ledgerAmountSgd(x);
    if(x.type==="income"&&x.account===a.id) v += a.type==="credit"?-amt:amt;
    else if(x.type==="expense"&&x.account===a.id) v += a.type==="credit"?amt:-amt;
    else if(x.type==="refund"&&x.account===a.id) v += a.type==="credit"?-amt:amt;
    else if(x.type==="transfer"){
      if(x.from===a.id) v += a.type==="credit"?0:-amt;
      if(x.to===a.id) v += a.type==="credit"?0:amt;
    } else if(x.type==="card_payment"){
      if(x.from===a.id) v -= amt;
      if(x.to===a.id) v -= amt;
    } else if(x.type==="adjustment"&&x.account===a.id) v += (x.delta||0);
    else if(x.type==="goal"&&x.account===a.id) v -= amt;
  });
  return Math.round(v);
}
function liquidTotals(){
  var liquid=0, credit=0, loans=0;
  S.accounts.forEach(function(a){
    var v=accountCurrent(a),sgd=(a.currency||"SGD").toUpperCase()==="MYR"?Math.round(v/(S.rate||3.35)):v;
    if(a.type==="credit")credit+=Math.abs(sgd);else if(a.type==="loan")loans+=Math.abs(sgd);else liquid+=sgd;
  });
  return {liquid:liquid,credit:credit,loans:loans,net:liquid-credit-loans};
}
function goalReserveCurrent(){
  var ps=pStart(today()), pe=pShift(ps,1), due=0;
  S.goals.filter(function(g){return g.active!==false;}).forEach(function(g){
    var wanted=g.periodContribution||0, paid=0;
    S.goalContrib.forEach(function(c){if(c.goal===g.id&&pIso(c.date)>=ps&&pIso(c.date)<pe)paid+=c.amount||0;});
    due+=Math.max(0,wanted-paid);
  });
  return due;
}

/* today budget. Optional explicit daily cap; otherwise prorated from the period cap. */
function dayBudget(){
  var ps=pStart(today()),pe=pShift(ps,1),pd=Math.max(1,days(ps,pe)),periodCap=capAll();
  var cap=S.dailyCap>0?S.dailyCap:(periodCap/pd);
  var a=today(),b=new Date(a.getFullYear(),a.getMonth(),a.getDate()+1);
  return {ps:ps,pe:pe,a:a,b:b,budget:cap,sp:spent(a,b),periodCap:periodCap,pd:pd};
}

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
  if(S.mode==="day"){var db=dayBudget();cap=db.budget;sp=db.sp;left=cap-sp;dl=1;lab="left today";ps=db.a;pe=db.b;}
  else if(S.mode==="week"){var wb=weekBudget();cap=wb.budget;sp=wb.sp;left=cap-sp;dl=Math.max(1,days(today(),wb.w.we));lab="left this week";ps=wb.w.ws;pe=wb.w.we;}
  else{ps=pStart(today());pe=pShift(ps,1);cap=capAll();sp=spent(ps,pe);left=cap-sp;dl=Math.max(1,days(today(),pe));lab="left · "+pLabel(ps);}
  pd=Math.max(1,days(ps,pe));elapsed=Math.max(0,Math.min(pd,days(ps,today())+1));
  var safe=document.getElementById("safeToday"),pspent=document.getElementById("periodSpent"),reset=document.getElementById("daysReset"),actual=document.getElementById("paceActual"),marker=document.getElementById("paceMarker"),status=document.getElementById("paceStatus"),pct=document.getElementById("pacePercent"),v=document.getElementById("gauge");
  if(v&&window.LM&&!v.dataset.lmMounted){LM.mountFill(v,{colors:['color-mix(in srgb,var(--accent) 38%,transparent)','color-mix(in srgb,var(--cyan) 26%,transparent)']});v.dataset.lmMounted='1';}
  document.getElementById("mDay").setAttribute("aria-pressed",S.mode==="day");document.getElementById("mWeek").setAttribute("aria-pressed",S.mode==="week");document.getElementById("mPeriod").setAttribute("aria-pressed",S.mode==="period");
  if(cap<=0){if(window.LM&&v)LM.setFill(v,0,false);document.getElementById("gAmt").textContent="0";document.getElementById("gCap").textContent="No budget set yet";document.getElementById("gPace").textContent="Open Setup and give each envelope a cap";if(safe)safe.textContent="—";if(pspent)pspent.textContent=money(sp,false);if(reset)reset.textContent=dl+(dl===1?" day":" days");if(actual)actual.style.width="0%";if(marker)marker.style.left="0%";if(status)status.textContent="Set your envelope caps to start.";if(pct)pct.textContent="";document.getElementById('lmSpentText').textContent='Spent '+money(sp,false);document.getElementById('lmCapText').textContent='Cap —';return;}
  var used=sp/cap,remain=Math.max(0,Math.min(1,1-used));document.documentElement.style.setProperty("--sig",tone(used));if(window.LM&&v)LM.setFill(v,remain,false);v.classList.toggle('over',left<0);
  var gAmt=document.getElementById('gAmt'),from=parseInt((gAmt.textContent||'0').replace(/[^0-9]/g,''),10)*100||0,to=Math.abs(left);if(window.LM)LM.countUp(gAmt,from,to,650,function(n){return grp(String(Math.round(n/100)));});else gAmt.textContent=grp(String(Math.round(to/100)));
  document.getElementById("gCap").textContent=left<0?money(-left,false)+" over":lab;var reserveNow=reservedCommitments(ps,pe),freeNow=left-reserveNow.amount;document.getElementById("gPace").textContent=left<0?"Resets in "+dl+" "+(dl===1?"day":"days"):(reserveNow.amount?money(Math.max(0,freeNow)/dl,false)+" a day after reserved bills":money(left/dl,false)+" a day for "+dl+" more "+(dl===1?"day":"days"));
  document.getElementById('lmSpentText').textContent='Spent '+money(sp,false);document.getElementById('lmCapText').textContent='Cap '+money(cap,false);
  var reserve=reservedCommitments(ps,pe),goalReserve=goalReserveCurrent(),freeAfter=left-reserve.amount-goalReserve;if(safe)safe.textContent=freeAfter>0?money(freeAfter/dl,false):"S$0";var cn=document.getElementById("commitmentNote");if(cn){var reservedTotal=reserve.amount+goalReserve;if(reservedTotal){cn.hidden=false;cn.innerHTML=iconSvg("calendar","mini-svg")+" "+money(reservedTotal,false)+" reserved for upcoming commitments and goals · view Plan";}else cn.hidden=true;}if(pspent)pspent.textContent=money(sp,false);if(reset)reset.textContent=dl+(dl===1?" day":" days");
  var ideal=Math.min(1,elapsed/pd),paceDelta=sp-(cap*ideal),usedClamp=Math.max(0,Math.min(1,used));if(actual)actual.style.width=(usedClamp*100).toFixed(1)+"%";if(marker)marker.style.left=(ideal*100).toFixed(1)+"%";if(status){if(Math.abs(paceDelta)<Math.max(500,cap*.015))status.textContent="Right on budget pace";else if(paceDelta>0)status.textContent=money(paceDelta,false)+" ahead of spending pace";else status.textContent=money(-paceDelta,false)+" under spending pace";}if(pct)pct.textContent=Math.round(used*100)+"% used";
} 
function drawList(){
  var box=document.getElementById("list");box.innerHTML="";var a,b,scale=1;if(S.mode==="day"){var db=dayBudget();a=db.a;b=db.b;scale=capAll()>0?db.budget/capAll():1/db.pd;}else if(S.mode==="week"){var w=weekWin();a=w.ws;b=w.we;scale=days(w.ws,w.we)/days(w.ps,w.pe);}else{a=pStart(today());b=pShift(a,1);}
  S.cats.forEach(function(c,idx){var cap=(c.cap||0)*scale,sp=spent(a,b,c.id),left=cap-sp,f=cap>0?sp/cap:0,wrap=el("div","envelope-wrap lm-rise");wrap.dataset.cid=c.id;wrap.style.animationDelay=(idx*24)+'ms';var btn=el("button","row lm-envelope-row"),top=el("div","top"),nm=el("span","nm"),gh=grip();nm.appendChild(gh);var dot=el('span','dot');dot.style.background=hueOf(c.id);dot.style.color=hueOf(c.id);nm.appendChild(dot);nm.appendChild(el("span",null,c.name));var r=el("span","rm tab");if(cap<=0){r.textContent="Set cap";r.style.color="var(--faint)";}else{r.style.color=(cap>0&&left/cap<.12)?"var(--coral)":"var(--ivory)";r.textContent=money(Math.abs(left),false)+(left<0?" over":"");}top.appendChild(nm);top.appendChild(r);btn.appendChild(top);var ru=el("div","rule"),fi=el("i");fi.style.width=cap<=0?"0%":Math.max(0,Math.min(100,f*100))+"%";fi.style.background=(cap>0&&f>=1)?"var(--coral)":hueOf(c.id);var sheen=el('span','lm-sheen');fi.appendChild(sheen);ru.appendChild(fi);btn.appendChild(ru);var meta=el("div","envelope-meta");meta.appendChild(el("span",null,cap>0?money(sp,false)+" spent":"No cap yet"));meta.appendChild(el("span",null,cap>0?money(cap,false)+" budget":"Tap Setup to set one"));btn.appendChild(meta);btn.addEventListener("click",function(){if(reorderMode||Date.now()<suppressEnvelopeClick)return;lmOpenEnvelope=lmOpenEnvelope===c.id?null:c.id;drawList();});wrap.appendChild(btn);
    if(lmOpenEnvelope===c.id&&!reorderMode){var q=el('div','lm-quick-row lm-rise');[5,10,20,50].forEach(function(n){var bq=el('button','lm-quick-pill','+'+n);bq.onclick=function(e){e.stopPropagation();logSpend(c.id,n*100,'SGD','',S.defaultAccount||'');};q.appendChild(bq);});var custom=el('button','lm-quick-pill','Custom');custom.onclick=function(e){e.stopPropagation();openSpend(c.id);};q.appendChild(custom);wrap.appendChild(q);}box.appendChild(wrap);setupEnvelopeDrag(wrap,gh);});
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
  var pull=sb.querySelector(".pull");
  if(pull){
    var zone=document.createElement("div"); zone.className="sheet-grab-zone";
    pull.parentNode.insertBefore(zone,pull); zone.appendChild(pull);
    zone.appendChild(el("div","sheethint","swipe down to close")); var xc=el("button","sheet-close","×"); xc.type="button"; xc.setAttribute("aria-label","Close"); xc.addEventListener("click",function(e){e.stopPropagation();shut();}); zone.appendChild(xc);
  }
  sb.style.removeProperty("--sheet-drag"); document.getElementById("sheet").classList.add("on");
}
function shut(){
  var sh=document.getElementById("sheet"), sb=document.getElementById("sheetBody");
  sh.classList.remove("dragging"); sb.style.removeProperty("--sheet-drag"); sh.classList.remove("on");
}
document.getElementById("sheet").addEventListener("click",function(e){ if(e.target.id==="sheet") shut(); });
var sheetDrag={on:false,startY:0,lastY:0,lastT:0,velocity:0,pid:null,touch:false};
function beginSheetDrag(y,pid,touch){
  sheetDrag.on=true;sheetDrag.startY=y;sheetDrag.lastY=y;sheetDrag.lastT=performance.now();sheetDrag.velocity=0;sheetDrag.pid=pid;sheetDrag.touch=!!touch;
  document.getElementById("sheet").classList.add("dragging");
}
function moveSheetDrag(y){
  if(!sheetDrag.on)return;
  var dy=Math.max(0,y-sheetDrag.startY),now=performance.now(),dt=Math.max(1,now-sheetDrag.lastT);
  sheetDrag.velocity=(y-sheetDrag.lastY)/dt;sheetDrag.lastY=y;sheetDrag.lastT=now;
  document.getElementById("sheetBody").style.setProperty("--sheet-drag",dy+"px");
}
function endSheetDrag(y){
  if(!sheetDrag.on)return;
  var dy=Math.max(0,y-sheetDrag.startY),close=dy>72||sheetDrag.velocity>.48;
  sheetDrag.on=false;document.getElementById("sheet").classList.remove("dragging");
  document.getElementById("sheetBody").style.removeProperty("--sheet-drag");
  if(close){haptic(7);shut();}
}
document.getElementById("sheetBody").addEventListener("pointerdown",function(e){
  if(!e.target.closest||!e.target.closest(".sheet-grab-zone"))return;
  beginSheetDrag(e.clientY,e.pointerId,false);try{this.setPointerCapture(e.pointerId);}catch(x){}e.preventDefault();
},{passive:false});
document.getElementById("sheetBody").addEventListener("pointermove",function(e){
  if(!sheetDrag.on||sheetDrag.touch||e.pointerId!==sheetDrag.pid)return;moveSheetDrag(e.clientY);e.preventDefault();
},{passive:false});
document.getElementById("sheetBody").addEventListener("pointerup",function(e){if(sheetDrag.on&&!sheetDrag.touch&&e.pointerId===sheetDrag.pid)endSheetDrag(e.clientY);},{passive:false});
document.getElementById("sheetBody").addEventListener("pointercancel",function(e){if(sheetDrag.on&&!sheetDrag.touch&&e.pointerId===sheetDrag.pid)endSheetDrag(e.clientY);},{passive:false});
document.getElementById("sheetBody").addEventListener("touchstart",function(e){
  if(!e.target.closest||!e.target.closest(".sheet-grab-zone")||e.target.closest(".sheet-close")||!e.touches.length)return;
  beginSheetDrag(e.touches[0].clientY,null,true);e.preventDefault();
},{passive:false});
document.addEventListener("touchmove",function(e){
  if(!sheetDrag.on||!sheetDrag.touch||!e.touches.length)return;moveSheetDrag(e.touches[0].clientY);e.preventDefault();
},{passive:false});
document.addEventListener("touchend",function(e){
  if(!sheetDrag.on||!sheetDrag.touch)return;var y=e.changedTouches&&e.changedTouches[0]?e.changedTouches[0].clientY:sheetDrag.lastY;endSheetDrag(y);e.preventDefault();
},{passive:false});
document.addEventListener("touchcancel",function(){if(sheetDrag.on&&sheetDrag.touch)endSheetDrag(sheetDrag.lastY);},{passive:false});
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
  S.txns.push({id:id,date:iso(today()),sgd:s,cur:cur,orig:amtCents,cat:cid,note:(note||"").trim(),account:account||"",createdAt:Date.now()});
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


/* ── notification capture inbox (3.2) ── */
function captureCurrency(s){s=String(s||"").toUpperCase();return /\b(MYR|RM)\b/.test(s)?"MYR":"SGD";}
function parseNotificationText(raw,meta){
  raw=String(raw||"").replace(/\r/g,"").trim(); meta=meta||{};
  var cur=captureCurrency((meta.cur||"")+" "+raw), amount=0;
  var pats=cur==="MYR"?[/(?:MYR|RM)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i]:[/(?:SGD|S\$|\$)\s*([0-9][0-9,]*(?:\.\d{1,2})?)/i];
  for(var i=0;i<pats.length;i++){var m=raw.match(pats[i]);if(m){amount=Math.round(parseFloat(m[1].replace(/,/g,""))*100);break;}}
  if(meta.amount){var x=parseFloat(String(meta.amount).replace(/[^0-9.]/g,""));if(isFinite(x)&&x>0)amount=Math.round(x*100);}
  var lines=raw.split(/\n+/).map(function(x){return x.trim();}).filter(Boolean),merchant=(meta.merchant||"").trim();
  if(!merchant){
    for(var j=0;j<lines.length;j++){
      var ln=lines[j]; if(/^(DBS|POSB|UOB|HSBC|CIMB|OCBC)\b/i.test(ln)&&ln.length<28)continue;
      if(/(?:SGD|S\$|MYR|RM|\$)\s*[0-9]/i.test(ln))continue;
      if(/^(payment|transaction|card|spent|charged|purchase)\b/i.test(ln)&&ln.length<35)continue;
      merchant=ln.replace(/,\s*(Singapore|SG).*$/i,"").trim(); if(merchant)break;
    }
  }
  if(!merchant)merchant="Unknown merchant";
  var app=(meta.app||meta.source||"").trim(),aid="";
  if(app){var ak=app.toUpperCase();S.accounts.some(function(a){var n=a.name.toUpperCase();if(n.indexOf(ak)>=0||ak.indexOf(n.split(/\s+/)[0])>=0){aid=a.id;return true;}return false;});}
  var cat=ruleCategory(merchant)||ruleCategory(raw)||"";
  return {merchant:merchant,amount:amount,cur:cur,account:aid,cat:cat,raw:raw,app:app||"Notification",timestamp:meta.timestamp||new Date().toISOString()};
}
function captureFingerprint(c){
  var t=new Date(c.timestamp||Date.now()),bucket=isNaN(t)?String(c.timestamp||""):t.toISOString().slice(0,16);
  return [String(c.app||"").toUpperCase(),merchantKey(c.merchant||c.raw),c.cur,c.amount,bucket].join("|");
}
function addCapture(c){
  if(!c||!(c.amount>0)){toast("Could not find a payment amount in that notification");return false;}
  c.id=c.id||"n"+Date.now();c.status="pending";c.fingerprint=captureFingerprint(c);c.createdAt=Date.now();
  if(S.captures.some(function(x){return x.fingerprint===c.fingerprint;})){toast("That notification is already in the inbox");return false;}
  S.captures.unshift(c);save();redraw();toast("Payment added to Capture inbox");return true;
}
function pendingCaptures(){return (S.captures||[]).filter(function(c){return c.status==="pending";});}
function drawCaptureInbox(){
  var box=document.getElementById("captureInbox"),count=document.getElementById("captureCount");if(!box)return;box.innerHTML="";
  var list=pendingCaptures();if(count)count.textContent=list.length+(list.length===1?" waiting":" waiting");
  if(!list.length){box.appendChild(el("div","capture-empty","Bank-notification captures will wait here for one-tap confirmation."));return;}
  list.slice(0,6).forEach(function(c){
    var b=el("button","capture-card"),left=el("span","capture-left"),app=el("span","capture-app",String(c.app||"BANK").replace(/\s+.*/,"").slice(0,4).toUpperCase()),copy=el("span","capture-copy");
    copy.appendChild(el("b",null,c.merchant||"Unknown merchant"));copy.appendChild(el("span",null,(c.account?accountName(c.account):"Choose account")+" · "+dateShort((c.timestamp||"").slice(0,10)||iso(today()))));left.appendChild(app);left.appendChild(copy);b.appendChild(left);
    b.appendChild(el("span","capture-amt tab",c.cur==="MYR"?rmf(c.amount):money(c.amount)));b.onclick=function(){openCapture(c.id);};box.appendChild(b);
  });
}
function openCapture(id){
  var c=(S.captures||[]).find(function(x){return x.id===id;});if(!c)return;
  var cat=c.cat||ruleCategory(c.merchant||c.raw)||((S.cats[0]||{}).id||"");
  var copts=S.cats.map(function(x){return '<option value="'+x.id+'"'+(x.id===cat?' selected':'')+'>'+esc(x.name)+'</option>';}).join("");
  openSheet('<div class="pull"></div><b style="font-size:17px">Confirm captured payment</b><div class="capture-parse"><b>'+esc(c.merchant||"Unknown merchant")+'</b><small>'+esc(c.app||"Notification")+' · '+(c.cur==="MYR"?rmf(c.amount):money(c.amount))+'</small></div>'+accountSelectHtml("capAccount",c.account||S.defaultAccount||"","Paid from")+'<div class="field"><label for="capCat">Envelope</label><select id="capCat">'+copts+'</select></div><label class="toggle-row compact"><input id="capRemember" type="checkbox" checked><span><b>Remember this merchant</b><small>Suggest this envelope next time.</small></span></label><button class="go" id="capConfirm">Confirm spending</button><button class="sm" id="capMovement" style="width:100%;margin-top:8px">Transfer / card payment</button><button class="flat" id="capIgnore">Ignore</button>');
  document.getElementById("capConfirm").onclick=function(){var aid=document.getElementById("capAccount").value,catid=document.getElementById("capCat").value,sgd=c.cur==="MYR"?Math.round(c.amount/S.rate):c.amount;S.txns.push({id:uid(),date:(c.timestamp||iso(today())).slice(0,10),sgd:sgd,cur:c.cur,orig:c.amount,cat:catid,note:c.merchant,account:aid,createdAt:Date.now(),source:"notification",captureId:c.id});if(document.getElementById("capRemember").checked)rememberRule(c.merchant,catid);if(aid)S.defaultAccount=aid;c.status="confirmed";save();shut();redraw();toast("Captured payment logged");};
  document.getElementById("capMovement").onclick=function(){openCaptureMovement(c);};
  document.getElementById("capIgnore").onclick=function(){c.status="ignored";save();shut();redraw();toast("Capture ignored");};
}
function openCaptureMovement(c){
  var opts=ledgerAccountOptions("","Choose other account");openSheet('<div class="pull"></div><b style="font-size:17px">Classify captured movement</b><p class="hint">'+esc(c.merchant)+' · '+(c.cur==="MYR"?rmf(c.amount):money(c.amount))+'</p><div class="field"><label for="cmType">Type</label><select id="cmType"><option value="transfer">Transfer between my accounts</option><option value="card_payment">Credit-card payment</option><option value="expense">Fee / non-budget expense</option></select></div>'+accountSelectHtml("cmFrom",c.account||S.defaultAccount||"","From account")+'<div class="field"><label for="cmTo">Other account</label><select id="cmTo">'+opts+'</select></div><button class="go" id="cmSave">Save movement</button><button class="flat" id="cmBack">Back</button>');
  document.getElementById("cmBack").onclick=function(){openCapture(c.id);};document.getElementById("cmSave").onclick=function(){var t=document.getElementById("cmType").value,from=document.getElementById("cmFrom").value,to=document.getElementById("cmTo").value;if(!from){toast("Choose the account");return;}if((t==="transfer"||t==="card_payment")&&!to){toast("Choose the other account");return;}var x={id:"l"+Date.now(),type:t,amount:c.amount,cur:c.cur,date:(c.timestamp||iso(today())).slice(0,10),note:c.merchant,createdAt:Date.now(),source:"notification",captureId:c.id,account:"",from:"",to:""};if(t==="transfer"||t==="card_payment"){x.from=from;x.to=to;}else{x.account=from;}S.ledger.push(x);c.status="confirmed";save();shut();redraw();toast("Movement saved");};
}
function handleCaptureURL(){
  var raw=(location.hash||"").replace(/^#/,"");if(!raw||raw.indexOf("capture=")<0)return false;
  var p=new URLSearchParams(raw);if(p.get("capture")!=="1")return false;
  var c=parseNotificationText(p.get("text")||p.get("body")||"",{app:p.get("app")||p.get("source")||"",merchant:p.get("merchant")||"",amount:p.get("amount")||p.get("amt")||"",cur:p.get("cur")||"",timestamp:p.get("timestamp")||""});
  var ok=addCapture(c);if(history.replaceState)history.replaceState({},"",location.pathname+location.search);return ok;
}

/* ── historical canonical migration (3.2) ── */
function findOrCreateAccount(name,type,currency){
  name=(name||"Imported account").trim();var mapped=type==="credit_card"?"credit":type==="cash"?"cash":type==="loan"?"loan":"bank";
  var hit=S.accounts.find(function(a){return a.name.toLowerCase()===name.toLowerCase();});
  if(hit){if(!hit.currency)hit.currency=(currency||"SGD").toUpperCase();if(hit.type==="bank"&&mapped==="loan")hit.type="loan";return hit.id;}
  var a={id:"a"+Date.now()+Math.floor(Math.random()*9999),name:name,type:mapped,balance:0,baseBalance:0,snapshotAt:Date.now(),updated:iso(today()),currency:(currency||"SGD").toUpperCase(),source:"historical_import",needsSnapshot:true};
  S.accounts.push(a);return a.id;
}
function findOrCreateCategory(name){name=(name||"").trim();if(!name)return (S.cats.find(function(c){return c.name.toLowerCase()==="other";})||S.cats[0]||{}).id||"";var hit=S.cats.find(function(c){return c.name.toLowerCase()===name.toLowerCase();});if(hit)return hit.id;var c={id:"c"+Date.now()+Math.floor(Math.random()*9999),name:name,icon:"dots",cap:0,quick:[500,1000,2000,5000]};S.cats.push(c);return c.id;}
function canonicalIndex(headers,name){return headers.findIndex(function(x){return String(x).trim().toLowerCase()===name;});}
function previewHistorical(text,name){
  var rows=parseCsv(text);if(rows.length<2){toast("No transaction rows found");return;}var h=rows[0].map(function(x){return String(x).trim().toLowerCase();}),required=["account_name","account_type","currency","transaction_date","description","transaction_type","amount"],missing=required.filter(function(x){return h.indexOf(x)<0;});if(missing.length){toast("This is not the canonical history format");return;}
  var idx={};h.forEach(function(x,i){idx[x]=i;});var data=rows.slice(1).filter(function(r){return r[idx.transaction_date]&&r[idx.amount];});var accs={};data.forEach(function(r){accs[r[idx.account_name]||"Imported account"]=1;});
  openSheet('<div class="pull"></div><b style="font-size:17px">Historical migration</b><p class="hint">'+esc(name)+' will be imported as historical records. This is intended as a one-time migration.</p><div class="migration-score"><div><span>Rows</span><b>'+data.length+'</b></div><div><span>Accounts</span><b>'+Object.keys(accs).length+'</b></div><div><span>Mode</span><b>Merge</b></div></div><div class="success-note">Existing Budget Margin entries are kept. Historical rows build analytics only and do not change today’s account balances. Re-importing the same file is blocked.</div><button class="go" id="histGo">Import history</button><button class="flat" id="histCancel">Cancel</button>');
  document.getElementById("histCancel").onclick=shut;document.getElementById("histGo").onclick=function(){importHistoricalRows(data,idx,name);};
}
function importHistoricalRows(rows,idx,name){
  var fileSig=name+"|"+rows.length+"|"+(rows[0]&&rows[0][idx.transaction_date]||"")+"|"+(rows[rows.length-1]&&rows[rows.length-1][idx.transaction_date]||"");
  if(S.historicalImports.some(function(x){return x.signature===fileSig;})){toast("This historical file appears to be imported already");return;}
  var added=0,ledgerAdded=0,createdAccounts={};
  rows.forEach(function(r,n){
    var an=r[idx.account_name]||"Imported account",at=r[idx.account_type]||"bank",cur=(r[idx.currency]||"SGD").toUpperCase(),date=(r[idx.transaction_date]||"").trim(),desc=r[idx.description]||"",type=(r[idx.transaction_type]||"other").trim().toLowerCase(),amount=parseFloat(String(r[idx.amount]||"").replace(/,/g,""));
    if(!date||!isFinite(amount)||amount===0)return;
    var before=S.accounts.length,aid=findOrCreateAccount(an,at,cur);if(S.accounts.length>before)createdAccounts[aid]=1;
    var cents=Math.round(Math.abs(amount)*100),ref=idx.reference!=null?r[idx.reference]||"":"",merchant=idx.merchant!=null?r[idx.merchant]||"":"",hint=idx.category_hint!=null?r[idx.category_hint]||"":"",sourceId="hist:"+fileSig+":"+n;
    if(type==="expense"&&amount<0){
      var cat=findOrCreateCategory(hint||ruleCategory(merchant||desc)||"Other"),sgd=cur==="MYR"?Math.round(cents/(S.rate||3.35)):cents;
      S.txns.push({id:uid(),date:date,sgd:sgd,cur:cur,orig:cents,cat:cat,note:merchant||desc,account:aid,createdAt:Date.now(),source:"historical_import",sourceId:sourceId,reference:ref,affectsBalance:false});added++;if(merchant)rememberRule(merchant,cat);
    }else{
      var lt=type;if(lt==="fee"||lt==="interest"||lt==="other")lt=amount<0?"expense":"income";if(lt==="refund")lt="refund";
      if(lt==="income"||lt==="expense"||lt==="refund"||lt==="transfer"||lt==="card_payment"){
        S.ledger.push({id:"l"+Date.now()+"_"+n,type:lt,account:(lt==="transfer"||lt==="card_payment")?"":aid,from:"",to:"",amount:cents,cur:cur,date:date,note:merchant||desc,createdAt:Date.now(),source:"historical_import",sourceId:sourceId,reference:ref,affectsBalance:false});ledgerAdded++;
      }
    }
  });
  S.historicalImports.push({id:"hi"+Date.now(),file:name,signature:fileSig,date:iso(today()),spending:added,ledger:ledgerAdded,rows:rows.length,createdAccounts:Object.keys(createdAccounts)});
  save();shut();hStart=pStart(today());redraw();toast((added+ledgerAdded)+" historical records imported · account balances unchanged");
}


/* ── Plan screen ── */
function drawPlan(){
  var ps=pStart(today()),pe=pShift(ps,1),envelopeLeft=capAll()-spent(ps,pe),res=reservedCommitments(ps,pe),inc=expectedIncome(ps,pe),goalReserve=goalReserveCurrent(),cash=liquidTotals(),budgetFree=envelopeLeft-res.amount-goalReserve,free=S.accounts.length?Math.min(cash.net,budgetFree):budgetFree,pl=document.getElementById("planPeriodLabel");if(!pl)return;pl.textContent=pLabel(ps);document.getElementById("planEnvelopeLeft").textContent=money(envelopeLeft,false);document.getElementById("planReserved").textContent=money(res.amount+goalReserve,false);document.getElementById("planIncome").textContent=money(inc.amount,false);document.getElementById("planFree").textContent=(free<0?"-":"")+money(Math.abs(free),false);document.getElementById("planFree").classList.toggle("danger",free<0);var tank=document.getElementById('planFreeTank');if(tank&&window.LM){if(!tank.dataset.lmMounted){LM.mountFill(tank,{vertical:true,colors:['color-mix(in srgb,var(--accent) 38%,transparent)']});tank.dataset.lmMounted='1';}LM.setFill(tank,capAll()>0?Math.max(0,free)/capAll():0,true);}drawForecast();drawGoals();drawLedger();drawAccounts();drawUpcoming();drawSchedules();
}

function drawForecast(){
  var box=document.getElementById("forecastList"), sum=document.getElementById("forecastSummary"); if(!box)return;
  box.innerHTML="";
  var a=today(), b=new Date(a.getFullYear(),a.getMonth(),a.getDate()+31), items=periodOccurrences(a,b).filter(function(o){return !o.done;});
  if(sum){
    var net=0; items.forEach(function(o){var v=amountSgd(o.rec);net+=o.rec.type==="income"?v:-v;});
    sum.textContent=(net>=0?"+":"-")+money(Math.abs(net),false)+" planned";
  }
  if(!items.length){box.appendChild(el("div","empty compact","No scheduled cash flow in the next 30 days."));return;}
  items.slice(0,12).forEach(function(o){
    var r=o.rec,row=el("div","forecast-row"), left=el("span","forecast-left"), dot=el("span","forecast-dot");
    dot.classList.add(r.type==="income"?"in":"out"); left.appendChild(dot);
    var cp=el("span"); cp.appendChild(el("b",null,r.name)); cp.appendChild(el("small",null,dateShort(o.date)+(r.account?" · "+accountName(r.account):""))); left.appendChild(cp);
    row.appendChild(left); row.appendChild(el("b","tab "+(r.type==="income"?"income-text":""),(r.type==="income"?"+":"-")+money(amountSgd(r),false))); box.appendChild(row);
  });
}
function drawGoals(){
  var box=document.getElementById("goalList"),sum=document.getElementById("goalSummary");if(!box)return;box.innerHTML="";var saved=0,target=0,reserve=goalReserveCurrent();S.goals.forEach(function(g){if(g.active!==false){saved+=g.saved||0;target+=g.target||0;}});if(sum)sum.innerHTML='<div><span>Saved</span><b class="tab">'+money(saved,false)+'</b></div><div><span>Still to target</span><b class="tab">'+money(Math.max(0,target-saved),false)+'</b></div><div><span>This period</span><b class="tab">'+money(reserve,false)+'</b></div>';if(!S.goals.length){box.appendChild(el("div","empty compact","Create a sinking fund for travel, insurance, emergency cash or anything you want to prepare for."));return;}var grid=el('div','lm-goal-grid');S.goals.forEach(function(g){var pct=g.target>0?Math.min(1,(g.saved||0)/g.target):0,card=el('div','lm-goal-card'),main=el('button','lm-goal');var vessel=el('span','lm-goal-vessel'),fill=el('span','lm-fill');vessel.appendChild(fill);main.appendChild(vessel);var cp=el('span','lm-goal-copy');cp.appendChild(el('b',null,g.name));cp.appendChild(el('span','lm-goal-saved tab',money(g.saved||0,false)));cp.appendChild(el('small',null,'of '+money(g.target||0,false)+' · '+Math.round(pct*100)+'%'));main.appendChild(cp);main.onclick=function(){openGoal(g.id);};card.appendChild(main);var add=el('button','lm-goal-add','+ S$50');add.onclick=function(e){e.stopPropagation();var addAmt=Math.min(5000,Math.max(0,(g.target||Infinity)-(g.saved||0)));if(!addAmt)return;g.saved=(g.saved||0)+addAmt;S.goalContrib.push({id:'gc'+Date.now(),goal:g.id,amount:addAmt,date:iso(today()),account:'',createdAt:Date.now()});save();redraw();toast(money(addAmt,false)+' added to '+g.name);};card.appendChild(add);grid.appendChild(card);if(window.LM){LM.mountFill(vessel,{colors:['color-mix(in srgb,var(--accent) 38%,transparent)']});LM.setFill(vessel,pct,false);}});box.appendChild(grid);
}
function openGoal(id){
  var g=null;S.goals.forEach(function(x){if(x.id===id)g=x;});
  if(!g)g={id:"g"+Date.now(),name:"",target:0,saved:0,targetDate:"",periodContribution:0,active:true};
  openSheet('<div class="pull"></div><b style="font-size:17px">'+(id?'Edit goal':'New goal')+'</b>'+
    '<div class="field" style="margin-top:14px"><label for="gName">Goal</label><input id="gName" value="'+esc(g.name)+'" placeholder="Emergency fund"></div>'+
    '<div class="two-fields"><div class="field"><label for="gTarget">Target</label><input id="gTarget" inputmode="decimal" value="'+((g.target||0)/100).toFixed(2)+'"></div><div class="field"><label for="gSaved">Already saved</label><input id="gSaved" inputmode="decimal" value="'+((g.saved||0)/100).toFixed(2)+'"></div></div>'+
    '<div class="two-fields"><div class="field"><label for="gPer">Reserve each period</label><input id="gPer" inputmode="decimal" value="'+((g.periodContribution||0)/100).toFixed(2)+'"></div><div class="field"><label for="gDate">Target date</label><input id="gDate" type="date" value="'+(g.targetDate||"")+'"></div></div>'+
    '<button class="go" id="gSave">Save goal</button>'+
    (id?'<button class="sm" id="gContrib" style="width:100%;margin-top:8px">Add contribution</button><button class="flat danger" id="gDelete">Remove goal</button>':'')+
    '<button class="flat" id="gCancel">Cancel</button>');
  document.getElementById("gCancel").onclick=shut;
  document.getElementById("gSave").onclick=function(){
    var name=document.getElementById("gName").value.trim();if(!name){toast("Give the goal a name");return;}
    g.name=name;g.target=toCents(document.getElementById("gTarget").value);g.saved=toCents(document.getElementById("gSaved").value);g.periodContribution=toCents(document.getElementById("gPer").value);g.targetDate=document.getElementById("gDate").value||"";
    if(!id)S.goals.push(g);save();shut();redraw();toast(id?"Goal updated":"Goal added");
  };
  if(id){
    document.getElementById("gContrib").onclick=function(){openGoalContribution(g.id);};
    document.getElementById("gDelete").onclick=function(){if(!confirm("Remove "+g.name+"?"))return;S.goals=S.goals.filter(function(x){return x.id!==g.id;});save();shut();redraw();toast("Goal removed");};
  }
}
function openGoalContribution(id){
  var g=null;S.goals.forEach(function(x){if(x.id===id)g=x;});if(!g)return;
  var opts='<option value="">No account</option>';S.accounts.forEach(function(a){opts+='<option value="'+a.id+'">'+esc(a.name)+'</option>';});
  openSheet('<div class="pull"></div><b style="font-size:17px">Add to '+esc(g.name)+'</b>'+
    '<div class="field" style="margin-top:14px"><label for="gcAmt">Amount</label><input id="gcAmt" inputmode="decimal" placeholder="0.00"></div>'+
    '<div class="field"><label for="gcAcc">From account</label><select id="gcAcc">'+opts+'</select></div>'+
    '<button class="go" id="gcSave">Save contribution</button><button class="flat" id="gcCancel">Cancel</button>');
  document.getElementById("gcCancel").onclick=shut;
  document.getElementById("gcSave").onclick=function(){
    var amt=toCents(document.getElementById("gcAmt").value);if(!amt){toast("Enter an amount");return;}
    var account=document.getElementById("gcAcc").value, now=Date.now();
    g.saved=(g.saved||0)+amt;S.goalContrib.push({id:"gc"+now,goal:g.id,amount:amt,date:iso(today()),account:account,createdAt:now});
    if(account)S.ledger.push({id:"l"+now,type:"goal",account:account,amount:amt,cur:"SGD",date:iso(today()),note:g.name,createdAt:now});
    save();shut();redraw();toast(money(amt,false)+" added to "+g.name);
  };
}
function drawLedger(){
  var box=document.getElementById("ledgerList"), sum=document.getElementById("ledgerSummary");if(!box)return;box.innerHTML="";
  var rows=S.ledger.slice().sort(function(a,b){return (b.date||"").localeCompare(a.date||"")||(b.createdAt||0)-(a.createdAt||0);}).slice(0,8);
  var monthStart=pStart(today()), monthEnd=pShift(monthStart,1), inflow=0,outflow=0;
  S.ledger.forEach(function(x){if(!x.date||!inR(x,monthStart,monthEnd))return;var a=ledgerAmountSgd(x);if(x.type==="income"||x.type==="refund")inflow+=a;else if(x.type==="expense"||x.type==="goal")outflow+=a;});
  if(sum)sum.innerHTML='<div><span>Income entries</span><b class="tab">'+money(inflow,false)+'</b></div><div><span>Other outflow</span><b class="tab">'+money(outflow,false)+'</b></div>';
  if(!rows.length){box.appendChild(el("div","empty compact","Use the ledger for income, transfers, refunds and card payments. Envelope spending still comes from Spend."));return;}
  rows.forEach(function(x){
    var row=el("button","ledger-row"), left=el("span","ledger-left"), cp=el("span");
    cp.appendChild(el("b",null,ledgerLabel(x)));cp.appendChild(el("small",null,(x.note?x.note+" · ":"")+dateShort(x.date||iso(today()))));left.appendChild(cp);row.appendChild(left);
    row.appendChild(el("b","tab "+((x.type==="income"||x.type==="refund")?"income-text":""),ledgerDisplayAmount(x)));row.addEventListener("click",function(){openLedger(x.id);});box.appendChild(row);
  });
}
function ledgerLabel(x){
  if(x.type==="transfer")return "Transfer · "+accountName(x.from)+" → "+accountName(x.to);
  if(x.type==="card_payment")return "Card payment · "+accountName(x.to);
  if(x.type==="goal")return "Goal contribution";
  return x.type.charAt(0).toUpperCase()+x.type.slice(1)+(x.account?" · "+accountName(x.account):"");
}
function ledgerDisplayAmount(x){
  var a=ledgerAmountSgd(x), sign=(x.type==="income"||x.type==="refund")?"+":(x.type==="transfer"||x.type==="card_payment"?"":"-");
  return sign+money(a,false);
}
function ledgerAccountOptions(selected,none){
  var h='<option value="">'+(none||"Select account")+'</option>';S.accounts.forEach(function(a){h+='<option value="'+a.id+'"'+(a.id===selected?' selected':'')+'>'+esc(a.name)+'</option>';});return h;
}
function openLedger(id){
  var x=null;S.ledger.forEach(function(z){if(z.id===id)x=z;});
  if(!x)x={id:"l"+Date.now(),type:"income",amount:0,cur:"SGD",date:iso(today()),note:"",account:"",from:"",to:"",createdAt:Date.now()};
  openSheet('<div class="pull"></div><b style="font-size:17px">'+(id?'Edit ledger entry':'New ledger entry')+'</b>'+
    '<div class="field" style="margin-top:14px"><label for="lType">Type</label><select id="lType"><option value="income"'+(x.type==="income"?' selected':'')+'>Income</option><option value="expense"'+(x.type==="expense"?' selected':'')+'>Expense outside envelopes</option><option value="refund"'+(x.type==="refund"?' selected':'')+'>Refund</option><option value="transfer"'+(x.type==="transfer"?' selected':'')+'>Transfer</option><option value="card_payment"'+(x.type==="card_payment"?' selected':'')+'>Credit-card payment</option></select></div>'+
    '<div class="two-fields"><div class="field"><label for="lAmt">Amount</label><input id="lAmt" inputmode="decimal" value="'+((x.amount||0)/100).toFixed(2)+'"></div><div class="field"><label for="lDate">Date</label><input id="lDate" type="date" value="'+(x.date||iso(today()))+'"></div></div>'+
    '<div class="field" id="lAccountField"><label for="lAccount">Account</label><select id="lAccount">'+ledgerAccountOptions(x.account||"")+'</select></div>'+
    '<div class="two-fields" id="lTransferFields"><div class="field"><label for="lFrom">From</label><select id="lFrom">'+ledgerAccountOptions(x.from||"")+'</select></div><div class="field"><label for="lTo">To</label><select id="lTo">'+ledgerAccountOptions(x.to||"")+'</select></div></div>'+
    '<div class="field"><label for="lNote">Note</label><input id="lNote" value="'+esc(x.note||"")+'" placeholder="Salary, transfer, refund…"></div>'+
    '<button class="go" id="lSave">Save entry</button>'+(id?'<button class="flat danger" id="lDelete">Delete entry</button>':'')+'<button class="flat" id="lCancel">Cancel</button>');
  function sync(){var t=document.getElementById("lType").value, multi=t==="transfer"||t==="card_payment";document.getElementById("lAccountField").hidden=multi;document.getElementById("lTransferFields").hidden=!multi;}
  document.getElementById("lType").onchange=sync;sync();document.getElementById("lCancel").onclick=shut;
  document.getElementById("lSave").onclick=function(){
    var amt=toCents(document.getElementById("lAmt").value);if(!amt){toast("Enter an amount");return;}
    x.type=document.getElementById("lType").value;x.amount=amt;x.cur="SGD";x.date=document.getElementById("lDate").value||iso(today());x.note=document.getElementById("lNote").value.trim();
    x.account=document.getElementById("lAccount").value;x.from=document.getElementById("lFrom").value;x.to=document.getElementById("lTo").value;if(!x.createdAt)x.createdAt=Date.now();
    if((x.type==="transfer"||x.type==="card_payment")&&(!x.from||!x.to)){toast("Choose both accounts");return;}
    if(!(x.type==="transfer"||x.type==="card_payment")&&!x.account){toast("Choose an account");return;}
    if(!id)S.ledger.push(x);save();shut();redraw();toast("Ledger entry saved");
  };
  if(id)document.getElementById("lDelete").onclick=function(){if(!confirm("Delete this ledger entry?"))return;S.ledger=S.ledger.filter(function(z){return z.id!==id;});save();shut();redraw();toast("Ledger entry deleted");};
}

function drawAccounts(){
  var box=document.getElementById("accountList"), sum=document.getElementById("accountSummary"); if(!box)return; box.innerHTML=""; sum.innerHTML="";
  var totals=liquidTotals();
  sum.innerHTML='<div><span>Liquid</span><b class="tab">'+money(totals.liquid,false)+'</b></div><div><span>Cards owing</span><b class="tab">'+money(totals.credit,false)+'</b></div>';
  if(!S.accounts.length){box.appendChild(el("div","empty compact","Add the accounts you actually use. From 3.0, new ledger activity can move these balances."));return;}
  S.accounts.forEach(function(a){
    var current=accountCurrent(a), b=el("button","account-card"), left=el("span","account-left"), ico=el("span","account-icon");
    ico.innerHTML=iconSvg(accountIcon(a.type)); left.appendChild(ico);
    var cp=el("span"); cp.appendChild(el("b",null,a.name)); cp.appendChild(el("small",null,accountTypeLabel(a.type)+" · live from snapshot")); left.appendChild(cp); b.appendChild(left);
    var right=el("span","account-balance"); right.appendChild(el("b","tab",accountMoney(current,a.currency||"SGD",false))); right.appendChild(el("small",null,a.needsSnapshot?"set current balance":(a.type==="credit"||a.type==="loan"?"owing":"available"))); b.appendChild(right);
    b.addEventListener("click",function(){openAccount(a.id);}); box.appendChild(b);
  });
}
function openAccount(id){
  var a=id?accountOf(id):null; if(!a)a={id:"a"+Date.now(),name:"",type:"bank",balance:0,baseBalance:0,snapshotAt:Date.now(),updated:iso(today())};
  var shown=id?accountCurrent(a):(a.baseBalance||0);
  openSheet('<div class="pull"></div><b style="font-size:17px">'+(id?'Edit account':'Add account')+'</b>'+
    '<div class="field" style="margin-top:14px"><label for="aName">Name</label><input id="aName" autocomplete="off" value="'+esc(a.name)+'" placeholder="DBS Everyday"></div>'+
    '<div class="field"><label for="aType">Type</label><select id="aType"><option value="bank"'+(a.type==='bank'?' selected':'')+'>Bank account</option><option value="cash"'+(a.type==='cash'?' selected':'')+'>Cash</option><option value="credit"'+(a.type==='credit'?' selected':'')+'>Credit card</option><option value="loan"'+(a.type==='loan'?' selected':'')+'>Loan</option></select></div>'+
    '<div class="field"><label for="aCur">Currency</label><select id="aCur"><option value="SGD"'+((a.currency||'SGD')==='SGD'?' selected':'')+'>SGD</option><option value="MYR"'+(a.currency==='MYR'?' selected':'')+'>MYR</option></select></div>'+
    '<div class="field"><label for="aBal">'+(a.type==='credit'?'Current amount owing':'Current balance')+'</label><input id="aBal" type="text" inputmode="decimal" value="'+(shown/100).toFixed(2)+'"></div>'+
    '<p class="hint">Saving a balance creates a fresh snapshot. New spending, income, transfers and card payments after that snapshot move the live balance automatically.</p>'+
    '<button class="go" id="aSave">Save account</button>'+
    (id?'<button class="flat danger" id="aDelete">Remove account</button>':'')+'<button class="flat" id="aCancel">Cancel</button>');
  document.getElementById("aCancel").onclick=shut;
  document.getElementById("aSave").onclick=function(){
    var name=document.getElementById("aName").value.trim(); if(!name){toast("Give the account a name");return;}
    a.name=name; a.type=document.getElementById("aType").value; a.currency=document.getElementById("aCur").value; a.balance=toCents(document.getElementById("aBal").value); a.baseBalance=a.balance; a.snapshotAt=Date.now(); a.updated=iso(today()); a.needsSnapshot=false;
    if(!id){S.accounts.push(a);if(!S.defaultAccount)S.defaultAccount=a.id;}
    save();shut();redraw();toast(id?"Account snapshot updated":"Account added");
  };
  if(id)document.getElementById("aDelete").onclick=function(){
    if(!confirm("Remove "+a.name+"? Existing transactions will become unassigned."))return;
    S.accounts=S.accounts.filter(function(x){return x.id!==id;});
    S.txns.forEach(function(t){if(t.account===id)t.account="";});
    S.recurring.forEach(function(r){if(r.account===id)r.account="";});
    S.ledger.forEach(function(x){if(x.account===id)x.account="";if(x.from===id)x.from="";if(x.to===id)x.to="";});
    if(S.defaultAccount===id)S.defaultAccount="";save();shut();redraw();toast("Account removed");
  };
}
function drawUpcoming(){
  var box=document.getElementById("upcomingList"); if(!box)return; box.innerHTML="";
  var ps=pStart(today()), start=ps>new Date(today().getFullYear(),today().getMonth(),today().getDate()-14)?ps:new Date(today().getFullYear(),today().getMonth(),today().getDate()-14), end=new Date(today().getFullYear(),today().getMonth(),today().getDate()+31);
  var list=periodOccurrences(start,end).filter(function(o){return !o.done;}).slice(0,10);
  if(!list.length){box.appendChild(el("div","empty compact","Nothing scheduled for the next 30 days."));return;}
  list.forEach(function(o){var r=o.rec, row=el("div","upcoming-card"), left=el("span","upcoming-left"), ico=el("span","upcoming-icon "+(r.type==='income'?'income':'expense'));ico.innerHTML=iconSvg(r.type==='income'?'spark':'calendar');left.appendChild(ico);var cp=el("span");cp.appendChild(el("b",null,r.name));var d=pIso(o.date), overdue=d<today();cp.appendChild(el("small",null,(overdue?'Overdue · ':'')+dateShort(o.date)+(r.account?' · '+accountName(r.account):'')));left.appendChild(cp);row.appendChild(left);var side=el("span","upcoming-side");side.appendChild(el("b","tab "+(r.type==='income'?'income-text':''),(r.type==='income'?'+':'-')+money(amountSgd(r),false)));var act=el("button","mini-action",r.type==='income'?"Received":(r.cat?"Log":"Paid"));act.addEventListener("click",function(){completeOccurrence(o);});side.appendChild(act);row.appendChild(side);box.appendChild(row);});
}
function completeOccurrence(o){
  var r=o.rec,key=occurrenceKey(r,o.date),now=Date.now(),amt=r.amount||0,cur=r.cur||"SGD";
  if(r.type==="income"&&r.account){
    S.ledger.push({id:"l"+now,type:"income",account:r.account,amount:amt,cur:cur,date:o.date,note:r.name,createdAt:now});
  } else if(r.type!=="income"&&r.cat){
    var s=cur==="MYR"?Math.round(amt/S.rate):amt,id=uid();
    S.txns.push({id:id,date:o.date,sgd:s,cur:cur,orig:amt,cat:r.cat,note:r.name,account:r.account||"",createdAt:now});
  } else if(r.type!=="income"&&r.account){
    S.ledger.push({id:"l"+now,type:"expense",account:r.account,amount:amt,cur:cur,date:o.date,note:r.name,createdAt:now});
  }
  S.recurringDone[key]=true;save();redraw();toast(r.type==="income"?"Income received":(r.cat?"Commitment logged":"Marked paid"));
}
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
function debtForecast(){
  var debts=S.debts.filter(function(d){return (d.bal||0)>0;}).map(function(d){return {id:d.id,name:d.name,bal:d.bal||0,rate:+d.rate||0,minPay:d.minPay||0};});
  if(!debts.length)return {months:0,interest:0,schedule:[],target:null,warning:""};
  var minTotal=debts.reduce(function(a,d){return a+(d.minPay||0);},0);
  var budget=S.debtPlan.monthlyBudget||minTotal;
  if(budget<=0)return {months:null,interest:0,schedule:[],target:null,warning:"Set a monthly debt budget or minimum payments to build a forecast."};
  var originalBudget=budget,interest=0,schedule=[],month=0,warning="";
  if(originalBudget<minTotal)warning="Monthly budget is below your stated minimum payments.";
  function orderActive(arr){return arr.filter(function(d){return d.bal>0;}).sort(function(a,b){
    return S.debtPlan.strategy==="snowball"?(a.bal-b.bal)||((b.rate||0)-(a.rate||0)):((b.rate||0)-(a.rate||0))||(a.bal-b.bal);
  });}
  var first=orderActive(debts)[0]||null;
  while(orderActive(debts).length&&month<600){
    month++; var available=originalBudget,active=orderActive(debts);
    active.forEach(function(d){var it=Math.round(d.bal*(d.rate/100/12));d.bal+=it;interest+=it;});
    active=orderActive(debts);
    active.forEach(function(d){var pay=Math.min(d.bal,d.minPay||0,available);d.bal-=pay;available-=pay;});
    active=orderActive(debts);
    while(available>0&&active.length){var d=active[0],pay=Math.min(d.bal,available);d.bal-=pay;available-=pay;active=orderActive(debts);}
    if(month<=12||month%6===0||!orderActive(debts).length)schedule.push({month:month,total:debts.reduce(function(a,d){return a+Math.max(0,d.bal);},0)});
    if(originalBudget<=0)break;
  }
  if(month>=600&&orderActive(debts).length)warning="At this payment level the debt does not clear within 50 years.";
  return {months:month,interest:interest,schedule:schedule,target:first,warning:warning,budget:originalBudget};
}
function monthNameFromNow(n){var d=new Date(today().getFullYear(),today().getMonth()+n,1);return MO[d.getMonth()]+" "+d.getFullYear();}
function drawDebtPlan(){
  var box=document.getElementById("debtPlanCard"); if(!box)return; var f=debtForecast();
  var strat=document.getElementById("debtStrategy"),bud=document.getElementById("debtMonthlyBudget");
  if(strat)strat.value=S.debtPlan.strategy||"avalanche"; if(bud)bud.value=S.debtPlan.monthlyBudget?((S.debtPlan.monthlyBudget/100).toFixed(0)):"";
  var sum=document.getElementById("debtPlanSummary"),timeline=document.getElementById("debtTimeline"); if(!sum||!timeline)return;
  if(!S.debts.some(function(d){return (d.bal||0)>0;})){sum.innerHTML='<div class="empty compact">Add a debt balance to build a payoff forecast.</div>';timeline.innerHTML="";return;}
  if(f.months==null){sum.innerHTML='<div class="debt-plan-message">'+esc(f.warning)+'</div>';timeline.innerHTML="";return;}
  var years=Math.floor(f.months/12),mos=f.months%12,duration=(years?years+"y ":"")+(mos?mos+"m":"");
  sum.innerHTML='<div><span>Debt-free</span><b>'+esc(monthNameFromNow(f.months))+'</b></div><div><span>Time</span><b>'+duration+'</b></div><div><span>Projected interest</span><b>'+money(f.interest,false)+'</b></div>'+(f.target?'<div><span>Attack first</span><b>'+esc(f.target.name)+'</b></div>':'')+(f.warning?'<p class="debt-plan-warn">'+esc(f.warning)+'</p>':'');
  timeline.innerHTML=""; var max=S.debts.reduce(function(a,d){return a+(d.bal||0);},0)||1;
  f.schedule.slice(0,8).forEach(function(x){var r=el("div","debt-timeline-row"),lab=el("span",null,x.month===f.months?"Debt free":("Month "+x.month)),track=el("span","debt-timeline-track"),fill=el("i");fill.style.width=Math.max(0,Math.min(100,x.total/max*100))+"%";track.appendChild(fill);r.appendChild(lab);r.appendChild(track);r.appendChild(el("b","tab",money(x.total,false)));timeline.appendChild(r);});
}
function drawDebt(){
  drawDebtPlan();var box=document.getElementById("dList");if(!box)return;box.innerHTML="";var t=debtTotals(),frac=t.start>0?t.cleared/t.start:0,dg=document.getElementById('dGauge');if(dg&&window.LM){if(!dg.dataset.lmMounted){LM.mountFill(dg,{vertical:true,colors:['rgba(163,139,255,.44)']});dg.dataset.lmMounted='1';}LM.setFill(dg,t.start>0?Math.max(0,Math.min(1,t.bal/t.start)):0,true);}document.getElementById("dAmt").textContent=t.bal<=0&&t.start>0?"Cleared":money(t.bal,false);document.getElementById("dCap").textContent=t.start>0?"still owed":"add a debt to start";document.getElementById("dPace").textContent=t.start>0?Math.round(frac*100)+"% cleared":"";S.debts.forEach(function(d){var f=d.start>0?(d.start-d.bal)/d.start:0,b=el("button","row"),top=el("div","top"),nm=el("span","nm"),dot=el("span","dot"),hue=d.bal<=0?"var(--jade)":"var(--violet)";dot.style.background=hue;dot.style.color=hue;nm.appendChild(dot);nm.appendChild(el("span",null,d.name+(d.rate?"  "+d.rate+"%":"")));var r=el("span","rm tab",d.bal<=0?"Cleared":money(d.bal,false));r.style.color=hue;top.appendChild(nm);top.appendChild(r);b.appendChild(top);var ru=el("div","rule"),fi=el("i");fi.style.width=Math.max(0,Math.min(100,f*100))+"%";fi.style.background=hue;ru.appendChild(fi);b.appendChild(ru);b.addEventListener("click",function(){openPay(d.id);});box.appendChild(b);});
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
    '<div class="field"><label for="pM">Minimum monthly payment</label>'+
    '<input id="pM" type="text" inputmode="decimal" value="'+((d.minPay||0)/100).toFixed(2)+'"></div>'+
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
    d.bal=b; if(b>d.start) d.start=b; d.rate=isNaN(r)?0:r; d.minPay=toCents(document.getElementById("pM").value);
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
    var title=r.label||pLabel(pIso(r.p));
    var extra=r.source==="csv"?" · "+(r.matched||0)+" matched, "+(r.missing||0)+" missing":"";
    var d=el("div",null,title+" — difference "+(gap<0?"-":"")+money(Math.abs(gap),false)+extra);
    d.style.marginBottom="4px";
    if(Math.abs(gap)>Math.max(500,r.logged*0.15)) d.style.color="var(--coral)";
    box.appendChild(d);
  });
}


function merchantKey(s){return String(s||"").toUpperCase().replace(/\b(PTE|LTD|LIMITED|SINGAPORE|SG|PAYMENT|PURCHASE|DEBIT|CARD)\b/g," ").replace(/[^A-Z0-9]+/g," ").trim().split(" ").slice(0,5).join(" ");}
function ruleCategory(desc){var k=merchantKey(desc),best="",cat="";Object.keys(S.merchantRules||{}).forEach(function(r){if(k.indexOf(r)>=0&&r.length>best.length){best=r;cat=S.merchantRules[r];}});return cat;}
function rememberRule(desc,cat){var k=merchantKey(desc);if(k&&cat){if(!S.merchantRules)S.merchantRules={};S.merchantRules[k]=cat;}}
var statementStage=null;
function parseCsv(text){
  var rows=[],row=[],cell="",q=false;
  for(var i=0;i<text.length;i++){
    var c=text[i],n=text[i+1];
    if(q){
      if(c==='"'&&n==='"'){cell+='"';i++;}
      else if(c==='"')q=false; else cell+=c;
    }else{
      if(c==='"')q=true;
      else if(c===','){row.push(cell);cell="";}
      else if(c==='\n'){row.push(cell);rows.push(row);row=[];cell="";}
      else if(c!=='\r')cell+=c;
    }
  }
  if(cell.length||row.length){row.push(cell);rows.push(row);}
  return rows.filter(function(r){return r.some(function(x){return String(x).trim()!=="";});});
}
function colGuess(headers,words){
  var low=headers.map(function(h){return String(h).trim().toLowerCase();});
  for(var i=0;i<words.length;i++){var k=low.findIndex(function(h){return h.indexOf(words[i])>=0;});if(k>=0)return k;}
  return -1;
}
function mapSelect(id,headers,selected,none){
  var h='<select id="'+id+'"><option value="-1">'+(none||"Not used")+'</option>';
  headers.forEach(function(x,i){h+='<option value="'+i+'"'+(i===selected?' selected':'')+'>'+esc(x||("Column "+(i+1)))+'</option>';});
  return h+'</select>';
}
function parseStatementDate(raw,fmt){
  raw=String(raw||"").trim();if(!raw)return null;
  var y,m,d,mt=raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if(mt){y=+mt[1];m=+mt[2];d=+mt[3];return new Date(y,m-1,d);}
  var mons={jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
  mt=raw.match(/^(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{2,4})/);
  if(mt){d=+mt[1];m=mons[mt[2].slice(0,3).toLowerCase()];y=+mt[3];if(y<100)y+=2000;if(m!=null)return new Date(y,m,d);}
  mt=raw.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})/);
  if(mt){m=mons[mt[1].slice(0,3).toLowerCase()];d=+mt[2];y=+mt[3];if(y<100)y+=2000;if(m!=null)return new Date(y,m,d);}
  mt=raw.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/);if(!mt)return null;
  var a=+mt[1],b=+mt[2],c=+mt[3];if(c<100)c+=2000;
  if(fmt==="mdy"){m=a;d=b;}else if(fmt==="dmy"){d=a;m=b;}else{if(a>12){d=a;m=b;}else if(b>12){m=a;d=b;}else{d=a;m=b;}}
  return new Date(c,m-1,d);
}
function numCell(v){var n=parseFloat(String(v||"").replace(/[^0-9.\-]/g,""));return isNaN(n)?0:n;}
function statementHeaderIndex(rows){
  var best=-1,bestScore=-1;for(var i=0;i<Math.min(rows.length,25);i++){var low=rows[i].map(function(x){return String(x).trim().toLowerCase();}),score=0;if(low.some(function(x){return x.indexOf("date")>=0;}))score+=2;if(low.some(function(x){return x.indexOf("description")>=0||x.indexOf("details")>=0||x.indexOf("narrative")>=0;}))score+=2;if(low.some(function(x){return x.indexOf("debit")>=0||x.indexOf("money out")>=0||x==="amount";}))score+=2;if(low.some(function(x){return x.indexOf("credit")>=0||x.indexOf("money in")>=0;}))score+=1;if(score>bestScore){bestScore=score;best=i;}}return bestScore>=4?best:0;
}
function statementMeta(rows,hi){var meta={account:"",currency:""};for(var i=0;i<hi;i++){var a=String((rows[i]||[])[0]||"").trim().toLowerCase(),b=String((rows[i]||[])[1]||"").trim();if(a.indexOf("account details")>=0)meta.account=b;if(a.indexOf("currency")>=0){var m=b.match(/\b(SGD|MYR|USD|EUR|GBP|AUD|JPY)\b/i);if(m)meta.currency=m[1].toUpperCase();}}return meta;}
function openStatementMapping(name,rows){
  if(rows.length<2){toast("That file has no transaction rows");return;}
  var hi=statementHeaderIndex(rows),meta=statementMeta(rows,hi);rows=rows.slice(hi);var headers=rows[0], dateI=colGuess(headers,["transaction date","posting date","date"]), descI=colGuess(headers,["description","details","narrative","merchant","reference"]), amountI=colGuess(headers,["amount"]), debitI=colGuess(headers,["debit","withdrawal","money out"]), creditI=colGuess(headers,["credit","deposit","money in"]);
  var suggested=S.defaultAccount||"";if(meta.account){var mk=meta.account.toUpperCase();S.accounts.some(function(a){if(mk.indexOf(a.name.toUpperCase())>=0||a.name.toUpperCase().indexOf(mk.split(/\s+/)[0])>=0){suggested=a.id;return true;}return false;});}var acc=ledgerAccountOptions(suggested,"Choose statement account");
  openSheet('<div class="pull"></div><b style="font-size:17px">Import statement</b>'+
    '<p class="hint">'+esc(name)+' · '+(rows.length-1)+' data rows'+(hi?(' · header detected on row '+(hi+1)):'')+(meta.currency?(' · '+meta.currency):'')+'. Map the columns once before Budget Margin compares them.</p>'+
    '<div class="field"><label for="siAcc">Account</label><select id="siAcc">'+acc+'</select></div>'+
    '<div class="two-fields"><div class="field"><label>Date</label>'+mapSelect("siDate",headers,dateI,"Choose date")+'</div><div class="field"><label>Description</label>'+mapSelect("siDesc",headers,descI,"Optional")+'</div></div>'+
    '<div class="field"><label>Date format</label><select id="siFmt"><option value="auto">Auto / DD-MM-YYYY first</option><option value="dmy">DD-MM-YYYY</option><option value="mdy">MM-DD-YYYY</option></select></div>'+
    '<div class="field"><label>Single signed amount column</label>'+mapSelect("siAmount",headers,amountI,"Not used")+'</div>'+
    '<div class="field"><label>If using signed amount</label><select id="siSign"><option value="negative">Negative = money out</option><option value="positive">Positive = money out</option></select></div>'+
    '<div class="two-fields"><div class="field"><label>Debit / money out</label>'+mapSelect("siDebit",headers,debitI,"Not used")+'</div><div class="field"><label>Credit / money in</label>'+mapSelect("siCredit",headers,creditI,"Not used")+'</div></div>'+
    '<button class="go" id="siAnalyze">Analyse statement</button><button class="flat" id="siCancel">Cancel</button>');
  document.getElementById("siCancel").onclick=shut;
  document.getElementById("siAnalyze").onclick=function(){
    var aid=document.getElementById("siAcc").value,di=+document.getElementById("siDate").value,de=+document.getElementById("siDesc").value,ai=+document.getElementById("siAmount").value,db=+document.getElementById("siDebit").value,cr=+document.getElementById("siCredit").value,fmt=document.getElementById("siFmt").value,sign=document.getElementById("siSign").value;
    if(!aid){toast("Choose the account this statement belongs to");return;}if(di<0){toast("Choose the date column");return;}if(ai<0&&db<0){toast("Choose an amount column or a debit column");return;}
    var parsed=[];
    rows.slice(1).forEach(function(r){
      var dt=parseStatementDate(r[di],fmt);if(!dt||isNaN(dt.getTime()))return;
      var out=0,inc=0;
      if(db>=0||cr>=0){out=Math.abs(numCell(r[db]));inc=Math.abs(numCell(r[cr]));}
      else {var n=numCell(r[ai]);if(sign==="negative"){out=n<0?Math.abs(n):0;inc=n>0?n:0;}else{out=n>0?n:0;inc=n<0?Math.abs(n):0;}}
      if(!out&&!inc)return;
      parsed.push({date:iso(dt),desc:de>=0?String(r[de]||"").trim():"",out:Math.round(out*100),inc:Math.round(inc*100)});
    });
    analyzeStatement(name,aid,parsed);
  };
}
function bookCandidates(aid){
  var out=[];S.txns.forEach(function(t){if(!t.account||t.account===aid)out.push({id:"t:"+t.id,date:t.date,flow:"out",amt:t.sgd||0,label:catName(t.cat)});});
  S.ledger.forEach(function(x){var a=ledgerAmountSgd(x),d=x.date||iso(today());if((x.type==="income"||x.type==="refund")&&x.account===aid)out.push({id:"l:"+x.id,date:d,flow:"in",amt:a,label:x.note||x.type});else if((x.type==="expense"||x.type==="goal")&&x.account===aid)out.push({id:"l:"+x.id,date:d,flow:"out",amt:a,label:x.note||x.type});else if(x.type==="transfer"){if(x.from===aid)out.push({id:"l:"+x.id+":o",date:d,flow:"out",amt:a,label:"Transfer"});if(x.to===aid)out.push({id:"l:"+x.id+":i",date:d,flow:"in",amt:a,label:"Transfer"});}else if(x.type==="card_payment"){if(x.from===aid)out.push({id:"l:"+x.id+":o",date:d,flow:"out",amt:a,label:"Card payment"});if(x.to===aid)out.push({id:"l:"+x.id+":i",date:d,flow:"in",amt:a,label:"Card payment"});}});return out;
}
function analyzeStatement(name,aid,rows,source){
  if(!rows.length){toast("No usable transactions found");return;}
  var used={},matched=[],unmatched=[],inflow=0,outflow=0,cands=bookCandidates(aid);
  rows.forEach(function(r){inflow+=r.inc||0;outflow+=r.out||0;var flow=r.out?"out":"in",amt=r.out||r.inc;if(!amt)return;var best=null,bestDiff=99;cands.forEach(function(c){if(used[c.id]||c.flow!==flow||c.amt!==amt)return;var diff=Math.abs(days(pIso(c.date),pIso(r.date)));if(diff<=3&&diff<bestDiff){best=c;bestDiff=diff;}});if(best){used[best.id]=true;matched.push({row:r,book:best});}else unmatched.push({date:r.date,desc:r.desc||"",out:r.out||0,inc:r.inc||0,status:"pending",suggested:flow==="out"?ruleCategory(r.desc):""});});
  var dates=rows.map(function(r){return r.date;}).sort(),first=dates[0],last=dates[dates.length-1],logged=0;S.txns.forEach(function(t){if(t.date>=first&&t.date<=last&&(!t.account||t.account===aid))logged+=t.sgd||0;});S.ledger.forEach(function(x){if(!x.date||x.date<first||x.date>last)return;if(x.type==="expense"&&x.account===aid)logged+=ledgerAmountSgd(x);});
  statementStage={name:name,source:source||"csv",account:aid,rows:rows,matched:matched,unmatched:unmatched,inflow:inflow,outflow:outflow,logged:logged,first:first,last:last,reviewed:0,ignored:0,added:0};openStatementResult();
}
function pendingUnmatched(){return statementStage?statementStage.unmatched.filter(function(r){return r.status==="pending";}):[];}
function openStatementResult(){
  var st=statementStage;if(!st)return;var gap=st.outflow-st.logged,pending=pendingUnmatched();
  openSheet('<div class="pull"></div><b style="font-size:17px">Statement comparison</b><div class="statement-score"><div><span>Matched</span><b>'+st.matched.length+'</b></div><div><span>Review</span><b>'+pending.length+'</b></div><div><span>Difference</span><b class="'+(gap?'danger':'')+'">'+(gap<0?'-':'')+money(Math.abs(gap),false)+'</b></div></div><div class="block" style="margin-top:12px"><div class="flex"><span class="dim">Statement outflow</span><b>'+money(st.outflow,false)+'</b></div><div class="flex" style="margin-top:8px"><span class="dim">Budget Margin book</span><b>'+money(st.logged,false)+'</b></div><div class="flex" style="margin-top:8px"><span class="dim">Statement inflow</span><b>'+money(st.inflow,false)+'</b></div></div>'+(pending.length?'<div class="review-callout"><b>'+pending.length+' transactions need review</b><span>Nothing is added until you approve it.</span></div><button class="go" id="siReview">Review unmatched</button>':'<div class="success-note">No unmatched transactions are waiting for review.</div>')+'<button class="sm" id="siSave" style="width:100%;margin-top:9px">Save reconciliation</button><button class="flat" id="siBack">Choose another file</button>');
  if(pending.length)document.getElementById("siReview").onclick=function(){openReviewTxn();};
  document.getElementById("siBack").onclick=function(){shut();document.getElementById("statementFile").click();};
  document.getElementById("siSave").onclick=function(){var label=dateShort(st.first)+" – "+dateShort(st.last),left=pendingUnmatched().length,rec={p:st.first,label:label,logged:st.logged,actual:st.outflow,source:st.source,account:st.account,matched:st.matched.length,missing:left,file:st.name};S.recs.push(rec);S.imports.push({id:"i"+Date.now(),date:iso(today()),label:label,account:st.account,matched:st.matched.length,missing:left,difference:st.outflow-st.logged,file:st.name,source:st.source,added:st.added||0,ignored:st.ignored||0});save();statementStage=null;shut();redraw();toast("Reconciliation saved");};
}
function openReviewTxn(){
  var st=statementStage,p=pendingUnmatched();if(!st||!p.length){openStatementResult();return;}var r=p[0],out=!!r.out,amt=r.out||r.inc,cat=r.suggested||S.cats[0]&&S.cats[0].id||"",opts=S.cats.map(function(c){return '<option value="'+c.id+'"'+(c.id===cat?' selected':'')+'>'+esc(c.name)+'</option>';}).join("");
  openSheet('<div class="pull"></div><div class="review-progress">'+(st.unmatched.length-p.length+1)+' of '+st.unmatched.length+'</div><b style="font-size:18px">'+esc(r.desc||"Unlabelled transaction")+'</b><div class="review-amount '+(out?'danger':'income-text')+'">'+(out?'-':'+')+money(amt,false)+'</div><div class="tiny dim">'+dateShort(r.date)+' · '+esc(accountName(st.account))+'</div>'+(out?'<div class="field" style="margin-top:14px"><label for="rvCat">Envelope</label><select id="rvCat">'+opts+'</select></div><label class="toggle-row compact"><input id="rvRemember" type="checkbox" checked><span><b>Remember this merchant</b><small>Suggest this envelope next time.</small></span></label><button class="go" id="rvAdd">Add as spending</button>':'<button class="go" id="rvIncome" style="margin-top:15px">Add as income</button>')+'<button class="sm" id="rvTransfer" style="width:100%;margin-top:8px">Transfer / card payment</button><button class="flat" id="rvIgnore">Ignore this transaction</button><button class="flat" id="rvBack">Back to summary</button>');
  function next(){save();if(pendingUnmatched().length)openReviewTxn();else openStatementResult();}
  if(out)document.getElementById("rvAdd").onclick=function(){var c=document.getElementById("rvCat").value;S.txns.push({id:uid(),date:r.date,sgd:r.out,cur:"SGD",orig:r.out,cat:c,note:r.desc,account:st.account});if(document.getElementById("rvRemember").checked)rememberRule(r.desc,c);r.status="added";st.added++;st.logged+=r.out;next();};
  else document.getElementById("rvIncome").onclick=function(){S.ledger.push({id:"l"+Date.now(),type:"income",account:st.account,amount:r.inc,cur:"SGD",date:r.date,note:r.desc,createdAt:Date.now()});r.status="added";st.added++;next();};
  document.getElementById("rvTransfer").onclick=function(){openReviewTransfer(r);};document.getElementById("rvIgnore").onclick=function(){r.status="ignored";st.ignored++;next();};document.getElementById("rvBack").onclick=openStatementResult;
}
function openReviewTransfer(r){
  var st=statementStage,aid=st.account,opts=ledgerAccountOptions("","Choose other account");openSheet('<div class="pull"></div><b style="font-size:17px">Classify movement</b><p class="hint">'+esc(r.desc||"")+' · '+money(r.out||r.inc,false)+'</p><div class="field"><label for="rvtType">Type</label><select id="rvtType"><option value="transfer">Transfer between my accounts</option><option value="card_payment">Credit-card payment</option><option value="expense">Bank fee / non-budget expense</option><option value="refund">Refund</option></select></div><div class="field"><label for="rvtOther">Other account</label><select id="rvtOther">'+opts+'</select></div><button class="go" id="rvtSave">Save classification</button><button class="flat" id="rvtCancel">Back</button>');document.getElementById("rvtCancel").onclick=openReviewTxn;document.getElementById("rvtSave").onclick=function(){var t=document.getElementById("rvtType").value,o=document.getElementById("rvtOther").value,amount=r.out||r.inc,x={id:"l"+Date.now(),type:t,amount:amount,cur:"SGD",date:r.date,note:r.desc,createdAt:Date.now(),account:"",from:"",to:""};if(t==="transfer"||t==="card_payment"){if(!o){toast("Choose the other account");return;}if(r.out){x.from=aid;x.to=o;}else{x.from=o;x.to=aid;}}else{x.account=aid;}S.ledger.push(x);r.status="added";st.added++;if(r.out&&t==="expense")st.logged+=r.out;save();if(pendingUnmatched().length)openReviewTxn();else openStatementResult();};
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
  document.getElementById("hLabel").textContent=pLabel(hStart);var grid=document.getElementById("calendarGrid"),detail=document.getElementById("calendarDayDetail");if(!grid)return;grid.innerHTML="";detail.innerHTML="";grid.className='lm-cal';var a=hStart,b=pShift(hStart,1),cursor=new Date(a),first=(a.getDay()+6)%7,max=1;var sums={};for(var d0=new Date(a);d0<b;d0.setDate(d0.getDate()+1)){var ds0=iso(d0),su=spent(d0,new Date(d0.getFullYear(),d0.getMonth(),d0.getDate()+1));sums[ds0]=su;if(su>max)max=su;}for(var z=0;z<first;z++)grid.appendChild(el("span","calendar-blank"));var ix=0;while(cursor<b){(function(d,i){var ds=iso(d),sum=sums[ds]||0,cell=el("button","lm-cal-day");cell.style.animationDelay=(i*18)+'ms';cell.setAttribute('aria-pressed',lmSelectedDay===ds?'true':'false');var fill=el('span','lm-fill');cell.appendChild(fill);cell.appendChild(el("span","lm-cal-num",String(d.getDate())));cell.appendChild(el("span","lm-cal-amt",sum>0?money(sum,false):""));cell.addEventListener("click",function(){lmSelectedDay=ds;drawCalendar();});grid.appendChild(cell);if(window.LM)LM.setFill(cell,sum/max,false);})(new Date(cursor),ix++);cursor.setDate(cursor.getDate()+1);}var td=lmSelectedDay||iso(today());if(pIso(td)>=a&&pIso(td)<b){lmSelectedDay=td;var c=Array.prototype.find.call(grid.querySelectorAll('.lm-cal-day'),function(x){return x.querySelector('.lm-cal-num')&&x.querySelector('.lm-cal-num').textContent===String(pIso(td).getDate());});if(c)c.setAttribute('aria-pressed','true');drawCalendarDay(td,detail);}
}
function drawCalendarDay(ds,detail){
  detail.innerHTML=""; var list=S.txns.filter(function(t){return t.date===ds;}).slice().reverse();
  var head=el("div","calendar-detail-head"); head.appendChild(el("b",null,dayLab(ds))); head.appendChild(el("span","tab",money(list.reduce(function(a,t){return a+t.sgd;},0),false))); detail.appendChild(head);
  if(!list.length){detail.appendChild(el("div","empty compact","No spending logged on this day."));return;}
  list.forEach(function(t){var row=el("button","calendar-txn"),c=catOf(t.cat),l=el("span","calendar-txn-left");if(c)l.appendChild(iconBadge(c));var cp=el("span");cp.appendChild(el("b",null,catName(t.cat)));if(t.note||t.account)cp.appendChild(el("small",null,[t.note||"",t.account?accountName(t.account):""].filter(Boolean).join(" · ")));l.appendChild(cp);row.appendChild(l);row.appendChild(el("b","tab",money(t.sgd)));row.addEventListener("click",function(){openEdit(t.id);});detail.appendChild(row);});
}
function statsPeriodSeries(count){
  var out=[], end=pShift(pStart(today()),1);
  for(var i=count-1;i>=0;i--){
    var a=pShift(end,-i-1),b=pShift(a,1),expense=0,income=0;
    S.txns.forEach(function(t){if(inR(t,a,b))expense+=t.sgd||0;});
    S.ledger.forEach(function(x){if(!x.date||!inR(x,a,b))return;var v=ledgerAmountSgd(x);if(x.type==="income"||x.type==="refund")income+=v;else if(x.type==="expense")expense+=v;});
    out.push({a:a,b:b,label:MO[a.getMonth()]+" "+String(a.getFullYear()).slice(-2),expense:expense,saved:income>0?income-expense:null,income:income});
  }
  return out;
}
function svgEl(n,attrs){var x=document.createElementNS("http://www.w3.org/2000/svg",n);Object.keys(attrs||{}).forEach(function(k){x.setAttribute(k,attrs[k]);});return x;}
function piePoint(cx,cy,r,ang){var q=(ang-90)*Math.PI/180;return [cx+r*Math.cos(q),cy+r*Math.sin(q)];}
function piePath(cx,cy,r,a0,a1){var p0=piePoint(cx,cy,r,a0),p1=piePoint(cx,cy,r,a1),large=(a1-a0)>180?1:0;return "M "+cx+" "+cy+" L "+p0[0]+" "+p0[1]+" A "+r+" "+r+" 0 "+large+" 1 "+p1[0]+" "+p1[1]+" Z";}
function drawSpendPie(container,items,total){
  var wrap=el("div","pie-wrap"),svg=svgEl("svg",{viewBox:"0 0 140 140",role:"img","aria-label":"Spending by category"}),info=el("div","pie-focus");
  var ang=0;items.forEach(function(it,idx){var pct=it.amt/total*360,path=svgEl("path",{d:piePath(70,70,62,ang,ang+pct),fill:hueOf(it.cid),tabindex:"0"});path.classList.add("pie-slice");var show=function(){Array.prototype.forEach.call(svg.querySelectorAll(".pie-slice"),function(x){x.classList.remove("selected");});path.classList.add("selected");info.innerHTML='<b>'+esc(catName(it.cid))+'</b><span class="tab">'+money(it.amt,false)+' · '+Math.round(it.amt/total*100)+'%</span>';};path.addEventListener("click",show);path.addEventListener("touchstart",show,{passive:true});path.addEventListener("focus",show);svg.appendChild(path);ang+=pct;});
  wrap.appendChild(svg);info.innerHTML='<b>Total spent</b><span class="tab">'+money(total,false)+'</span>';wrap.appendChild(info);container.appendChild(wrap);
}
function drawTrendChart(container,series){
  var card=el("div","trend-line-card"),head=el("div","trend-line-head");head.innerHTML='<div><b>Expenditure & savings</b><small>Tap a point for exact values</small></div><div class="trend-legend"><span><i class="expense-dot"></i>Spend</span><span><i class="save-dot"></i>Net saved</span></div>';card.appendChild(head);
  var chart=el("div","linechart"),svg=svgEl("svg",{viewBox:"0 0 360 190",preserveAspectRatio:"none",role:"img","aria-label":"Expenditure and savings trend"}),tip=el("div","line-tip");
  var vals=[];series.forEach(function(s){vals.push(s.expense);if(s.saved!=null)vals.push(s.saved);});var min=Math.min(0,Math.min.apply(null,vals)),max=Math.max(1,Math.max.apply(null,vals));if(max===min)max=min+1;var left=26,right=350,top=15,bottom=153,w=right-left,h=bottom-top;
  function y(v){return top+(max-v)/(max-min)*h;} function x(i){return series.length===1?(left+right)/2:left+i*w/(series.length-1);}
  var zero=y(0);svg.appendChild(svgEl("line",{x1:left,y1:zero,x2:right,y2:zero,class:"chart-zero"}));
  [0,.25,.5,.75,1].forEach(function(f){var yy=top+h*f;svg.appendChild(svgEl("line",{x1:left,y1:yy,x2:right,y2:yy,class:"chart-grid"}));});
  function pathFor(key){var d="",open=false;series.forEach(function(s,i){var v=s[key];if(v==null){open=false;return;}d+=(open?" L ":"M ")+x(i)+" "+y(v);open=true;});return d;}
  svg.appendChild(svgEl("path",{d:pathFor("expense"),class:"chart-line expense-line"}));var sp=pathFor("saved");if(sp)svg.appendChild(svgEl("path",{d:sp,class:"chart-line save-line"}));
  series.forEach(function(s,i){var xx=x(i);var hit=svgEl("rect",{x:Math.max(0,xx-18),y:0,width:36,height:190,fill:"transparent",class:"chart-hit",tabindex:"0"});var show=function(){var saving=s.saved==null?"Savings not tracked — add income entries":"Net saved "+(s.saved<0?"-":"")+money(Math.abs(s.saved),false);tip.innerHTML='<b>'+esc(s.label)+'</b><span>Spent '+money(s.expense,false)+' · '+saving+(s.income?' · Income '+money(s.income,false):'')+'</span>';Array.prototype.forEach.call(svg.querySelectorAll(".chart-point"),function(q){q.classList.remove("active");});var a=svg.querySelector('[data-i="'+i+'"]'),b=svg.querySelector('[data-j="'+i+'"]');if(a)a.classList.add("active");if(b)b.classList.add("active");};hit.addEventListener("click",show);hit.addEventListener("touchstart",show,{passive:true});hit.addEventListener("focus",show);svg.appendChild(hit);var p1=svgEl("circle",{cx:xx,cy:y(s.expense),r:4,class:"chart-point expense-point","data-i":i});svg.appendChild(p1);if(s.saved!=null){var p2=svgEl("circle",{cx:xx,cy:y(s.saved),r:4,class:"chart-point save-point","data-j":i});svg.appendChild(p2);}var lab=svgEl("text",{x:xx,y:176,class:"chart-label","text-anchor":"middle"});lab.textContent=s.label;svg.appendChild(lab);});
  chart.appendChild(svg);chart.appendChild(tip);card.appendChild(chart);container.appendChild(card);
}

function drawStats(){
  document.getElementById("hLabel").textContent=pLabel(hStart);
  var box=document.getElementById("statsBody"); if(!box)return; box.innerHTML="";
  var a=hStart,b=pShift(hStart,1), list=S.txns.filter(function(t){return inR(t,a,b);}), total=list.reduce(function(x,t){return x+t.sgd;},0);
  if(!list.length){box.appendChild(el("div","empty","Nothing to analyse in this period yet."));return;}
  var by={}; list.forEach(function(t){by[t.cat]=(by[t.cat]||0)+t.sgd;});
  var items=Object.keys(by).map(function(cid){return {cid:cid,amt:by[cid]};}).sort(function(x,y){return y.amt-x.amt;});
  var card=el("div","stats-card"),title=el("div","stats-title");title.appendChild(el("b",null,"Spending mix"));title.appendChild(el("span",null,list.length+(list.length===1?" transaction":" transactions")));card.appendChild(title);drawSpendPie(card,items,total);
  var cats=el("div","stats-cats");items.forEach(function(it){var c=catOf(it.cid),r=el("button","stats-cat"),l=el("span","stats-cat-left");if(c)l.appendChild(iconBadge(c));var tx=el("span");tx.appendChild(el("b",null,catName(it.cid)));tx.appendChild(el("small",null,Math.round(it.amt/total*100)+"% of spending"));l.appendChild(tx);r.appendChild(l);r.appendChild(el("b","tab",money(it.amt,false)));r.addEventListener("click",function(){S.historyView="list";save();drawHist();var f=document.getElementById("hCatFilter");if(f){f.value=it.cid;drawHistoryList();}});cats.appendChild(r);});card.appendChild(cats);box.appendChild(card);
  var range=el("div","trend-range seg");[3,6,12].forEach(function(n){var bt=el("button",null,n+" periods");bt.setAttribute("aria-pressed",n===(S.insightPeriods||6)?"true":"false");bt.onclick=function(){S.insightPeriods=n;save();drawStats();};range.appendChild(bt);});box.appendChild(range);drawTrendChart(box,statsPeriodSeries(S.insightPeriods||6));
}
function drawAnalytics(){
  document.getElementById("hLabel").textContent=pLabel(hStart);var box=document.getElementById('analyticsBody');if(!box)return;box.innerHTML='';var a=hStart,b=pShift(hStart,1),list=S.txns.filter(function(t){return inR(t,a,b);}),total=list.reduce(function(x,t){return x+(t.sgd||0);},0);if(!list.length){box.appendChild(el('div','empty','Nothing to analyse in this period yet.'));return;}var by={};list.forEach(function(t){by[t.cat]=(by[t.cat]||0)+(t.sgd||0);});var items=Object.keys(by).map(function(cid){return {cid:cid,name:catName(cid),value:by[cid],color:hueOf(cid)};}).sort(function(x,y){return y.value-x.value;});var card=el('div','lm-analytics-card'),head=el('div','stats-title');head.appendChild(el('b',null,'Where it went'));head.appendChild(el('span',null,list.length+' transactions'));card.appendChild(head);var wrap=el('div','lm-donut-wrap'),svg=svgEl('svg',{viewBox:'0 0 160 160',class:'lm-donut'}),legend=el('div','lm-legend');function paintDonut(){if(window.LM)LM.donut(svg,items,function(name){lmIsolatedCategory=lmIsolatedCategory===name?null:name;drawAnalytics();},lmIsolatedCategory);}paintDonut();var center=el('div','lm-donut-center');var focused=items.filter(function(x){return x.name===lmIsolatedCategory;})[0];center.innerHTML='<span>'+(focused?esc(focused.name):'TOTAL')+'</span><b>'+money(focused?focused.value:total,false)+'</b>';var sw=el('div','lm-donut-stage');sw.appendChild(svg);sw.appendChild(center);wrap.appendChild(sw);items.slice(0,7).forEach(function(it){var r=el('button','lm-legend-row'),dot=el('i');dot.style.background=it.color;r.appendChild(dot);r.appendChild(el('span',null,it.name));r.appendChild(el('b',null,Math.round(it.value/total*100)+'%'));if(lmIsolatedCategory&&lmIsolatedCategory!==it.name)r.style.opacity='.3';r.onclick=function(){lmIsolatedCategory=lmIsolatedCategory===it.name?null:it.name;drawAnalytics();};legend.appendChild(r);});wrap.appendChild(legend);card.appendChild(wrap);box.appendChild(card);
  var range=el('div','trend-range seg');[3,6,12].forEach(function(n){var bt=el('button',null,n+' months');bt.setAttribute('aria-pressed',n===(S.insightPeriods||6)?'true':'false');bt.onclick=function(){S.insightPeriods=n;save();lmActiveMonth=-1;drawAnalytics();};range.appendChild(bt);});box.appendChild(range);var series=statsPeriodSeries(S.insightPeriods||6),lineCard=el('div','lm-analytics-card'),lh=el('div','trend-line-head');lh.innerHTML='<div><b>Expenditure & savings</b><small>Tap a month to inspect it</small></div><div class="trend-legend"><span><i class="expense-dot"></i>Spend</span><span><i class="save-dot"></i>Saved</span></div>';lineCard.appendChild(lh);var lsvg=svgEl('svg',{viewBox:'0 0 300 168',class:'lm-chart'}),vals=[];series.forEach(function(s){vals.push(s.expense);if(s.saved!=null)vals.push(Math.max(0,s.saved));});var geom=window.LM?LM.lineGeom(vals.length?vals:[1],series.length):null;[18,50,82,114,146].forEach(function(y){lsvg.appendChild(svgEl('line',{x1:12,y1:y,x2:288,y2:y,class:'lm-grid-line'}));});if(geom){var exp=series.map(function(s){return s.expense||0;}),sav=series.map(function(s){return Math.max(0,s.saved||0);});var defs=svgEl('defs'),grad=svgEl('linearGradient',{id:'lmArea',x1:'0',y1:'0',x2:'0',y2:'1'});grad.appendChild(svgEl('stop',{offset:'0%','stop-color':'var(--amber)','stop-opacity':'.28'}));grad.appendChild(svgEl('stop',{offset:'100%','stop-color':'var(--amber)','stop-opacity':'0'}));defs.appendChild(grad);lsvg.appendChild(defs);lsvg.appendChild(svgEl('path',{d:geom.area(exp),fill:'url(#lmArea)'}));lsvg.appendChild(svgEl('path',{d:geom.path(exp),class:'lm-line lm-line--spend'}));lsvg.appendChild(svgEl('path',{d:geom.path(sav),class:'lm-line lm-line--save'}));series.forEach(function(s,i){var x=geom.X(i),p1=svgEl('circle',{cx:x,cy:geom.Y(exp[i]),r:i===lmActiveMonth?6:3.5,class:'lm-point',fill:'var(--amber)'}),p2=svgEl('circle',{cx:x,cy:geom.Y(sav[i]),r:i===lmActiveMonth?6:3.5,class:'lm-point',fill:'var(--jade)'}),hit=svgEl('rect',{x:Math.max(0,x-18),y:0,width:36,height:155,fill:'transparent'});hit.onclick=function(){lmActiveMonth=i;drawAnalytics();};lsvg.appendChild(p1);lsvg.appendChild(p2);lsvg.appendChild(hit);var tx=svgEl('text',{x:x,y:164,'text-anchor':'middle',class:'chart-label'});tx.textContent=s.label;lsvg.appendChild(tx);});}lineCard.appendChild(lsvg);var active=series[Math.max(0,lmActiveMonth<0?series.length-1:lmActiveMonth)]||series[0],tip=el('div','lm-tip');if(active){var sv=active.saved==null?null:active.saved,avg=series.reduce(function(q,s){return q+s.expense;},0)/series.length;tip.innerHTML='<b>'+esc(active.label)+' · spent '+money(active.expense,false)+(sv==null?' · savings not tracked':' · saved '+(sv<0?'-':'')+money(Math.abs(sv),false))+'</b><span>'+(active.income?('Savings rate '+Math.round(sv/active.income*100)+'% · '):'')+money(Math.abs(active.expense-avg),false)+' '+(active.expense>avg?'above':'below')+' the '+series.length+'-month average</span>';}lineCard.appendChild(tip);box.appendChild(lineCard);
}
function drawHist(){
  var cf=document.getElementById("hCatFilter"), af=document.getElementById("hAccountFilter");
  if(cf){var ck=cf.value;cf.innerHTML='<option value="">All envelopes</option>';S.cats.forEach(function(c){var o=document.createElement("option");o.value=c.id;o.textContent=c.name;cf.appendChild(o);});cf.value=ck;}
  if(af){var ak=af.value;af.innerHTML='<option value="">All accounts</option><option value="__none">Unassigned</option>';S.accounts.forEach(function(a){var o=document.createElement("option");o.value=a.id;o.textContent=a.name;af.appendChild(o);});af.value=ak;}
  var v=S.historyView||"list", lv=document.getElementById("historyListView"), cv=document.getElementById("historyCalendarView"), sv=document.getElementById("historyStatsView"), av=document.getElementById("historyAnalyticsView");
  if(lv)lv.hidden=v!=="list"; if(cv)cv.hidden=v!=="calendar"; if(sv)sv.hidden=v!=="stats"; if(av)av.hidden=v!=="analytics";
  Array.prototype.forEach.call(document.querySelectorAll("[data-hview]"),function(b){b.setAttribute("aria-pressed",b.dataset.hview===v?"true":"false");});
  if(v==="calendar")drawCalendar(); else if(v==="stats")drawStats(); else if(v==="analytics")drawAnalytics(); else drawHistoryList();
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
  var dc=document.getElementById("sDailyCap"); if(dc)dc.value=S.dailyCap?((S.dailyCap/100).toFixed(0)):"";
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
  var base=location.href.split("?")[0].split("#")[0];
  var cl=document.getElementById("captureLink");if(cl)cl.textContent=base+"#capture=1&app=DBS&text=[URL-ENCODED NOTIFICATION TEXT]";
  var hs=document.getElementById("historicalStatus"),hr=document.getElementById("historicalRemove");if(hs){var hi=S.historicalImports||[];hs.textContent=hi.length?("Historical migration completed: "+hi.reduce(function(a,x){return a+(x.spending||0)+(x.ledger||0);},0)+" records across "+hi.length+" import"+(hi.length===1?"":"s")+". Historical rows do not change current account balances."):"No historical migration imported yet.";if(hr)hr.hidden=!hi.length;}
  S.cats.slice(0,4).forEach(function(c){
    var v=(c.quick&&c.quick[0])||500;
    var d=el("div",null,c.name+" "+(v/100).toFixed(2)+" → "+base+"?log="+c.id+"&amt="+v);
    d.style.cssText="word-break:break-all;margin-bottom:7px;color:var(--dim)";
    sc.appendChild(d);
  });
  drawRecHist();
  var ss=document.getElementById("statementStatus");
  if(ss){
    if(S.imports.length){
      var im=S.imports[S.imports.length-1];
      ss.textContent="Last CSV check: "+im.label+" · "+im.matched+" matched, "+im.missing+" missing · difference "+(im.difference<0?"-":"")+money(Math.abs(im.difference),false)+".";
    } else ss.textContent="CSV works fully on-device. PDF 3.1 beta extracts text in a sandboxed parser, then all matching/review happens locally.";
  }
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
document.getElementById("mDay").addEventListener("click",function(){ S.mode="day"; save(); redraw(); });
document.getElementById("mWeek").addEventListener("click",function(){ S.mode="week"; save(); redraw(); });
document.getElementById("mPeriod").addEventListener("click",function(){ S.mode="period"; save(); redraw(); });
document.getElementById("hPrev").addEventListener("click",function(){ hStart=pShift(hStart,-1); drawHist(); });
document.getElementById("hNext").addEventListener("click",function(){ hStart=pShift(hStart,1); drawHist(); });
document.getElementById("sStart").addEventListener("change",function(){ S.startDay=parseInt(this.value,10)||1; save(); hStart=pStart(today()); redraw(); });
document.getElementById("sRate").addEventListener("change",function(){ var r=parseFloat(this.value); S.rate=(r>0?r:3.35); save(); redraw(); });
document.getElementById("sDailyCap").addEventListener("change",function(){ S.dailyCap=toCents(this.value); save(); redraw(); });
document.getElementById("addCat").addEventListener("click",function(){
  var i=document.getElementById("newCat"), v=i.value.trim(); if(!v) return;
  S.cats.push({id:"c"+Date.now(),name:v,icon:"dots",cap:0,quick:[500,1000,2000,5000]}); i.value=""; save(); redraw(); });
document.getElementById("addAccount").addEventListener("click",function(){openAccount();});
document.getElementById("addGoal").addEventListener("click",function(){openGoal();});
document.getElementById("addLedger").addEventListener("click",function(){openLedger();});
document.getElementById("addRecurring").addEventListener("click",function(){openRecurring();});
document.getElementById("commitmentNote").addEventListener("click",function(){go("plan");});
document.getElementById("debtStrategy").addEventListener("change",function(){S.debtPlan.strategy=this.value;save();drawDebt();});
document.getElementById("debtMonthlyBudget").addEventListener("change",function(){S.debtPlan.monthlyBudget=toCents(this.value);save();drawDebt();});
document.getElementById("addDebt").addEventListener("click",function(){
  var i=document.getElementById("newDebt"), v=i.value.trim(); if(!v) return;
  S.debts.push({id:"d"+Date.now(),name:v,start:0,bal:0,rate:0,minPay:0}); i.value=""; save(); redraw();
  toast("Tap it to set the balance"); });
document.getElementById("recNow").addEventListener("click",function(){ openRec(lastClosedPeriod()); });
function parsePdfDateToken(tok,yearHint){var m=String(tok||"").match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);if(!m)return null;var d=+m[1],mo=+m[2],y=m[3]?+m[3]:yearHint;if(y<100)y+=2000;if(!y)y=(new Date()).getFullYear();var dt=new Date(y,mo-1,d);return isNaN(dt.getTime())?null:dt;}
function pdfLinesToRows(lines){var rows=[],yearHint=(new Date()).getFullYear(),pending=null;lines.forEach(function(line){var yr=line.match(/\b(20\d{2})\b/);if(yr)yearHint=+yr[1];var dm=line.match(/^\s*(\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)\s+(.*)$/);if(dm){var dt=parsePdfDateToken(dm[1],yearHint);if(!dt)return;var rest=dm[2],nums=rest.match(/(?:SGD|S\$|RM)?\s*-?\d[\d,]*\.\d{2}/g)||[];if(!nums.length)return;var vals=nums.map(function(x){return parseFloat(x.replace(/[^0-9.-]/g,"").replace(/,/g,""));}).filter(function(x){return !isNaN(x);});if(!vals.length)return;var amt=vals.length>1?vals[vals.length-2]:vals[0],desc=rest.replace(/(?:SGD|S\$|RM)?\s*-?\d[\d,]*\.\d{2}/g," ").replace(/\s+/g," ").trim();var low=rest.toLowerCase(),credit=/credit|deposit|salary|refund|interest paid|transfer in/.test(low),debit=/debit|withdrawal|purchase|payment|fee|transfer out/.test(low);var out=0,inc=0;if(amt<0)out=Math.abs(amt);else if(credit&&!debit)inc=amt;else out=amt;rows.push({date:iso(dt),desc:desc,out:Math.round(out*100),inc:Math.round(inc*100)});}});return rows;}
function extractPdfStatement(file){
  if(!navigator.onLine){toast("PDF import needs internet once. CSV remains fully offline.");return;}
  toast("Reading PDF…");var frame=document.createElement("iframe");frame.setAttribute("sandbox","allow-scripts");frame.style.display="none";var token="pdf"+Date.now();var src='<!doctype html><meta charset="utf-8"><script type="module">import * as pdfjsLib from "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs";pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";addEventListener("message",async e=>{if(!e.data||e.data.type!=="parse")return;try{let pdf=await pdfjsLib.getDocument({data:e.data.buf,isEvalSupported:false}).promise,lines=[];for(let n=1;n<=pdf.numPages;n++){let pg=await pdf.getPage(n),tc=await pg.getTextContent(),items=tc.items.map(x=>({s:x.str,x:x.transform[4],y:x.transform[5]})).sort((a,b)=>Math.abs(b.y-a.y)>2?b.y-a.y:a.x-b.x),cur=[],lastY=null;for(let it of items){if(lastY!==null&&Math.abs(it.y-lastY)>2){if(cur.length)lines.push(cur.join(" "));cur=[];}cur.push(it.s);lastY=it.y;}if(cur.length)lines.push(cur.join(" "));}parent.postMessage({type:"pdfdone",token:e.data.token,lines},"*");}catch(err){parent.postMessage({type:"pdferr",token:e.data.token,message:String(err&&err.message||err)},"*");}});<\/script>';
  var timer=setTimeout(function(){cleanup();toast("PDF parser timed out. CSV is still available offline.");},30000),loaded=false,buf=null;
  function cleanup(){clearTimeout(timer);window.removeEventListener("message",onmsg);try{frame.remove();}catch(e){}}
  function send(){if(!loaded||!buf)return;try{frame.contentWindow.postMessage({type:"parse",token:token,buf:buf},"*",[buf]);buf=null;}catch(e){cleanup();toast("Could not pass this PDF to the parser");}}
  function onmsg(e){var d=e.data||{};if(d.token!==token)return;if(d.type==="pdferr"){cleanup();toast("Could not read this PDF");return;}if(d.type==="pdfdone"){cleanup();var rows=pdfLinesToRows(d.lines||[]);if(!rows.length){openPdfTextFallback(file.name,d.lines||[]);return;}openPdfAccountConfirm(file.name,rows);}}
  window.addEventListener("message",onmsg);frame.onload=function(){loaded=true;send();};frame.srcdoc=src;document.body.appendChild(frame);
  file.arrayBuffer().then(function(b){buf=b;send();}).catch(function(){cleanup();toast("Could not open that PDF");});
}

function openPdfAccountConfirm(name,rows){openSheet('<div class="pull"></div><b style="font-size:17px">PDF statement found</b><p class="hint">Budget Margin extracted '+rows.length+' transaction-like rows. PDF layouts vary, so review the totals before accepting.</p><div class="field"><label for="pdfAcc">Account</label><select id="pdfAcc">'+ledgerAccountOptions(S.defaultAccount||"","Choose statement account")+'</select></div><div class="block"><div class="flex"><span class="dim">Money out</span><b>'+money(rows.reduce(function(a,r){return a+(r.out||0);},0),false)+'</b></div><div class="flex" style="margin-top:8px"><span class="dim">Money in</span><b>'+money(rows.reduce(function(a,r){return a+(r.inc||0);},0),false)+'</b></div></div><button class="go" id="pdfUse">Compare with book</button><button class="flat" id="pdfCancel">Cancel</button>');document.getElementById("pdfCancel").onclick=shut;document.getElementById("pdfUse").onclick=function(){var a=document.getElementById("pdfAcc").value;if(!a){toast("Choose the statement account");return;}analyzeStatement(name,a,rows,"pdf");};}
function openPdfTextFallback(name,lines){openSheet('<div class="pull"></div><b style="font-size:17px">PDF needs a template</b><p class="hint">Text was extracted, but the generic parser could not confidently identify transactions. This usually means the bank uses a different table layout or the PDF is scanned.</p><div class="pdf-text-sample">'+esc((lines||[]).slice(0,18).join("\n"))+'</div><button class="flat" id="pdfClose">Close</button>');document.getElementById("pdfClose").onclick=shut;}


function removeHistoricalImports(){
  var created={};(S.historicalImports||[]).forEach(function(h){(h.createdAccounts||[]).forEach(function(id){created[id]=1;});});
  S.txns=S.txns.filter(function(t){return t.source!=="historical_import";});
  S.ledger=S.ledger.filter(function(x){return x.source!=="historical_import";});
  S.accounts=S.accounts.filter(function(a){return !(a.source==="historical_import"&&created[a.id]);});
  S.historicalImports=[];save();redraw();toast("Historical migration removed");
}
document.getElementById("historicalImport").addEventListener("click",function(){document.getElementById("historicalFile").click();});
document.getElementById("historicalFile").addEventListener("change",function(){var f=this.files&&this.files[0];if(!f)return;var reader=new FileReader();reader.onload=function(){previewHistorical(String(reader.result||""),f.name);};reader.readAsText(f);this.value="";});
var histRemove=document.getElementById("historicalRemove");if(histRemove)histRemove.addEventListener("click",function(){if(!confirm("Remove all historical-import records? Current manual data will be kept. Any account created only by the historical import will also be removed."))return;removeHistoricalImports();});
document.getElementById("testCapture").addEventListener("click",function(){addCapture(parseNotificationText("Old Chang Kee, Singapore, SG\nSGD 4.90",{app:"DBS Bank"}));});
document.getElementById("statementImport").addEventListener("click",function(){document.getElementById("statementFile").click();});
document.getElementById("statementFile").addEventListener("change",function(){
  var f=this.files&&this.files[0];if(!f)return;var isPdf=/\.pdf$/i.test(f.name)||f.type==="application/pdf";if(isPdf){extractPdfStatement(f);this.value="";return;}var reader=new FileReader();
  reader.onload=function(){try{var rows=parseCsv(String(reader.result||""));openStatementMapping(f.name,rows);}catch(e){toast("Could not read that statement file");}};
  reader.readAsText(f);this.value="";
});
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
      S=p; if(!S.accent)S.accent="jade"; if(!S.theme)S.theme="midnight"; if(!S.historyView)S.historyView="list"; if(!Array.isArray(S.bookmarks))S.bookmarks=[]; if(!Array.isArray(S.accounts))S.accounts=[]; if(!Array.isArray(S.recurring))S.recurring=[]; if(!S.recurringDone||typeof S.recurringDone!=="object")S.recurringDone={}; if(!Array.isArray(S.ledger))S.ledger=[]; if(!Array.isArray(S.goals))S.goals=[]; if(!Array.isArray(S.goalContrib))S.goalContrib=[]; if(!Array.isArray(S.imports))S.imports=[]; if(!S.merchantRules||typeof S.merchantRules!=="object")S.merchantRules={}; if(!Array.isArray(S.captures))S.captures=[]; if(!Array.isArray(S.historicalImports))S.historicalImports=[]; if(!S.defaultAccount)S.defaultAccount=""; S.accounts.forEach(function(a){if(a.baseBalance==null)a.baseBalance=a.balance||0;if(!a.snapshotAt)a.snapshotAt=Date.now();}); var defs=["fork","cart","cup","car","bag","spark","dots"]; S.cats.forEach(function(c,i){if(!c.icon)c.icon=defs[i%defs.length];}); save(); hStart=pStart(today()); redraw(); toast("Backup restored");
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
  try{ var p=JSON.parse(raw); if(!p||!Array.isArray(p.txns)||!Array.isArray(p.cats))throw 0; S=p; if(!S.accent)S.accent="jade"; if(!S.theme)S.theme="midnight"; if(!S.historyView)S.historyView="list"; if(!Array.isArray(S.bookmarks))S.bookmarks=[]; if(!Array.isArray(S.accounts))S.accounts=[]; if(!Array.isArray(S.recurring))S.recurring=[]; if(!S.recurringDone||typeof S.recurringDone!=="object")S.recurringDone={}; if(!Array.isArray(S.ledger))S.ledger=[]; if(!Array.isArray(S.goals))S.goals=[]; if(!Array.isArray(S.goalContrib))S.goalContrib=[]; if(!Array.isArray(S.imports))S.imports=[]; if(!S.merchantRules||typeof S.merchantRules!=="object")S.merchantRules={}; if(!Array.isArray(S.captures))S.captures=[]; if(!Array.isArray(S.historicalImports))S.historicalImports=[]; if(!S.defaultAccount)S.defaultAccount=""; S.accounts.forEach(function(a){if(a.baseBalance==null)a.baseBalance=a.balance||0;if(!a.snapshotAt)a.snapshotAt=Date.now();}); localStorage.setItem(KEY,JSON.stringify(S)); redraw(); toast("Previous state recovered"); }
  catch(e){toast("The previous local state could not be recovered");}
});
document.getElementById("checkUpdate").addEventListener("click",function(){
  if(updateReady&&swReg&&swReg.waiting){ swReg.waiting.postMessage({type:"SKIP_WAITING"}); return; }
  if(swReg){ document.getElementById("updateText").textContent="Checking…"; swReg.update().then(function(){ setTimeout(function(){ if(!updateReady){document.getElementById("updateText").textContent="You already have the latest Budget Margin 3.4 files.";} },500); }).catch(function(){toast("Could not check for updates");}); }
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
  if(u)u.textContent=updateReady?"Budget Margin 3.4 update ready — apply it now.":(online?"Budget Margin 3.4 · updates checked when the app opens.":"Offline · update check paused.");
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

function redraw(){ applyTheme(); applyAccent(); drawGauge(); drawList(); drawCaptureInbox(); drawQuickLogs(); drawRecent(); drawRecPrompt(); drawPlan(); drawDebt(); drawHist(); drawSetup(); updatePwaState(); setReorderMode(false); }
redraw(); go("spend"); handleCaptureURL(); handleURL();
})();
