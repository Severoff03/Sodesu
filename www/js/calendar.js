/* ============================================================
   calendar.js — карта активности в стиле GitHub.
   ============================================================ */
const Cal = (() => {
  function render(el){
    const act = Store.activity();
    const WEEKS=15, days=WEEKS*7;
    const end=new Date(); end.setHours(0,0,0,0);
    // сдвиг к воскресенью в конце недели
    const cells=[];
    const start=new Date(end); start.setDate(start.getDate()-(days-1));
    // выравниваем старт на понедельник
    const offset=(start.getDay()+6)%7; start.setDate(start.getDate()-offset);
    let total=0, streak=0, run=0;
    for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)){
      const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      const v=act[key]||0; total+=v;
      cells.push({key,v});
    }
    // текущий стрик (с конца)
    for(let i=cells.length-1;i>=0;i--){ if(cells[i].v>0){run++;} else break; }
    streak=run;
    const lvl=v=> v===0?0 : v<5?1 : v<15?2 : v<30?3 : 4;
    // строим по столбцам-неделям
    let cols='';
    for(let w=0; w*7<cells.length; w++){
      let col='';
      for(let r=0;r<7;r++){
        const c=cells[w*7+r]; if(!c) continue;
        col+=`<i class="cal-d l${lvl(c.v)}" title="${c.key}: ${c.v}"></i>`;
      }
      cols+=`<div class="cal-col">${col}</div>`;
    }
    el.innerHTML=`<div class="cal-grid">${cols}</div>
      <div class="cal-legend"><span>стрик: <b>${streak}</b> дн · всего повторений: <b>${total}</b></span>
      <span class="cal-scale">меньше <i class="cal-d l0"></i><i class="cal-d l1"></i><i class="cal-d l2"></i><i class="cal-d l3"></i><i class="cal-d l4"></i> больше</span></div>`;
  }
  return { render };
})();
