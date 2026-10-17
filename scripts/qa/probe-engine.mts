import { placeChild, weekTitle, applyCheckIn } from '../../src/lib/program/engine';
import { templateContentFor } from '../../src/lib/program/templates';
const S=['name-writing','letter-names','letter-sounds','blending','word-families','sight-words','count-10','count-20','numerals','compare','add-5','add-10'] as const;
const mk=(age:number, st:string, extra:any={})=>({id:'c_probe1',ageYears:age,skills:Object.fromEntries(S.map(s=>[s,st])),interests:['dinosaurs','space','trains'],daysPerWeek:5,minutesPerDay:15,faith:false,createdAt:'2026-10-16T00:00:00Z',...extra}) as any;
for (const age of [3,4,5,6,7]) for (const st of ['not-yet','learning','got-it']) {
  const p=placeChild(mk(age,st)); const rev=p.weeks.filter(w=>w.extraReview).length;
  const titles=p.weeks.map(w=>weekTitle(w));
  let consecutiveDup=0; for(let i=1;i<titles.length;i++) if(titles[i]===titles[i-1]) consecutiveDup++;
  console.log(`age ${age} ${st.padEnd(8)} level=${p.level} weeks=${p.weeks.length} extraReview=${rev} consecDupTitles=${consecutiveDup} first=${titles.slice(0,4).join(' | ')} math1=${JSON.stringify(p.weeks[0].math)} last=${titles.at(-1)}`);
}
// themes rotation with 1/2/3 interests
for (const ints of [['bugs'],['bugs','pets'],['bugs','pets','farm']]) { const p=placeChild(mk(5,'not-yet',{interests:ints})); console.log(ints.join(','), p.weeks.slice(0,6).map(w=>w.theme).join(' ')); }
// check-in all still-working on week 1 repeatedly
let p=placeChild(mk(5,'not-yet'));
for (let i=0;i<5;i++){ const wk=p.weeks[p.current-1]; p=applyCheckIn(p,{childId:p.childId,weekIndex:wk.index,results:Object.fromEntries(wk.focus.map(s=>[s,'still-working'])),at:''} as any); }
console.log('after 5 still-working: len',p.weeks.length,'cur',p.current, p.weeks.slice(0,8).map(w=>weekTitle(w)+(w.extraReview?'*':'')).join(' | '));
let q=placeChild(mk(5,'not-yet'));
for (let i=0;i<40 && q.current<q.weeks.length;i++){ const wk=q.weeks[q.current-1]; q=applyCheckIn(q,{childId:q.childId,weekIndex:wk.index,results:Object.fromEntries(wk.focus.map(s=>[s,'still-working'])),at:''} as any); }
console.log('still-working every week: len',q.weeks.length,'cur',q.current);
// check-in on the last week
let r=placeChild(mk(5,'not-yet')); const last=r.weeks.at(-1)!; r={...r,current:r.weeks.length}; const r2=applyCheckIn(r,{childId:r.childId,weekIndex:last.index,results:{'letter-names':'still-working'},at:''} as any); console.log('checkin last week: len',r2.weeks.length,'cur',r2.current);
const r3=applyCheckIn(r,{childId:r.childId,weekIndex:last.index,results:Object.fromEntries(last.focus.map(s=>[s,'got-it'])),at:''} as any); console.log('got-it last week: len',r3.weeks.length,'cur',r3.current,'(current stays on last week; no "plan complete" state)');
// faith
const pf=templateContentFor(mk(5,'not-yet',{faith:true}), placeChild(mk(5,'not-yet',{faith:true})).weeks[1]); console.log('faith content keys', Object.keys(pf));
