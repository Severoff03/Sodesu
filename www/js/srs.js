/* ============================================================
   srs.js — интервальное повторение (SM-2). Учитывает активные
   библиотеки. items: каждый с полями uid, l, lib.
   ============================================================ */
const SRS = (() => {
  const DAY=86400000, now=()=>Date.now();
  const GRADE={AGAIN:0,HARD:1,GOOD:2,EASY:3};
  const fresh=()=>({s:'new',iv:0,ef:2.5,due:0,reps:0});
  function grade(rec,g){
    rec=rec?{...rec}:fresh();
    if(g===GRADE.AGAIN){ rec.s='learning'; rec.iv=0; rec.reps=0; rec.ef=Math.max(1.3,rec.ef-0.2); rec.due=now()+60000; return rec; }
    rec.reps+=1;
    if(rec.reps===1) rec.iv=(g===GRADE.EASY?7:1);
    else if(rec.reps===2) rec.iv=(g===GRADE.HARD?3:7);
    else { const m=g===GRADE.HARD?1.2:g===GRADE.EASY?rec.ef*1.3:rec.ef; rec.iv=Math.round(rec.iv*m); }
    rec.ef=Math.max(1.3,rec.ef+(g===GRADE.HARD?-0.15:g===GRADE.EASY?0.15:0));
    rec.s=rec.iv>=21?'review':'learning'; rec.due=now()+rec.iv*DAY; return rec;
  }
  const isDue=r=>r&&r.s!=='known'&&r.due<=now();
  const libOn=k=>Store.libOn(k.lib||'g1');
  function queue(items,store,opts){
    const s=store.settings(); const newLimit=(opts&&opts.newLimit!=null)?opts.newLimit:s.newKanji;
    const LL=s.libLess||{}; const inR=k=>{ const r=LL[k.lib]; return r?(k.l>=r.min&&k.l<=r.max):(k.l>=s.lessMin&&k.l<=s.lessMax); };
    const pool=items.filter(k=>libOn(k)&&inR(k)&&!Store.isArchived(k.uid)&&!Store.isCram(k.uid));
    const due=[], fr=[];
    for(const k of pool){ const rec=store.get(k.uid); const st=rec?rec.s:'new';
      if(st==='known') continue; if(st==='new') fr.push(k); else if(isDue(rec)) due.push(k); }
    due.sort((a,b)=>store.get(a.uid).due-store.get(b.uid).due);
    const newCards=fr.slice(0,newLimit);
    const queue=due.concat(newCards);
    const limit=(opts&&opts.limit!=null)?opts.limit:null;
    return { due, newCards, queue:limit==null?queue:queue.slice(0,limit) };
  }
  function counts(items,store){
    let due=0,learning=0,known=0,total=0;
    for(const k of items){ if(!libOn(k)||Store.isArchived(k.uid)||Store.isCram(k.uid)) continue; total++;
      const st=store.status(k.uid);
      if(st==='known') known++; else { if(st==='learning'||st==='review') learning++; if(isDue(store.get(k.uid))) due++; } }
    return { due, learning, known, total };
  }
  return { GRADE, grade, isDue, queue, counts, fresh };
})();
