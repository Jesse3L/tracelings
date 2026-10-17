// Every template picture book story (12 themes x every ready path x every week of both plans, plus extra review
// weeks) through the same validator the AI must pass, sight words, word family and letters included.
// Run: npx tsx scripts/qa/templates-validate.mts   (exit code 1 on failures; FULL=1 prints them all)
import { readFile } from 'node:fs/promises';
import type { ChildProfile, ProgramWeek, ThemeId } from '../../src/lib/program/types';
import { THEME_IDS } from '../../src/lib/program/themes';
import { setSceneArt, readyPaths } from '../../src/lib/program/story';
import { sceneStoryFor, PLANS } from '../../src/lib/program/templates';
import { validateStory, storyFacts, weekFacts, ContentInvalid } from '../../src/lib/server/ai';

setSceneArt(JSON.parse(await readFile('src/lib/program/sceneArt.json', 'utf8')));
const profile = (theme: ThemeId, level: string): ChildProfile => ({ id: 'c_tpl', ageYears: level === 'pre-k' ? 4 : 5, skills: {}, interests: [theme], daysPerWeek: 5, minutesPerDay: 15, faith: false, createdAt: '' });
let n = 0; const fails: string[] = []; const byReason = new Map<string, number>();
for (const theme of THEME_IDS as ThemeId[]) for (const level of ['pre-k', 'kindergarten'] as const) {
  const paths = readyPaths(theme, level);
  paths.forEach((path, k) => {
    for (const [wi, w] of PLANS[level].weeks.entries()) for (const extraReview of [false, true]) {
      if (extraReview && w.kind !== 'letter' && w.kind !== 'review') continue;
      const pw: ProgramWeek = { index: wi + 1, level, baseWeek: wi + 1, theme, focus: [], ...(extraReview ? { extraReview } : {}) };
      const st = sceneStoryFor(theme, level, w, pw, k);
      n++;
      if (!st) { fails.push(`${theme}/${path.id} w${wi + 1}: no story`); continue; }
      const f = weekFacts(profile(theme, level), pw);
      const sf = storyFacts(f, { id: path.id })!;
      try { validateStory(st, sf); } catch (e) {
        if (!(e instanceof ContentInvalid)) throw e;
        const why = e.message.replace(/page \d+: /, '');
        byReason.set(why, (byReason.get(why) ?? 0) + 1);
        fails.push(`${theme}/${level}/${path.id} w${wi + 1}${extraReview ? 'r' : ''} (${w.kind}): ${e.message} :: ${st.pages.find((p) => p.includes('"')) ?? ''}`);
      }
    }
  });
}
console.log(`${n} template stories, ${fails.length} fail the AI validator (${((100 * fails.length) / n).toFixed(1)}%)`);
for (const [k, v] of [...byReason].sort((a, b) => b[1] - a[1])) console.log(`  ${v}  ${k}`);
console.log((process.env.FULL ? fails : fails.slice(0, 25)).join('\n'));
if (fails.length) process.exitCode = 1;
