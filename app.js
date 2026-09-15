(function(){
"use strict";
var KEY="margin.v2", PREV_KEY="margin.v2.prev", APP_VERSION="1.6", ARC=386.4, FULL=515.2;
var HUES=["--jade","--cyan","--amber","--violet","--pink","--lime","--blue","--coral"];

function blank(){
  return {
    v:2, rate:3.35, startDay:25, mode:"period", accent:"jade", lastExport:null, nextId:100,
    cats:[
      {id:"c1",name:"Food",       cap:0,quick:[500,1000,2000,5000]},
      {id:"c2",name:"Groceries",  cap:0,quick:[1000,2000,3000,5000]},
      {id:"c3",name:"Dining out", cap:0,quick:[1500,3000,5000,8000]},
      {id:"c4",name:"Transport",  cap:0,quick:[300,500,1000,2000]},
      {id:"c5",name:"Shopping",   cap:0,quick:[2000,5000,10000,20000]},
      {id:"c6",name:"Fun",        cap:0,quick:[1000,2500,5000,10000]},
      {id:"c7",name:"Other",      cap:0,quick:[500,1000,2000,5000]}
    ],
    debts:[],
    txns:[], pays:[], recs:[]
  };
}
var S=load();
function load(){
  try{
    var r=localStorage.getItem(KEY); if(!r) return blank();
    var p=JSON.parse(r); if(!p||!Array.isArray(p.cats)||!Array.isArray(p.txns)) return blank();
    var d=blank(); for(var k in d) if(!(k in p)) p[k]=d[k];
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
function hueOf(id){ for(var i=0;i<S.cats.length;i++) if(S.cats[i].id===id) return "var("+HUES[i%HUES.length]+")"; return "var(--dim)"; }
function spent(a,b,cid){ var s=0;
  for(var i=0;i<S.txns.length;i++){ var t=S.txns[i]; if(inR(t,a,b)&&(!cid||t.cat===cid)) s+=t.sgd; } return s; }
function capAll(){ var s=0; S.cats.forEach(function(c){ s+=c.cap||0; }); return s; }
function tone(f){ return f>=1?"var(--coral)":f>=0.8?"var(--amber)":"var(--jade)"; }

var ACCENTS={jade:"var(--jade)",cyan:"var(--cyan)",violet:"var(--violet)",amber:"var(--amber)",pink:"var(--pink)"};
function applyAccent(){
  if(!ACCENTS[S.accent]) S.accent="jade";
  document.documentElement.style.setProperty("--accent",ACCENTS[S.accent]);
  Array.prototype.forEach.call(document.querySelectorAll(".accent-dot"),function(b){
    b.setAttribute("aria-checked",b.dataset.accent===S.accent?"true":"false");
  });
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
    if(actual)actual.style.width="0%"; if(marker)marker.style.left="0%"; if(status)status.textContent="Set your envelope caps to start."; if(pct)pct.textContent="";
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
  document.getElementById("gPace").textContent = left<0
    ? "Resets in "+dl+" "+(dl===1?"day":"days")
    : money(left/dl,false)+" a day for "+dl+" more "+(dl===1?"day":"days");
  if(safe)safe.textContent=left>0?money(left/dl,false):"S$0";
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
    var nm=el("span","nm"), gh=grip(), dot=el("span","dot");
    dot.style.background=hueOf(c.id); dot.style.color=hueOf(c.id);
    nm.appendChild(gh); nm.appendChild(dot); nm.appendChild(el("span",null,c.name));
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
    btn.addEventListener("click",function(){ if(Date.now()<suppressEnvelopeClick) return; openSpend(c.id); });
    wrap.appendChild(btn); box.appendChild(wrap); setupEnvelopeDrag(wrap,gh);
  });
}
var suppressEnvelopeClick=0;
function setupEnvelopeDrag(wrap,handle){
  var timer=null, dragging=false, pid=null, lastY=0;
  function start(e){
    if(e.button!=null&&e.button!==0) return;
    pid=e.pointerId; lastY=e.clientY;
    timer=setTimeout(function(){
      dragging=true; suppressEnvelopeClick=Date.now()+800; haptic(12);
      wrap.classList.add("dragging");
      try{ handle.setPointerCapture(pid); }catch(x){}
    },180);
  }
  function move(e){
    if(e.pointerId!==pid) return;
    lastY=e.clientY;
    if(!dragging){ if(Math.abs(e.movementY||0)>7){ clearTimeout(timer); timer=null; } return; }
    e.preventDefault();
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
    clearTimeout(timer); timer=null;
    if(dragging){
      dragging=false; suppressEnvelopeClick=Date.now()+500;
      wrap.classList.remove("dragging");
      Array.prototype.forEach.call(document.querySelectorAll(".envelope-wrap.drag-target"),function(x){x.classList.remove("drag-target");});
      var ids=Array.prototype.map.call(document.querySelectorAll("#list .envelope-wrap"),function(x){return x.dataset.cid;});
      S.cats.sort(function(a,b){return ids.indexOf(a.id)-ids.indexOf(b.id);});
      save(); haptic(7); toast("Envelope order saved");
    }
    try{ if(pid!=null) handle.releasePointerCapture(pid); }catch(x){}
    pid=null;
  }
  handle.addEventListener("pointerdown",start);
  handle.addEventListener("pointermove",move,{passive:false});
  handle.addEventListener("pointerup",end); handle.addEventListener("pointercancel",end);
  handle.addEventListener("click",function(e){e.preventDefault();e.stopPropagation();});
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
function logSpend(cid,amtCents,cur,note){
  var s = cur==="MYR"?Math.round(amtCents/S.rate):amtCents;
  var id=uid();
  S.txns.push({id:id,date:iso(today()),sgd:s,cur:cur,orig:amtCents,cat:cid,note:(note||"").trim()});
  lastId=id; save(); redraw();
  var ps=pStart(today()), left=(catOf(cid).cap||0)-spent(ps,pShift(ps,1),cid);
  toast((cur==="SGD"?money(s):rmf(amtCents))+" · "+(left<0?money(-left,false)+" over":money(left,false)+" left"),true);
}
function commit(raw){
  if(!(raw>0)||!active) return;
  var n=document.getElementById("note"), v=n?n.value:"";
  shut(); logSpend(active,raw,mode,v);
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
    var row=el("button","recent-item"), left=el("span","recent-left"), dot=el("span","dot"), copy=el("span","recent-copy");
    dot.style.background=hueOf(t.cat); dot.style.color=hueOf(t.cat);
    copy.appendChild(el("b",null,catName(t.cat)));
    copy.appendChild(el("span",null,(t.note?t.note+" · ":"")+dayLab(t.date)));
    left.appendChild(dot); left.appendChild(copy); row.appendChild(left); row.appendChild(el("span","recent-amt tab",money(t.sgd)));
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
function drawHist(){
  document.getElementById("hLabel").textContent=pLabel(hStart);
  var body=document.getElementById("hBody"); body.innerHTML="";
  var a=hStart,b=pShift(hStart,1);
  var q=(document.getElementById("hSearch").value||"").trim().toLowerCase();
  var cf=document.getElementById("hCatFilter").value||"";
  var list=S.txns.filter(function(t){
    if(!inR(t,a,b)) return false;
    if(cf&&t.cat!==cf) return false;
    if(q){ var hay=(catName(t.cat)+" "+(t.note||"")+" "+t.date).toLowerCase(); if(hay.indexOf(q)<0) return false; }
    return true;
  });
  var sumAll=list.reduce(function(x,t){return x+t.sgd;},0), hs=document.getElementById("hSummary");
  if(hs) hs.innerHTML='<span>'+list.length+(list.length===1?' entry':' entries')+'</span><b class="tab">'+money(sumAll,false)+'</b>';
  if(!list.length){ body.appendChild(el("div","empty",q||cf?"No entries match this filter.":"Nothing spent in this period.")); return; }
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
      var n=el("div","nm"), dot=el("span","dot");
      dot.style.background=hueOf(t.cat); dot.style.color=hueOf(t.cat);
      n.appendChild(dot); n.appendChild(el("span",null,catName(t.cat))); L.appendChild(n);
      var sub=[]; if(t.note) sub.push(t.note); if(t.cur==="MYR") sub.push(rmf(t.orig));
      if(sub.length){ var s2=el("div","tiny dim",sub.join("  ·  ")); s2.style.marginTop="2px"; L.appendChild(s2); }
      btn.appendChild(L); btn.appendChild(el("span","tab",money(t.sgd))); btn.style.fontWeight="500";
      shell.appendChild(btn); body.appendChild(shell); setupTxnSwipe(shell,btn,t);
      rep.addEventListener("click",function(e){ e.stopPropagation(); shell.classList.remove("open"); haptic(7); logSpend(t.cat,t.cur==="MYR"?t.orig:t.sgd,t.cur,t.note||""); });
      del.addEventListener("click",function(e){ e.stopPropagation(); deleteTxn(t.id); });
    });
  });
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
    '<div class="field"><label for="eD">Date</label><input id="eD" type="date" value="'+t.date+'"></div>'+
    '<div class="field"><label for="eN">Notes</label>'+
    '<textarea id="eN" rows="3" placeholder="What was it for, who was there, why">'+esc(t.note||"")+'</textarea></div>'+
    '<button class="go" id="eS">Save changes</button>'+
    '<div class="flex" style="gap:8px;margin-top:10px">'+
    '<button class="flat" id="eX" style="flex:1">Cancel</button>'+
    '<button class="flat danger" id="eK" style="flex:1">Delete</button></div>');
  document.getElementById("eX").onclick=shut;
  document.getElementById("eS").onclick=function(){
    var a=toCents(document.getElementById("eA").value);
    if(a<=0){ toast("Enter an amount above zero"); return; }
    t.sgd=a; t.cur="SGD"; t.orig=a; t.cat=document.getElementById("eC").value;
    t.date=document.getElementById("eD").value||t.date;
    t.note=document.getElementById("eN").value.trim();
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
  applyAccent(); updateRecoveryState();
  var ed=document.getElementById("editor"); ed.innerHTML="";
  S.cats.forEach(function(c){
    var box=el("div","block"), r=el("div","flex");
    var nm=el("input"); nm.value=c.name; nm.style.flex="2";
    nm.addEventListener("change",function(){ c.name=nm.value.trim()||c.name; save(); redraw(); });
    var cp=el("input"); cp.type="text"; cp.inputMode="decimal"; cp.value=(c.cap/100).toFixed(0);
    cp.style.maxWidth="84px"; cp.style.textAlign="right";
    cp.addEventListener("change",function(){ c.cap=toCents(cp.value); save(); redraw(); });
    r.appendChild(nm); r.appendChild(cp); box.appendChild(r);
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
  var tabs=["spend","debt","history","setup"];
  tabs.forEach(function(x){ document.getElementById("v-"+x).classList.toggle("on",x===v); });
  Array.prototype.forEach.call(document.querySelectorAll(".nav button"),function(b){ b.setAttribute("aria-current",b.dataset.go===v); });
  var ni=document.getElementById("navIndicator"), ix=tabs.indexOf(v); if(ni&&ix>=0) ni.style.transform="translateX("+(ix*100)+"%)";
  window.scrollTo(0,0);
  if(v==="history"){ hStart=pStart(today()); drawHist(); }
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
  S.cats.push({id:"c"+Date.now(),name:v,cap:0,quick:[500,1000,2000,5000]}); i.value=""; save(); redraw(); });
document.getElementById("addDebt").addEventListener("click",function(){
  var i=document.getElementById("newDebt"), v=i.value.trim(); if(!v) return;
  S.debts.push({id:"d"+Date.now(),name:v,start:0,bal:0,rate:0}); i.value=""; save(); redraw();
  toast("Tap it to set the balance"); });
document.getElementById("recNow").addEventListener("click",function(){ openRec(lastClosedPeriod()); });
document.getElementById("expJson").addEventListener("click",function(){
  download("margin-backup-"+iso(today())+".json",JSON.stringify(S),"application/json"); toast("Backup exported"); });
document.getElementById("expCsv").addEventListener("click",function(){
  var l=["date,sgd,currency,original,envelope,notes"];
  S.txns.forEach(function(t){ l.push([t.date,(t.sgd/100).toFixed(2),t.cur,(t.orig/100).toFixed(2),
    '"'+catName(t.cat).replace(/"/g,'""')+'"','"'+String(t.note||"").replace(/"/g,'""')+'"'].join(",")); });
  download("margin-"+iso(today())+".csv",l.join("\n"),"text/csv"); toast("CSV exported"); });
document.getElementById("impBtn").addEventListener("click",function(){ document.getElementById("impFile").click(); });
document.getElementById("impFile").addEventListener("change",function(){
  var f=this.files[0]; if(!f) return; var r=new FileReader();
  r.onload=function(){
    try{
      var p=JSON.parse(r.result);
      if(!p||!Array.isArray(p.txns)||!Array.isArray(p.cats)) throw 0;
      if(!confirm("Replace everything on this phone with the backup, which holds "+p.txns.length+" entries?")) return;
      S=p; if(!S.accent)S.accent="jade"; save(); hStart=pStart(today()); redraw(); toast("Backup restored");
    }catch(e){ toast("That file is not a Margin backup"); }
  };
  r.readAsText(f); this.value=""; });
document.getElementById("wipe").addEventListener("click",function(){
  if(!confirm("Erase every entry and setting on this phone?")) return;
  if(!confirm("This cannot be undone. Export a backup first if you are unsure.")) return;
  S=blank(); save(); hStart=pStart(today()); redraw(); go("spend"); toast("Erased"); });

document.getElementById("seeHistory").addEventListener("click",function(){ go("history"); });
document.getElementById("hSearch").addEventListener("input",drawHist);
document.getElementById("hCatFilter").addEventListener("change",drawHist);
Array.prototype.forEach.call(document.querySelectorAll(".accent-dot"),function(b){
  b.addEventListener("click",function(){ S.accent=b.dataset.accent; save(); applyAccent(); haptic(5); });
});
document.getElementById("recoverPrev").addEventListener("click",function(){
  var raw=null; try{raw=localStorage.getItem(PREV_KEY);}catch(e){}
  if(!raw){toast("No previous local state is available");return;}
  if(!confirm("Replace the current state with the previous locally saved state?"))return;
  try{ var p=JSON.parse(raw); if(!p||!Array.isArray(p.txns)||!Array.isArray(p.cats))throw 0; S=p; if(!S.accent)S.accent="jade"; localStorage.setItem(KEY,JSON.stringify(S)); redraw(); toast("Previous state recovered"); }
  catch(e){toast("The previous local state could not be recovered");}
});
document.getElementById("checkUpdate").addEventListener("click",function(){
  if(updateReady&&swReg&&swReg.waiting){ swReg.waiting.postMessage({type:"SKIP_WAITING"}); return; }
  if(swReg){ document.getElementById("updateText").textContent="Checking…"; swReg.update().then(function(){ setTimeout(function(){ if(!updateReady){document.getElementById("updateText").textContent="You already have the latest Margin 1.6 files.";} },500); }).catch(function(){toast("Could not check for updates");}); }
  else toast("Update checks work after Margin is served over HTTPS");
});

/* one-tap logging from a home screen shortcut */
function handleURL(){
  var q=location.search; if(!q) return;
  var p={}; q.replace(/^\?/,"").split("&").forEach(function(kv){
    var a=kv.split("="); if(a[0]) p[decodeURIComponent(a[0])]=decodeURIComponent(a[1]||""); });
  if(!p.log||!p.amt) return;
  var c=catOf(p.log), amt=parseInt(p.amt,10);
  if(c&&amt>0) logSpend(c.id,amt,p.cur==="MYR"?"MYR":"SGD");
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
  document.getElementById("pwaText").textContent=!secure?"Publish through HTTPS (GitHub Pages works) to unlock offline app caching.":standalone?(online?"Installed and ready. Your data remains local on this device.":"Offline — Margin is running from its cached app shell."):"Add this page to your Home Screen for a standalone app experience.";
  var u=document.getElementById("updateText"), b=document.getElementById("checkUpdate");
  if(u)u.textContent=updateReady?"Margin 1.6 update ready — apply it now.":(online?"Margin 1.6 · updates checked when the app opens.":"Offline · update check paused.");
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

function redraw(){ applyAccent(); drawGauge(); drawList(); drawRecent(); drawRecPrompt(); drawDebt(); drawHist(); drawSetup(); updatePwaState(); }
redraw(); go("spend"); handleURL();
})();
