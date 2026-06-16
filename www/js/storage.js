/* ============================================================
   storage.js — настройки, прогресс, активность, библиотеки,
   избранное, история тестов, своя библиотека, дневной лимит.
   ============================================================ */
const Store = (() => {
  const KEY='souda_progress_v3', SET='souda_settings_v3';
  const defState = { progress:{}, activity:{}, lastOpen:0, fav:{}, history:[],
    custom:{kanji:[],words:[],grammar:[]}, newDaily:{date:'',k:0,w:0,g:0} };
  const defSettings = { theme:'dark', sound:true, soundSet:'theme', volume:0.6,
    newKanji:10, newWords:10, newGrammar:5, lessMin:1, lessMax:23, yuruBg:'1', bgFit:'cover', studyFuri:false,
    libs:{g1:true,g2:true,useful:true,my:true}, libLess:{}, customBg:{}, grammarComment:null };

  let state = load(KEY, defState);
  let settings = load(SET, defSettings);
  if(!settings.libs) settings.libs={...defSettings.libs};
  if(!settings.libLess) settings.libLess={};
  if(!settings.customBg) settings.customBg={};
  if(!state.newDaily) state.newDaily={date:'',k:0,w:0,g:0};

  function load(k,d){ try{ const r=localStorage.getItem(k); return r?Object.assign(JSON.parse(JSON.stringify(d)),JSON.parse(r)):JSON.parse(JSON.stringify(d)); }catch(e){ return JSON.parse(JSON.stringify(d)); } }
  function save(){ try{ localStorage.setItem(KEY,JSON.stringify(state)); }catch(e){} }
  function saveS(){ try{ localStorage.setItem(SET,JSON.stringify(settings)); }catch(e){} }
  function today(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  const DKEY={kanji:'k',words:'w',grammar:'g'};
  function daily(){ const t=today(); if(state.newDaily.date!==t){ state.newDaily={date:t,k:0,w:0,g:0}; save(); } return state.newDaily; }

  return {
    get:id=>state.progress[id], set:(id,rec)=>{ if(rec&&rec.s==='known') rec.kt=rec.kt||Date.now(); state.progress[id]=rec; save(); },
    status:id=>{ const r=state.progress[id]; return r?r.s:'new'; },
    reset:()=>{ state.progress={}; state.activity={}; state.history=[]; state.fav={}; state.newDaily={date:'',k:0,w:0,g:0}; save(); },
    settings:()=>settings, setSetting:(k,v)=>{ settings[k]=v; saveS(); },
    libOn:lib=>settings.libs[lib]!==false, setLib:(lib,on)=>{ settings.libs[lib]=on; saveS(); },
    libLess:lib=>settings.libLess[lib]||null, setLibLess:(lib,obj)=>{ settings.libLess[lib]=obj; saveS(); },
    logActivity:(n=1)=>{ const t=today(); state.activity[t]=(state.activity[t]||0)+n; save(); },
    activity:()=>state.activity,
    newDailyCount:deck=>daily()[DKEY[deck]]||0,
    newDailyInc:deck=>{ const d=daily(); d[DKEY[deck]]=(d[DKEY[deck]]||0)+1; save(); },
    favHas:uid=>!!state.fav[uid], favToggle:uid=>{ if(state.fav[uid]) delete state.fav[uid]; else state.fav[uid]=1; save(); return !!state.fav[uid]; },
    addHistory:rec=>{ state.history.unshift(rec); state.history=state.history.slice(0,80); save(); },
    history:()=>state.history,
    custom:()=>state.custom, addCustom:(type,obj)=>{ state.custom[type].push(obj); save(); },
    bg:theme=>settings.customBg[theme]||null, setBg:(theme,data)=>{ if(data) settings.customBg[theme]=data; else delete settings.customBg[theme]; saveS(); },
    exportAll:()=>JSON.stringify({progress:state.progress,activity:state.activity,fav:state.fav,history:state.history,custom:state.custom,settings}),
    importAll:json=>{ try{ const o=JSON.parse(json); if(o.progress)state.progress=o.progress; if(o.activity)state.activity=o.activity; if(o.fav)state.fav=o.fav; if(o.history)state.history=o.history; if(o.custom)state.custom=o.custom; if(o.settings) settings=Object.assign(settings,o.settings); save(); saveS(); return true; }catch(e){ return false; } },
    touchOpen:()=>{ state.lastOpen=Date.now(); save(); }, lastOpen:()=>state.lastOpen, today,
  };
})();
