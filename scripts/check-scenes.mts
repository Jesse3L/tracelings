// Checks the story scene library (src/lib/program/scenes.ts).
// Run: npx tsx scripts/check-scenes.mts
import { SCENES, BEATS, SCENE_STYLE, sceneById, sceneSrc, type Beat } from '../src/lib/program/scenes';
import { THEME_IDS } from '../src/lib/program/themes';

const errors: string[] = [];
const fail = (m: string) => errors.push(m);

// Roughly the top 100 boys' and top 100 girls' names given to US babies in recent years (SSA lists),
// plus a few common nicknames. A cast name must not be one of these, so a story never reads like it's about a real child.
const TOP_NAMES = new Set(`
liam noah oliver james elijah mateo theodore henry lucas william benjamin levi sebastian jack ezra michael daniel
leo owen samuel hudson alexander asher luca ethan john david jackson joseph mason luke matthew julian dylan elias
jacob maverick gabriel logan aiden thomas isaac miles grayson santiago anthony wyatt carter jayden ezekiel caleb cooper
josiah charles christopher isaiah nolan cameron nathan joshua kai waylon angel lincoln andrew roman adrian aaron wesley
ian thiago axel brooks bennett weston rowan christian theo beau eli silas jonathan ryan leonardo walker jaxon micah
everett robert enzo parker jeremiah jose colton luka easton landon jordan amir gael austin adam jameson august xavier
myles dominic damian nicholas jace carson atlas
olivia emma charlotte amelia sophia mia isabella ava evelyn luna harper sofia scarlett elizabeth eleanor emily chloe
mila violet penelope gianna aria abigail ella avery hazel nora layla lily aurora nova ellie madison grace isla willow
zoe riley stella eliana ivy victoria emilia zoey naomi hannah lucy elena lillian maya leah paisley addison natalie
valentina everly delilah leilani madelyn kinsley ruby sophie alice genesis claire audrey sadie aaliya josephine autumn
brooklyn quinn kennedy cora savannah caroline athena natalia hailey aubrey emery anna iris bella eloise skylar jade
gabriella ariana maria adeline lydia sarah nevaeh serenity liliana ayla everleigh raelynn allison madeline vivian
maeve lyla samantha rylee eva melody clara hadley julia piper parker
max sam ben jake tom tim bob ann amy kim kate jen meg sue pat ted rex
`.trim().split(/\s+/));

