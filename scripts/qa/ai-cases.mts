// QA fixture cases for the AI story checks (from the Oct 2026 QA, plus the new rules). Good stories must pass; each bad
// story must fail with the right reason. Two layers:
//   code  validateStory: arc, path, picture words, cast, names, the child's actions, crying, length, teaching words.
//   check readPictureCheck: the cheap model's per-page "is everything in the words in the picture?" answer. Here a
//         scripted judge stands in for the model (it answers "no" exactly where the case says the words and picture
//         disagree), so the wiring and the failure reason are tested without a key. LIVE=1 with ANTHROPIC_API_KEY
//         asks the real PROGRAM_AI_MODEL instead.
// Run: npx tsx scripts/qa/ai-cases.mts   (exit code 1 on any unexpected result)
import { readFile } from 'node:fs/promises';
import { setSceneArt } from '../../src/lib/program/story';
import { validateStory, validateContent, storyFacts, weekFacts, ContentInvalid, readPictureCheck, requestBody, _checkPrompts, parseResponse } from '../../src/lib/server/ai';
import type { ChildProfile, ProgramWeek, ThemeId } from '../../src/lib/program/types';

setSceneArt(JSON.parse(await readFile('src/lib/program/sceneArt.json', 'utf8')));
const prof = (theme: ThemeId, age: 4 | 5): ChildProfile => ({ id: 'c_x', ageYears: age, skills: {}, interests: [theme], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '2026-10-16' });
const facts = (theme: ThemeId, level: 'pre-k' | 'kindergarten', baseWeek: number, pathId: string) => {
  const p = prof(theme, level === 'pre-k' ? 4 : 5); const w: ProgramWeek = { index: 3, level, baseWeek, theme, focus: [] };
  const f = weekFacts(p, w);
  return { f, sf: storyFacts(f, { id: pathId })! };
};
type Case = { name: string; expect: 'pass' | RegExp; theme: ThemeId; level: 'pre-k' | 'kindergarten'; week: number; path: string; story: any; teaching?: boolean; judge?: number[] };
const T = (title: string, pathId: string, scenes: string[], pages: string[]) => ({ title, pathId, scenes, pages });
// Pre-K wk 26 = letter b; K wk 15 = -at (sight words am, are).
const ocShell = ['open-beach', 'find-shell', 'prob-shell-wave', 'help-flip-shell', 'solve-shell', 'rest-sand-nap'];
const okShell = ['Snip the crab waves a claw. Hi, {{name}}!', 'Snip finds a big shell in the sand. Look!', 'Oh no! A big wave takes the shell.', '"Flip can swim!" says {{name}}. Flip brings the shell back.', 'Snip hugs his big shell. Flip smiles.', 'Snip naps by the blue sea. Shh!'];
const trMud = ['open-garage', 'exp-hill', 'find-mud', 'prob-stuck', 'try-spin', 'help-hook-mud', 'solve-out', 'cel-wash', 'end-home', 'rest-night'];
const okMud = ['Bump rolls out of the garage. "Hi, {{name}}! I am Bump!"', 'Bump drives up a big hill past the round trees.', 'At the top, a big mud puddle sits on the road.', 'Bump rolls in. Oh no! Bump is stuck in the mud.', 'The wheels spin, spin, spin. Mud flies up!', '"Hook can help!" says {{name}}. Hook pulls Bump out.', 'Pop! Bump is out of the mud. It is free.', 'Bump gets a wash. Scrub, scrub! A cat, a hat, a mat of bubbles!', 'Bump drives back to the garage. We are home!', 'At night, Bump, Scoop and Hook rest. Good night, {{name}}!'];
const petsBall = ['open-friends', 'find-ball', 'prob-ball-couch', 'help-mitt-under', 'solve-ball-out', 'cel-fetch'];
const jgBan = ['open-friends', 'find-bananas', 'prob-too-high', 'help-zip-climb', 'solve-bananas', 'cel-bananas'];
const cases: Case[] = [
  // ---- good: must pass both layers
  { name: 'G1 good ocean pre-k shell', expect: 'pass', theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('{{name}} and the Big Shell', 'shell', ocShell, okShell) },
  { name: 'G2 good trucks K mud (-at)', expect: 'pass', theme: 'trucks', level: 'kindergarten', week: 15, path: 'mud', story: T('Bump in the Mud', 'mud', trMud, okMud) },
  { name: 'G3 good pets pre-k ball', expect: 'pass', theme: 'pets', level: 'pre-k', week: 26, path: 'ball', story: T('The Big Ball', 'ball', petsBall, ['Wag the pup and Mitt the kitten smile. Hi, {{name}}!', 'Wag plays with a big red ball on the rug.', 'Oh no! The ball rolls under the couch.', '"Mitt is little!" says {{name}}. Mitt crawls under.', 'Mitt pushes the ball back to Wag.', 'Wag jumps and gets the ball. Yay!']) },
  { name: 'G4 good jungle pre-k bananas', expect: 'pass', theme: 'jungle', level: 'pre-k', week: 26, path: 'bananas', story: T('Bananas for Bim', 'bananas', jgBan, ['Zip the monkey and his friends smile. Hi, {{name}}!', 'Bim the elephant and Zip see bananas. Yum!', 'Bim can not get the bananas. They are up high.', '"Zip can climb!" says {{name}}. Up goes Zip.', 'Zip drops the bananas, and Bim gets them.', 'Zip, Bim and Mango the parrot eat bananas. Yum!']) },
  { name: 'G5 good: {{name}} speaks an action in quotes ("Swim to it!")', expect: 'pass', theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', ocShell, [...okShell.slice(0, 3), '"Swim to it, Flip!" says {{name}}. Flip brings the shell back.', ...okShell.slice(4)]) },
  // ---- bad, caught by code
  { name: 'B1 picture/text mismatch (Hook pulls on help-scoop-hole)', expect: /does not name anything|names Hook|not in the picture/, theme: 'trucks', level: 'pre-k', week: 26, path: 'ball', story: T('The Ball', 'ball', ['open-road', 'find-ball', 'prob-hole', 'help-scoop-hole', 'solve-ball', 'cel-ball-bed'], ['Bump drives past a cone. Beep! Hi, {{name}}!', 'A red ball rolls to a big hole. Bump rolls after it.', 'Oh no! The ball is in the deep hole.', '"Hook can help!" says {{name}}. Hook pulls with its cable.', 'Scoop lifts the red ball up. Got it!', 'Bump gives the ball a ride. Yay!']) },
  { name: 'B2 subtle mismatch: Snip climbs a tree (caught by the picture check)', expect: /page 2: the words say something the picture does not show/, judge: [2], theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', ocShell, [okShell[0], 'Snip climbs a palm tree. He sees a shell.', ...okShell.slice(2)]) },
  { name: 'B3 character not in scene (Gup on find-shell)', expect: /names Gup/, theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', ocShell, [okShell[0], 'Snip and Gup find a big shell in the sand.', ...okShell.slice(2)]) },
  { name: 'B4 character not in scene by kind word only ("the fish" on find-shell)', expect: /names Gup/, theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', ocShell, [okShell[0], 'Snip finds a big shell. The fish swims by.', ...okShell.slice(2)]) },
  { name: 'B5 plot jump (shell problem, ball solve: a self-built sequence)', expect: /not the given story path/, theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', '', ['open-beach', 'find-shell', 'prob-shell-wave', 'help-flip-ball', 'solve-ball-back', 'cel-ball-game'], ['Snip the crab waves a claw. Hi, {{name}}!', 'Snip finds a big shell in the sand. Look!', 'Oh no! A big wave takes the shell.', '"Flip can get it!" says {{name}}. Flip pushes the ball.', 'The ball is back on the sand. Yes!', 'Snip, Flip and Gup play ball. Up it goes!']) },
  { name: 'B6 two problems', expect: /exactly one problem/, theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', '', ['open-beach', 'prob-shell-wave', 'prob-ball-far', 'help-flip-ball', 'solve-ball-back', 'cel-ball-game'], ['Snip waves a claw. Hi, {{name}}!', 'Oh no! A wave takes the shell.', 'Oh no! The ball floats far out.', '"Flip can get it!" says {{name}}. Flip pushes the ball.', 'The ball is back on the sand. Yes!', 'Snip, Flip and Gup play ball. Up it goes!']) },
  { name: 'B7 wrong page count (7 for pre-k)', expect: /needs 6 pages/, theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', [...ocShell.slice(0, 5), 'try-shell-wade', 'rest-sand-nap'], [...okShell.slice(0, 5), 'Snip wades in.', 'Snip naps. Shh!']) },
  { name: 'B8 invented real kid name (Emma)', expect: /personal name/, theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', ocShell, ['Snip waves a claw at Emma. Hi, {{name}}!', ...okShell.slice(1)]) },
  { name: 'B9 invented name not on list (Rosie) mid-sentence', expect: /possible name/, theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', ocShell, ['Snip and his pal Rosie wave. Hi, {{name}}!', ...okShell.slice(1)]) },
  { name: 'B10 invented name at sentence start (Rosie)', expect: /possible name "Rosie"/, theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', ocShell, ['Snip the crab waves a claw. Rosie waves too. Hi, {{name}}!', ...okShell.slice(1)]) },
  { name: 'B11 uses "you"', expect: /speaks to the reader/, theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', ocShell, ['Snip waves a claw at you. Hi, {{name}}!', ...okShell.slice(1)]) },
  { name: 'B12 em dash', expect: /dash/, theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', ocShell, ['Snip the crab waves a claw — hi, {{name}}!', ...okShell.slice(1)]) },
  { name: 'B13 {{name}} on only one page', expect: /fewer than 2|does not help/, theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', ocShell, ['Snip the crab waves a claw. Hi!', okShell[1], okShell[2], '"Flip can swim!" says {{name}}. Flip brings the shell back.', okShell[4], okShell[5]]) },
  { name: 'B14 {{name}} swims out to get the shell', expect: /\{\{name\}\} swims, which would need/, theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', ocShell, [okShell[0], okShell[1], okShell[2], '{{name}} swims out with Flip. The shell is back.', okShell[4], okShell[5]]) },
  { name: 'B15 K: misses word family (-at)', expect: /word family/, theme: 'trucks', level: 'kindergarten', week: 15, path: 'mud', story: T('Bump', 'mud', trMud, okMud.map((p) => p.replace('A cat, a hat, a mat of bubbles!', 'Lots of bubbles!'))) },
  { name: 'B16 scary word', expect: /not for kids/, theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', ocShell, [okShell[0], okShell[1], 'Oh no! A wave takes the shell. It is scary.', okShell[3], okShell[4], okShell[5]]) },
  { name: 'B17 pet-form cast name (Snippy) at sentence start', expect: /cast name changed|possible name/, theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', ocShell, ['Snippy the crab waves a claw. Hi, {{name}}!', ...okShell.slice(1)]) },
  { name: 'B18 sad crying', expect: /crying/, theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', ocShell, [okShell[0], okShell[1], 'Oh no! A wave takes the shell. Snip cries.', okShell[3], okShell[4], okShell[5]]) },
  // ---- new rules from this fix
  { name: 'N1 {{name}} grabs the ball', expect: /\{\{name\}\} grabs/, theme: 'pets', level: 'pre-k', week: 26, path: 'ball', story: T('Ball', 'ball', petsBall, ['Wag the pup and Mitt the kitten smile. Hi, {{name}}!', 'Wag plays with a big red ball on the rug.', 'Oh no! The ball rolls under the couch.', '"Mitt is little!" says {{name}}. Mitt crawls under.', 'Mitt pushes the ball out, and {{name}} grabs it.', 'Wag jumps and gets the ball. Yay!']) },
  { name: 'N2 {{name}} naps too', expect: /\{\{name\}\} naps/, theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', ocShell, [...okShell.slice(0, 5), 'Snip naps, and {{name}} naps too. Shh!']) },
  { name: 'N3 {{name}} rides on Flip', expect: /\{\{name\}\} rides/, theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', ocShell, [okShell[0], okShell[1], okShell[2], '"Go, Flip!" says {{name}}. {{name}} rides on Flip to the shell.', okShell[4], okShell[5]]) },
  { name: 'N4 problem object differs from solve object (lost shell, then a ball)', expect: /solve page does not fix the same thing/, theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', ocShell, [...okShell.slice(0, 4), 'Snip has his big ball back. Flip smiles.', okShell[5]]) },
  { name: 'N5 pet form mid-sentence (Stompy)', expect: /cast name changed|possible name/, theme: 'dinosaurs', level: 'pre-k', week: 26, path: 'egg-short', story: T('Egg', 'egg-short', ['open-friends', 'find-egg', 'prob-egg-rolls', 'help-dot-egg', 'solve-egg-home', 'cel-hatch'], ['Stomp, Dot and Tops smile. Hi, {{name}}!', 'Little Stompy finds a big egg in a nest.', 'Oh no! The egg rolls down the hill.', '"By the rocks!" says {{name}}. Dot gets the egg.', 'The egg is home in the nest.', 'Tap, tap! The egg cracks.']) },
  { name: 'N6 Pre-K page over the shared length rule', expect: /too long|too many sentences|sentence too long/, theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', ocShell, [okShell[0], 'Snip finds a big shell in the sand by the blue sea today, and it is so very pretty.', ...okShell.slice(2)]) },
  { name: 'N7 picture check: two balls in the words, one in the picture', expect: /page 5: the words say something the picture does not show/, judge: [5], theme: 'sports', level: 'pre-k', week: 26, path: 'tree', story: T('Ball', 'tree', ['open-team', 'find-kick', 'prob-ball-tree', 'help-hoot-fly', 'solve-ball-down', 'cel-goal'], ['Bop, Zig and Coach Hoot smile. Hi, {{name}}!', 'Bop the bear kicks the ball up high.', 'Oh no! The ball is stuck in a tree.', '"Hoot can fly!" says {{name}}. Hoot taps the ball.', 'Bop catches two balls at once!', 'Bop kicks the ball in the goal. Zig the fox cheers!']) },
  { name: 'N8 wrong cast acts (Flip hugs the shell where Snip hugs it)', expect: /page 5: the words say something/, judge: [5], theme: 'ocean', level: 'pre-k', week: 26, path: 'shell', story: T('Snip', 'shell', ocShell, [...okShell.slice(0, 4), 'Flip hugs the big shell, and Snip smiles.', okShell[5]]) },
];

/** Scripted stand-in for the checker model: answers "no" on the listed pages. */
const judge = (pages: number, no: number[] = []) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ pages: Array.from({ length: pages }, (_, i) => ({ page: i + 1, matches: !no.includes(i + 1), missing: no.includes(i + 1) ? 'not in the picture' : '' })) }) }] });
async function live(story: any, theme: ThemeId): Promise<unknown> {
  const p = _checkPrompts(story, theme);
  const res = await fetch(`${process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com'}/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY!, 'anthropic-version': '2023-06-01' }, body: JSON.stringify(requestBody({ system: p.system, user: p.user, mode: 'check' })) });
  return res.json();
}

let ok = 0, bad = 0; const out: string[] = [];
for (const c of cases) {
  const { sf } = facts(c.theme, c.level, c.week, c.path);
  let res: string;
  try {
    const st = validateStory(c.story, sf, { teaching: c.teaching ?? true });
    readPictureCheck(process.env.LIVE ? await live(st, c.theme) : judge(st.pages.length, c.judge), st.pages.length);
    res = 'PASS';
  } catch (e) { if (!(e instanceof ContentInvalid)) throw e; res = 'FAIL: ' + e.message; }
  const good = c.expect === 'pass' ? res === 'PASS' : res !== 'PASS' && (c.expect as RegExp).test(res);
  good ? ok++ : bad++;
  out.push(`${good ? 'OK  ' : 'BAD '} ${c.name}\n       -> ${res}`);
}
console.log(out.join('\n'));
console.log(`${ok} as expected, ${bad} unexpected (${cases.length} cases)`);

// Word problems: the model's numbers are checked and the answer is always recomputed.
const { f, sf } = facts('ocean', 'pre-k', 26, 'shell');
const base = { story: T('{{name}} and the Big Shell', 'shell', ocShell, okShell), tracingSentence: 'Snip has a big shell.', parentNote: { teaches: 'This week is the letter B.', why: 'Many kids like crabs.', activities: ['Hunt for b things in the bath.', 'Line up shells by size.'] },
  wordProblems: [{ text: 'Snip finds 2 shells and 1 more. How many shells?', a: 2, b: 1, op: '+', answer: 9, icon: 'shell' }, { text: '3 fish swim by and 1 more. How many fish?', a: 3, b: 1, op: '+', answer: 4, icon: 'fish' }, { text: '4 crabs sit and 1 more comes. How many crabs?', a: 4, b: 1, op: '+', answer: 5, icon: 'crab' }, { text: 'Snip sees 2 shells. Flip sees 3 shells. Which is more?', a: 2, b: 3, op: 'compare', answer: 3, icon: 'shell' }] };
let c1 = false, c2 = false;
try { const c = validateContent(base, f, sf); c1 = c.wordProblems[0].answer === 3; console.log('C1 wrong model answer 9 ->', c.wordProblems[0].answer, '(recomputed)'); } catch (e) { console.log('C1 threw', (e as Error).message); }
try { const b2 = structuredClone(base); b2.wordProblems[1] = { text: '30 fish swim by and 1 more. How many?', a: 30, b: 1, op: '+', answer: 31, icon: 'fish' } as any; validateContent(b2, f, sf); console.log('C2 PASS (bad)'); } catch (e) { c2 = /out of range/.test((e as Error).message); console.log('C2 big number ->', (e as Error).message); }
if (OUTDIR()) await (await import('node:fs/promises')).writeFile(`${OUTDIR()}/prompt-check-ocean-prek.txt`, (() => { const p = _checkPrompts(validateStory(base.story, sf), 'ocean'); return p.system + '\n\n=====USER=====\n' + p.user; })());
void parseResponse;
if (bad || !c1 || !c2) process.exitCode = 1;
function OUTDIR() { return process.env.OUT; }
