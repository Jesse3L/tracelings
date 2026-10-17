import { placeChild, weekTitle, applyCheckIn } from '../../src/lib/program/engine';
const mk=(extra:any={})=>({id:'c_probe1',ageYears:5,skills:{},interests:['dinosaurs','space'],daysPerWeek:5,minutesPerDay:15,faith:false,createdAt:'2026-10-16T00:00:00Z',...extra}) as any;
let p=placeChild(mk({ageYears:4}));
const orig=p.weeks.map(w=>weekTitle(w));
for (let i=0;i<8;i++){ const wk=p.weeks[p.current-1]; p=applyCheckIn(p,{childId:p.childId,weekIndex:wk.index,results:{'letter-names':'still-working'},at:''} as any); }
const now=p.weeks.map(w=>weekTitle(w));
console.log('len',p.weeks.length,'current',p.current);
console.log('first 12:',now.slice(0,12).join(' | '));
console.log('original weeks no longer in plan:', orig.filter(t=>!now.includes(t)));
// same week twice: checkin replaced (server) -> engine applied twice?
let q=placeChild(mk({ageYears:4}));
const w1=q.weeks[0];
q=applyCheckIn(q,{childId:q.childId,weekIndex:1,results:{'name-writing':'still-working'},at:''} as any);
q=applyCheckIn(q,{childId:q.childId,weekIndex:1,results:{'name-writing':'got-it'},at:''} as any);
console.log('checkin wk1 still then got-it (resubmit/change):', q.weeks.slice(0,4).map(w=>weekTitle(w)+(w.extraReview?'*':'')).join(' | '),'len',q.weeks.length,'current',q.current);
let r=placeChild(mk({ageYears:4}));
r=applyCheckIn(r,{childId:r.childId,weekIndex:1,results:{'name-writing':'got-it'},at:''} as any);
r=applyCheckIn(r,{childId:r.childId,weekIndex:1,results:{'name-writing':'still-working'},at:''} as any);
console.log('checkin got-it then still:', r.weeks.slice(0,4).map(w=>weekTitle(w)+(w.extraReview?'*':'')).join(' | '),'current',r.current);
// math still working on count weeks
let m=placeChild(mk({ageYears:4}));
const before=m.weeks.slice(0,6).map(w=>JSON.stringify(w.math));
m=applyCheckIn(m,{childId:m.childId,weekIndex:1,results:{'count-10':'still-working'},at:''} as any);
console.log('math still: before',before.join(' '),'after',m.weeks.slice(0,6).map(w=>JSON.stringify(w.math)).join(' '), 'len', m.weeks.length);
