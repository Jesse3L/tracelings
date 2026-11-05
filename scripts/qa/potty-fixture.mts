// Writes a mock family (one Pre-K child on week 1) and week 1 content for browser checks of the members' potty chart.
// Run: npx tsx scripts/qa/potty-fixture.mts <outDir>
import { writeFile } from 'node:fs/promises';
import { placeChild } from '../../src/lib/program/engine';
import { templateContentFor } from '../../src/lib/program/templates';
const out = process.argv[2] ?? '.';
const kid = { id: 'c_potty001', ageYears: 3, skills: {}, interests: ['dinosaurs', 'space'], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '2026-11-05T00:00:00.000Z' } as any;
const plan = placeChild(kid);
await writeFile(`${out}/family.json`, JSON.stringify({ children: [kid], plans: { [kid.id]: plan }, checkIns: [], cached: [], redos: {}, limits: { maxChildren: 4, redosPerWeek: 2 } }));
await writeFile(`${out}/week.json`, JSON.stringify({ content: templateContentFor(kid, plan.weeks[0]), cached: true, redosLeft: 2 }));
console.log(plan.level, plan.weeks.length);
