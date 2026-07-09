/* ============================================================
   storage.js — настройки, прогресс, активность, библиотеки,
   избранное, история тестов, зазубрить, архив, свои библиотеки.
   ============================================================ */
const Store = (() => {
  const KEY='souda_progress_v3', SET='souda_settings_v3';
  const defState = { progress:{}, activity:{}, lastOpen:0, fav:{}, history:[],
    cram:{}, cramHits:{}, cramCool:{}, archive:{}, customLibs:[], newDaily:{date:'',k:0,w:0,g:0},
    deckDaily:{date:'',kanji:10,words:10,grammar:5}, onboarded:false, hints:{} };
  const defSettings = { theme:'dark', sound:true, soundSet:'theme', volume:0.6,
    newKanji:10, newWords:10, newGrammar:5, lessMin:1, lessMax:23, yuruBg:'1', bgFit:'cover', studyFuri:false, studyAudioButton:true, pitchAccent:true, cramMode:true, cramCooldown:10, cramNeed:3,
    libs:{g1:true,g2:true,useful:true}, libLess:{}, libThemes:{}, customBg:{}, grammarComment:null,
    srcLibs:{}, deckLibs:null };

  let state = load(KEY, defState);
  let settings = load(SET, defSettings);
  if(!settings.libs) settings.libs={g1:true,g2:true,useful:true};
  if(!settings.libLess) settings.libLess={};
  if(!settings.libThemes) settings.libThemes={};
  if(!settings.customBg) settings.customBg={};
  if(!settings.srcLibs) settings.srcLibs={};
  if(!state.newDaily) state.newDaily={date:'',k:0,w:0,g:0};
  if(!state.deckDaily) state.deckDaily={date:'',kanji:settings.newKanji||10,words:settings.newWords||10,grammar:settings.newGrammar||5};
  if(!state.cram) state.cram={}; if(!state.cramHits) state.cramHits={}; if(!state.cramCool) state.cramCool={}; if(!state.archive) state.archive={}; if(!state.customLibs) state.customLibs=[]; if(!state.hints) state.hints={};

  let rev=0; // версия данных — для пропуска лишних ререндеров списков
  function load(k,d){ try{ const r=localStorage.getItem(k); return r?Object.assign(JSON.parse(JSON.stringify(d)),JSON.parse(r)):JSON.parse(JSON.stringify(d)); }catch(e){ return JSON.parse(JSON.stringify(d)); } }
  function save(){ rev++; try{ localStorage.setItem(KEY,JSON.stringify(state)); }catch(e){} }
  function saveS(){ rev++; try{ localStorage.setItem(SET,JSON.stringify(settings)); }catch(e){} }
  function today(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  const DKEY={kanji:'k',words:'w',grammar:'g'};
  const SKEY={newKanji:'kanji',newWords:'words',newGrammar:'grammar'};
  const LIMIT={kanji:'newKanji',words:'newWords',grammar:'newGrammar'};
  function daily(){ const t=today(); if(state.newDaily.date!==t){ state.newDaily={date:t,k:0,w:0,g:0}; save(); } return state.newDaily; }
  function deckDaily(){
    const t=today();
    if(state.deckDaily.date!==t){
      state.deckDaily={date:t,kanji:settings.newKanji||0,words:settings.newWords||0,grammar:settings.newGrammar||0};
      save();
    }
    for(const k of ['kanji','words','grammar']) if(state.deckDaily[k]==null) state.deckDaily[k]=settings[LIMIT[k]]||0;
    return state.deckDaily;
  }

  return {
    get:id=>state.progress[id], set:(id,rec)=>{ if(rec&&rec.s==='known') rec.kt=rec.kt||Date.now(); state.progress[id]=rec; save(); },
    status:id=>{ const r=state.progress[id]; return r?r.s:'new'; },
    reset:()=>{ state.progress={}; state.activity={}; state.history=[]; state.fav={}; state.cram={}; state.archive={}; state.newDaily={date:'',k:0,w:0,g:0}; state.deckDaily={date:'',kanji:settings.newKanji||0,words:settings.newWords||0,grammar:settings.newGrammar||0}; save(); },
    settings:()=>settings, setSetting:(k,v)=>{ const dk=SKEY[k]; const old=settings[k]; settings[k]=v; if(dk){ const d=deckDaily(); const used=Math.max(0,(old||0)-(d[dk]||0)); d[dk]=Math.max(0,(v||0)-used); save(); } saveS(); },
    libOn:lib=>settings.libs[lib]!==false, setLib:(lib,on)=>{ settings.libs[lib]=on; saveS(); },
    // Источники по разделам: 'deck' использует общий libs; 'dict'/'kanji'/'grammar' — свои наборы.
    srcOn:(sec,lib)=>{ if(sec==='deck') return settings.libs[lib]!==false; const m=settings.srcLibs[sec]; return m?m[lib]!==false:true; },
    setSrc:(sec,lib,on)=>{ if(sec==='deck'){ settings.libs[lib]=on; } else { if(!settings.srcLibs[sec]) settings.srcLibs[sec]={}; settings.srcLibs[sec][lib]=on; } saveS(); },
    libLess:lib=>settings.libLess[lib]||null, setLibLess:(lib,obj)=>{ settings.libLess[lib]=obj; saveS(); },
    libThemes:lib=>settings.libThemes[lib]||null, setLibThemes:(lib,arr)=>{ settings.libThemes[lib]=arr; saveS(); },
    logActivity:(n=1)=>{ const t=today(); state.activity[t]=(state.activity[t]||0)+n; save(); },
    activity:()=>state.activity,
    newDailyCount:deck=>daily()[DKEY[deck]]||0,
    newDailyInc:deck=>{ const d=daily(); if(DKEY[deck]) d[DKEY[deck]]=(d[DKEY[deck]]||0)+1; save(); },
    deckRemaining:deck=>Math.max(0,deckDaily()[deck]||0),
    deckDailyDec:deck=>{ const d=deckDaily(); if(d[deck]>0){ d[deck]-=1; save(); } return Math.max(0,d[deck]||0); },
    favHas:uid=>!!state.fav[uid], favToggle:uid=>{ if(state.fav[uid]) delete state.fav[uid]; else state.fav[uid]=1; save(); return !!state.fav[uid]; },
    isCram:uid=>!!state.cram[uid], setCram:(uid,on)=>{ if(on) state.cram[uid]=1; else delete state.cram[uid]; delete state.cramHits[uid]; save(); }, cramList:()=>Object.keys(state.cram),
    cramNeed:()=>settings.cramNeed!=null?settings.cramNeed:3, cramHits:uid=>state.cramHits[uid]||0,
    // «Знаю» в «Зазубрить». Нужно N раз ПОДРЯД. Возвращает остаток (0 = слово вышло из категории).
    cramHit:uid=>{ if(!state.cram[uid]) return 0; const need=settings.cramNeed!=null?settings.cramNeed:3; const n=(state.cramHits[uid]||0)+1; if(n>=need){ delete state.cram[uid]; delete state.cramHits[uid]; delete state.cramCool[uid]; save(); return 0; } state.cramHits[uid]=n; save(); return need-n; },
    // «Не знаю» — сбрасывает серию (счётчик подряд) на ноль.
    cramReset:uid=>{ if(state.cramHits[uid]){ delete state.cramHits[uid]; save(); } },
    // Пауза: слово не показывается в «Зазубрить» до истечения.
    cramSnooze:(uid,min)=>{ if(min==null) min=settings.cramCooldown!=null?settings.cramCooldown:10; if(state.cram[uid]&&min>0){ state.cramCool[uid]=Date.now()+min*60000; save(); } },
    cramReady:uid=>!state.cramCool[uid]||state.cramCool[uid]<=Date.now(),
    // Минимум миллисекунд до возвращения ближайшего слова «Зазубрить» (для сообщения).
    cramNextMs:()=>{ let best=Infinity; for(const u of Object.keys(state.cram)){ const t=state.cramCool[u]; if(t&&t>Date.now()) best=Math.min(best,t-Date.now()); } return best===Infinity?0:best; },
    isArchived:uid=>!!state.archive[uid], setArchive:(uid,on)=>{ if(on) state.archive[uid]=1; else delete state.archive[uid]; save(); },
    archiveCount:()=>Object.keys(state.archive).length, clearArchive:()=>{ state.archive={}; save(); },
    addHistory:rec=>{ state.history.unshift(rec); state.history=state.history.slice(0,80); save(); },
    history:()=>state.history,
    customLibs:()=>state.customLibs,
    addCustomLib:(name,kind)=>{ const id='c'+Date.now().toString(36); state.customLibs.push({id,name:name||'Моя библиотека',kind:kind||'lessons',groups:{},items:{kanji:[],words:[],grammar:[]}}); save(); return id; },
    getCustomLib:id=>state.customLibs.find(l=>l.id===id),
    removeCustomLib:id=>{ state.customLibs=state.customLibs.filter(l=>l.id!==id); save(); },
    updateCustomItem:(libId,type,ci,obj)=>{ const lib=state.customLibs.find(l=>l.id===libId); if(!lib||!lib.items[type]||!lib.items[type][ci]) return false; Object.assign(lib.items[type][ci],obj); save(); return true; },
    removeCustomItem:(libId,type,ci)=>{ const lib=state.customLibs.find(l=>l.id===libId); if(!lib||!lib.items[type]) return false; lib.items[type].splice(ci,1); save(); return true; },
    addCustomItem:(libId,type,obj,group,groupName)=>{ const lib=state.customLibs.find(l=>l.id===libId); if(!lib) return false; obj.l=group||1; if(groupName) lib.groups[obj.l]=groupName; lib.items[type].push(obj); save(); return true; },
    bg:theme=>settings.customBg[theme]||null, setBg:(theme,data)=>{ if(data) settings.customBg[theme]=data; else delete settings.customBg[theme]; saveS(); },
    exportAll:()=>JSON.stringify({progress:state.progress,activity:state.activity,fav:state.fav,history:state.history,cram:state.cram,cramHits:state.cramHits,cramCool:state.cramCool,archive:state.archive,customLibs:state.customLibs,settings}),
    importAll:json=>{ try{ const o=JSON.parse(json); for(const k of ['progress','activity','fav','history','cram','cramHits','cramCool','archive','customLibs']) if(o[k]) state[k]=o[k]; if(o.settings) settings=Object.assign(settings,o.settings); save(); saveS(); return true; }catch(e){ return false; } },
    onboarded:()=>state.onboarded, setOnboarded:()=>{ state.onboarded=true; save(); },
    hintSeen:id=>!!state.hints[id], markHint:id=>{ state.hints[id]=1; save(); },
    seenVersion:()=>state.seenVersion||null, setSeenVersion:v=>{ state.seenVersion=v; save(); },
    touchOpen:()=>{ state.lastOpen=Date.now(); save(); }, lastOpen:()=>state.lastOpen, today, rev:()=>rev,
  };
})();