const BANNED = [/unlock/i, /seamless/i, /elevate/i, /\bdive in\b/i, /\bdive into\b/i, /deep dive/i, /whether you're/i, /in today's world/i, /game[- ]changer/i, /it's important to note/i, /look no further/i, /without further ado/i, /\bnavigate/i, /\bjourney\b/i, /ultimate guide/i];
// Words that should never describe a scene (the cast descriptions and style may say "no fire", "nothing scary").
const UNSAFE = [/\bfire\b/i, /\bflame/i, /\blava\b/i, /\berupt/i, /\bteeth\b/i, /\bfang/i, /\broar/i, /\bscary\b/i, /\bscared\b/i, /\bstorm\b/i, /\bthunder/i, /\blightning\b/i, /\bhurt\b/i, /\bcry/i, /\bblood/i, /\bsword\b/i, /\bfight/i, /\bangry\b/i, /\bcrash/i, /\bbite[sd]?\b(?! taken)/i];

function textCheck(where: string, s: string) {
  if (/[—–]/.test(s)) fail(`${where}: em or en dash in "${s.slice(0, 60)}"`);
  for (const b of BANNED) if (b.test(s)) fail(`${where}: banned word ${b} in "${s.slice(0, 60)}"`);
}

textCheck('SCENE_STYLE', SCENE_STYLE);
if (!SCENE_STYLE.toLowerCase().includes('no text')) fail('SCENE_STYLE must say no text');

const themes = Object.keys(SCENES);
if (themes.length !== 12) fail(`expected 12 themes, got ${themes.length}`);
for (const t of THEME_IDS) if (!SCENES[t]) fail(`missing theme ${t}`);

const summary: string[] = [];
for (const theme of THEME_IDS) {
  const T = SCENES[theme];
  if (!T) continue;
  if (T.theme !== theme) fail(`${theme}: theme field is ${T.theme}`);
  textCheck(`${theme}.setting`, T.setting);

  // Cast
  if (T.cast.length < 2 || T.cast.length > 3) fail(`${theme}: cast has ${T.cast.length} members`);
  const castNames = new Set(T.cast.map((c) => c.name));
  if (castNames.size !== T.cast.length) fail(`${theme}: duplicate cast names`);
  for (const c of T.cast) {
    textCheck(`${theme}.cast.${c.name}`, `${c.name} ${c.kind} ${c.describe} ${c.words.join(' ')}`);
    for (const part of c.name.toLowerCase().split(/\s+/).filter((p) => !['princess', 'sir'].includes(p))) {
      if (TOP_NAMES.has(part)) fail(`${theme}: cast name "${c.name}" is a common child's name`);
    }
    if (!c.words.includes(c.name.split(' ').pop()!)) fail(`${theme}: ${c.name} words should include the short name`);
    if (/\b(named|called)\b/i.test(c.describe) || c.describe.includes(c.name)) fail(`${theme}: ${c.name} description must be name-free`);
  }

  // Scenes
  const n = T.scenes.length;
  if (n < 30 || n > 36) fail(`${theme}: ${n} scenes (want 30 to 36)`);
  const ids = new Set<string>();
  const beatCount = Object.fromEntries(BEATS.map((b) => [b, 0])) as Record<Beat, number>;
  for (const sc of T.scenes) {
    const where = `${theme}/${sc.id}`;
    if (ids.has(sc.id)) fail(`${where}: duplicate id`);
    ids.add(sc.id);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(sc.id)) fail(`${where}: id must be kebab-case`);
    if (!BEATS.includes(sc.beat)) fail(`${where}: bad beat ${sc.beat}`);
    else beatCount[sc.beat]++;
    textCheck(where, [sc.shows, ...sc.props, ...sc.words, sc.drawPrompt].join(' | '));
    for (const u of UNSAFE) if (u.test(sc.shows) || sc.props.some((p) => u.test(p)) || sc.words.some((w) => u.test(w))) fail(`${where}: unsafe word ${u}`);
    if (sc.shows.length < 30) fail(`${where}: shows is too short to draw from`);
    if (!sc.words.length || !sc.props.length) fail(`${where}: needs props and words`);
    for (const name of sc.cast) {
      if (!castNames.has(name)) fail(`${where}: unknown cast member ${name}`);
      if (!sc.shows.includes(name)) fail(`${where}: ${name} is in cast but not in shows`);
      const c = T.cast.find((x) => x.name === name);
      if (c && !sc.drawPrompt.includes(c.describe)) fail(`${where}: drawPrompt is missing ${name}'s description`);
    }
    for (const c of T.cast) if (sc.shows.includes(c.name) && !sc.cast.includes(c.name)) fail(`${where}: ${c.name} is in shows but not in cast`);
    if (!sc.drawPrompt.startsWith(SCENE_STYLE)) fail(`${where}: drawPrompt must start with SCENE_STYLE`);
    if (/\{\{name\}\}|\bchild\b(?! is)/i.test(sc.shows)) fail(`${where}: the child is never drawn`);
    if (sceneById(theme, sc.id) !== sc) fail(`${where}: sceneById mismatch`);
    if (sceneSrc(theme, sc.id) !== `/program/scenes/${theme}/${sc.id}.png`) fail(`${where}: sceneSrc mismatch`);
  }
  for (const b of BEATS) if (beatCount[b] < 3) fail(`${theme}: beat ${b} has ${beatCount[b]} scenes (want 3+)`);

  // Paths
  if (T.paths.length < 4) fail(`${theme}: ${T.paths.length} paths (want 4+)`);
  const pathIds = new Set<string>();
  const levels = new Set<string>();
  for (const p of T.paths) {
    const where = `${theme} path ${p.id}`;
    if (pathIds.has(p.id)) fail(`${where}: duplicate path id`);
    pathIds.add(p.id);
    levels.add(p.level);
    textCheck(where, `${p.title} ${p.plot}`);
    const len = p.scenes.length;
    if (len < 6 || len > 12) fail(`${where}: ${len} scenes (want 6 to 12)`);
    if (p.level === 'pre-k' && (len < 6 || len > 8)) fail(`${where}: pre-k path has ${len} scenes (want 6 to 8)`);
    if (p.level === 'kindergarten' && (len < 10 || len > 12)) fail(`${where}: kindergarten path has ${len} scenes (want 10 to 12)`);
    if (new Set(p.scenes).size !== len) fail(`${where}: repeats a scene`);
    const scs = p.scenes.map((id) => { const sc = sceneById(theme, id); if (!sc) fail(`${where}: unknown scene ${id}`); return sc; });
    if (scs.some((x) => !x)) continue;
    const beats = scs.map((x) => x!.beat);
    if (beats[0] !== 'opening') fail(`${where}: must start with an opening (got ${beats[0]})`);
    if (!['ending', 'rest', 'celebrate'].includes(beats[len - 1])) fail(`${where}: must end with ending, rest or celebrate (got ${beats[len - 1]})`);
    // One clear problem that gets solved, in order.
    const at = (b: Beat) => beats.indexOf(b);
    if (beats.filter((b) => b === 'problem').length !== 1) fail(`${where}: needs exactly one problem scene`);
    if (at('solve') < 0 || at('problem') > at('solve')) fail(`${where}: problem must come before a solve`);
    if (at('help') >= 0 && (at('help') < at('problem') || at('help') > at('solve'))) fail(`${where}: help must sit between problem and solve`);
  }
  if (!levels.has('pre-k') || !levels.has('kindergarten')) fail(`${theme}: needs at least one path for each level`);
  summary.push(`${theme.padEnd(10)} ${String(n).padStart(2)} scenes, ${T.paths.length} paths, cast: ${T.cast.map((c) => c.name).join(', ')}`);
}

console.log(summary.join('\n'));
if (errors.length) {
  console.log(`\n${errors.length} problem(s):`);
  for (const e of errors) console.log(`  ${e}`);
  process.exit(1);
}
console.log('\nScene library OK');
