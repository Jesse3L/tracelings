// Checks how names are cleaned for the tracing letters: accents, apostrophes, hyphens, inner capitals, non-Latin names.
// Run: npx tsx scripts/qa/test-names.mts
import { styleName, cleanName, nameNote } from '../../src/lib/sheet.ts';
import { cleanCursiveText } from '../../src/lib/cursive.ts';
import { cleanTraceText } from '../../src/lib/rowSheet.ts';

const cases: [string, 'capital' | 'caps' | 'lower', string][] = [
  ['José', 'capital', 'Jose'],
  ["D'Andre", 'capital', "D'Andre"],
  ['d’andre', 'capital', "D'andre"],
  ['Mary-Kate', 'capital', 'Mary-Kate'],
  ['mary-kate', 'capital', 'Mary-Kate'],
  ['Núñez', 'capital', 'Nunez'],
  ['McKenzie', 'capital', 'McKenzie'],
  ['mckenzie', 'capital', 'Mckenzie'],
  ['MIA', 'capital', 'Mia'],
  ['DeShawn', 'capital', 'DeShawn'],
  ['Søren Æbelø', 'capital', 'Soren AEbelo'],
  ['Strauß', 'caps', 'STRAUSS'],
  ['Łucja', 'lower', 'lucja'],
  ['Zoë', 'capital', 'Zoe'],
  ['François', 'capital', 'Francois'],
  ['Nguyễn', 'capital', 'Nguyen'],
  ['小明', 'capital', ''],
  ['😀Mia', 'capital', 'Mia'],
  ["'Mia-", 'capital', 'Mia'],
  ['Anne - Marie', 'capital', 'Anne-Marie'],
  ['Maximiliana Christabel', 'capital', 'Maximiliana Christabel'],
];
let bad = 0;
for (const [raw, st, want] of cases) {
  const got = styleName(raw, st);
  if (got !== want) { bad++; console.log('FAIL', JSON.stringify(raw), st, '->', JSON.stringify(got), 'want', JSON.stringify(want)); }
}
const notes: [string, boolean][] = [['小明', true], ['José', false], ["D'Andre", false], ['😀Mia', true], ['Mia', false], ['', false]];
for (const [raw, want] of notes) if (!!nameNote(raw) !== want) { bad++; console.log('FAIL note', raw, nameNote(raw)); }
if (cleanCursiveText('José Núñez') !== 'Jose Nunez') { bad++; console.log('FAIL cursive', cleanCursiveText('José Núñez')); }
if (cleanTraceText('José’s café') !== "Jose's cafe") { bad++; console.log('FAIL trace', cleanTraceText('José’s café')); }
if (cleanName('小明') !== '') { bad++; console.log('FAIL clean'); }
console.log(bad ? `${bad} failures` : `all ${cases.length + notes.length + 3} name checks pass`);
process.exit(bad ? 1 : 0);
