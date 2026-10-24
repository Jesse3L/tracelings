// Every marketing email Tracelings sends, as code. Each template returns { subject, preview, html, text }.
// Copy follows docs/content-guide.md: no em or en dashes, none of the banned words, no invented numbers or quotes,
// talk to the grown-up (never the child), and never a child's name. The only personal detail we use is which free
// tool someone signed up from (their `interest` group).
//
// The unsubscribe link is Resend's {{{RESEND_UNSUBSCRIBE_URL}}} placeholder, which Resend fills per contact in
// automations and broadcasts. Previews and test sends swap it for a harmless link (see withUnsubscribe()).
import type { Interest } from './audience';

export interface EmailContent { subject: string; preview: string; html: string; text: string }

export const SITE_URL = 'https://tracelings.com';
export const FROM = 'Tracelings <hello@tracelings.com>';
export const MAILING_ADDRESS = 'Tracelings, 17350 State Hwy 249, Ste 220 #35878, Houston, TX 77064, US';
export const UNSUB = '{{{RESEND_UNSUBSCRIBE_URL}}}';

// ---------- links ----------

/** Absolute tracelings.com link with UTM tags (utm_source=email, utm_medium, utm_campaign). */
export function link(path: string, medium: string, campaign: string): string {
  const u = new URL(path, SITE_URL);
  u.searchParams.set('utm_source', 'email');
  u.searchParams.set('utm_medium', medium);
  u.searchParams.set('utm_campaign', campaign);
  return u.toString();
}
const img = (path: string) => new URL(path, SITE_URL).toString();

// ---------- blocks ----------
// Body copy is a list of blocks. Inline links use [label](/path/), which become UTM-tagged links in HTML and
// "label: url" in the text version. **bold** is allowed for short labels.

type Block =
  | { p: string }
  | { h: string }
  | { list: string[] }
  | { button: { label: string; path: string } }
  | { pictures: { src: string; alt: string; caption: string }[] }
  | { small: string }
  | { sign: true };

interface Email { subject: string; preview: string; blocks: Block[]; medium: string; campaign: string; why: string }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const C = {
  bg: '#f6f8fb', card: '#ffffff', ink: '#1e2a44', body: '#2c3954', muted: '#5f6b82', hair: '#dce3ee',
  pencil: '#f2c14e', pencilDark: '#d9a52f', rule: '#5b86d9', link: '#2f5fb8',
};
const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

function inlineHtml(s: string, medium: string, campaign: string): string {
  let out = esc(s);
  out = out.replace(/\*\*(.+?)\*\*/g, `<strong style="color:${C.ink};">$1</strong>`);
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, path: string) =>
    `<a href="${esc(link(path, medium, campaign))}" style="color:${C.link};text-decoration:underline;">${label}</a>`);
  return out;
}
function inlineText(s: string, medium: string, campaign: string): string {
  return s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, path: string) => `${label} (${link(path, medium, campaign)})`);
}

function blockHtml(b: Block, e: Email): string {
  const P = `margin:0 0 16px;font-family:${FONT};font-size:17px;line-height:1.6;color:${C.body};`;
  if ('p' in b) return `<p style="${P}">${inlineHtml(b.p, e.medium, e.campaign)}</p>`;
  if ('h' in b) return `<h2 style="margin:24px 0 10px;font-family:${FONT};font-size:20px;line-height:1.3;color:${C.ink};font-weight:700;">${inlineHtml(b.h, e.medium, e.campaign)}</h2>`;
  if ('small' in b) return `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.55;color:${C.muted};">${inlineHtml(b.small, e.medium, e.campaign)}</p>`;
  if ('list' in b) {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 16px;">${b.list.map((li) =>
      `<tr><td valign="top" width="22" style="font-family:${FONT};font-size:17px;line-height:1.6;color:${C.rule};padding:0 0 8px;">&#8226;</td><td valign="top" style="font-family:${FONT};font-size:17px;line-height:1.6;color:${C.body};padding:0 0 8px;">${inlineHtml(li, e.medium, e.campaign)}</td></tr>`).join('')}</table>`;
  }
  if ('button' in b) {
    const href = esc(link(b.button.path, e.medium, e.campaign));
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr><td align="center" bgcolor="${C.pencil}" style="border-radius:10px;border-bottom:3px solid ${C.pencilDark};">`
      + `<a href="${href}" style="display:inline-block;padding:14px 24px;font-family:${FONT};font-size:17px;line-height:1.3;font-weight:700;color:${C.ink};text-decoration:none;border-radius:10px;">${esc(b.button.label)}</a>`
      + `</td></tr></table>`;
  }
  if ('pictures' in b) {
    const cells = b.pictures.map((pic) =>
      `<td class="pic" valign="top" width="${Math.floor(100 / b.pictures.length)}%" style="padding:0 6px;">`
      + `<img src="${esc(img(pic.src))}" width="260" alt="${esc(pic.alt)}" style="display:block;width:100%;max-width:260px;height:auto;border:1px solid ${C.hair};border-radius:8px;background:#ffffff;">`
      + `<p style="margin:8px 0 0;font-family:${FONT};font-size:14px;line-height:1.45;color:${C.muted};">${esc(pic.caption)}</p></td>`).join('');
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:4px -6px 20px;"><tr>${cells}</tr></table>`;
  }
  return `<p style="${P}margin-top:8px;">Jesse at Tracelings</p>`;
}

function blockText(b: Block, e: Email): string {
  if ('p' in b) return inlineText(b.p, e.medium, e.campaign);
  if ('h' in b) return inlineText(b.h, e.medium, e.campaign).toUpperCase();
  if ('small' in b) return inlineText(b.small, e.medium, e.campaign);
  if ('list' in b) return b.list.map((li) => `- ${inlineText(li, e.medium, e.campaign)}`).join('\n');
  if ('button' in b) return `${b.button.label}: ${link(b.button.path, e.medium, e.campaign)}`;
  if ('pictures' in b) return b.pictures.map((p) => `[Picture: ${p.alt}]`).join('\n');
  return 'Jesse at Tracelings';
}

function render(e: Email): EmailContent {
  const body = e.blocks.map((b) => blockHtml(b, e)).join('\n');
  const home = esc(link('/', e.medium, e.campaign));
  // Hidden preheader, padded so mail apps don't pull body text into the preview line.
  const pre = `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.bg};opacity:0;">${esc(e.preview)}${'&#847;&zwnj;&nbsp;'.repeat(40)}</div>`;
  const html = `<!doctype html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light">
<title>${esc(e.subject)}</title>
<style>
  body { margin:0; padding:0; background:${C.bg}; }
  a { color:${C.link}; }
  @media (max-width: 620px) {
    .card { padding:24px 20px !important; border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
    .outer { padding:0 !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bg}" style="background:${C.bg};">
<tr><td class="outer" align="center" style="padding:24px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
    <tr><td style="padding:4px 4px 16px;">
      <a href="${home}" style="text-decoration:none;color:${C.ink};"><img src="${esc(img('/email/logo-96.png'))}" width="40" height="40" alt="Tracelings" style="display:inline-block;vertical-align:middle;border:0;border-radius:9px;"><span style="display:inline-block;vertical-align:middle;margin-left:10px;font-family:${FONT};font-size:20px;font-weight:700;color:${C.ink};">Tracelings</span></a>
    </td></tr>
    <tr><td class="card" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.hair};border-radius:14px;padding:32px 36px;">
${body}
    </td></tr>
    <tr><td style="padding:20px 8px 8px;font-family:${FONT};font-size:13px;line-height:1.55;color:${C.muted};">
      <p style="margin:0 0 8px;">${esc(e.why)} We never ask for your child's name or details.</p>
      <p style="margin:0 0 8px;"><a href="${UNSUB}" style="color:${C.muted};text-decoration:underline;">Unsubscribe</a> anytime with one click. Questions? Just reply to this email.</p>
      <p style="margin:0;">${esc(MAILING_ADDRESS)}</p>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
  const text = [
    ...e.blocks.map((b) => blockText(b, e)),
    '',
    '---',
    `${e.why} We never ask for your child's name or details.`,
    `Unsubscribe anytime: ${UNSUB}`,
    MAILING_ADDRESS,
  ].join('\n\n').replace(/\n{3,}/g, '\n\n');
  return { subject: e.subject, preview: e.preview, html, text };
}

// ---------- shared copy ----------

const WHY_SIGNUP = 'You are getting this because you gave your email to download a free printable on tracelings.com.';
const FREE_LINE = 'Every one-page printable on Tracelings stays free. The full homeschool plans now live inside the membership, and week 1 is always free to try.';
const PROGRAM_PITCH_SHORT = 'We also make Tracelings at Home, Personalized: a homeschool plan built around one child, at their level and pace, themed on what they love. The first week is free to print.';

const DINO_PICTURES: { src: string; alt: string; caption: string }[] = [
  { src: '/email/dinosaurs-find-egg.png', alt: 'Black and white line drawing of a small friendly T-rex smiling at a big spotted egg in a nest of sticks', caption: 'Stomp the little T-rex finds a big spotted egg.' },
  { src: '/email/dinosaurs-solve-egg-home.png', alt: 'Line drawing of the little T-rex setting the spotted egg back in its nest while a tall long-neck dinosaur smiles', caption: 'Later in the book, the egg is safe back in its nest.' },
];

// ---------- welcome series (new sign-ups) ----------
// Days after sign-up: 0, 2, 5, 9, 14. One clear button per email.

const D0_INTRO: Record<Interest, { subject: string; preview: string; thanks: string; links: string }> = {
  letters: {
    subject: 'Your tracing pages, and a few more to try',
    preview: 'Every free tool on Tracelings stays free. Here are a few more worth bookmarking.',
    thanks: 'Thanks for printing a tracing page from Tracelings. Every free tool on the site stays free, so come back whenever you need another page.',
    links: 'A few that go well together: [name tracing worksheets](/name-tracing/), [letter tracing pages for A to Z](/letter-tracing/) and [sight word practice by grade](/sight-words/).',
  },
  coloring: {
    subject: 'Your coloring pages, and a few more to try',
    preview: 'Every free tool on Tracelings stays free. Here are a few more worth bookmarking.',
    thanks: 'Thanks for grabbing coloring pages from Tracelings. Every free page on the site stays free, so come back whenever you need a quiet half hour.',
    links: 'A few more to try: [free coloring pages by theme](/coloring-pages/), [name coloring pages](/name-coloring-pages/) with your child\'s name in big letters, and [Thanksgiving coloring pages](/coloring-pages/thanksgiving-coloring-pages/) for the weeks ahead.',
  },
  math: {
    subject: 'Your math worksheet, and a few more to try',
    preview: 'Every free tool on Tracelings stays free. Here are a few more worth bookmarking.',
    thanks: 'Thanks for printing a math worksheet from Tracelings. Every free worksheet on the site stays free, so come back whenever you need another one.',
    links: 'A few that go well together: [Pre-K math worksheets](/math-worksheets/pre-k/), [ten frame printables](/math-worksheets/ten-frames/) and [kindergarten math worksheets](/math-worksheets/kindergarten/).',
  },
  homeschool: {
    subject: 'Your homeschool week, and what comes next',
    preview: 'Week 1 is yours to print. Here is what the rest of the year looks like.',
    thanks: `Thanks for downloading a homeschool week from Tracelings. ${FREE_LINE}`,
    links: 'You can read the whole year on the [Pre-K homeschool plan](/homeschool/preschool/) and [kindergarten homeschool plan](/homeschool/kindergarten/) pages. For extra practice between weeks, the free [letter tracing pages](/letter-tracing/) and [word family worksheets](/word-families/) work with either plan.',
  },
  program: {
    subject: 'Your free week is ready whenever you are',
    preview: 'A few tips for week 1, and where to find your child\'s plan again.',
    thanks: 'Thanks for trying Tracelings at Home, Personalized. Week 1 of your child\'s plan is yours to print, themed on what they love, with their name on the pages.',
    links: 'Your child\'s name stays on your device. It is never sent to us, so if you switch devices you\'ll type it again on the [program page](/program/).',
  },
  general: {
    subject: 'Welcome to Tracelings',
    preview: 'Every free tool on Tracelings stays free. Here are a few worth bookmarking.',
    thanks: 'Thanks for joining Tracelings. Every free tool on the site stays free, so come back whenever you need another page.',
    links: 'A few favorites: [name tracing worksheets](/name-tracing/), [free coloring pages](/coloring-pages/) and the [free kindergarten math worksheets](/math-worksheets/kindergarten/).',
  },
};

export function welcomeDay0(v: Interest): EmailContent {
  const d = D0_INTRO[v];
  const blocks: Block[] = v === 'program'
    ? [
        { p: 'Hi there,' },
        { p: d.thanks },
        { p: 'A few things that help week 1 go smoothly:' },
        { list: [
          'Print the whole week at once, so each day is ready to go.',
          'Cut and fold the picture book together. Kids often like helping put it together.',
          'Keep each day short. A page or two is plenty, and stopping while it\'s still fun makes the next day easier.',
        ] },
        { p: d.links },
        { button: { label: 'Open the program page', path: '/program/' } },
        { sign: true },
      ]
    : [
        { p: 'Hi there,' },
        { p: d.thanks },
        { p: d.links },
        { h: 'Want a week built around your child?' },
        { p: 'We also make a personalized homeschool program for ages 3 to 7. You answer a few questions in about 5 minutes: what your child can do today, how much time you have, and what they love (dinosaurs, trucks, unicorns, space and more). We build their plan at their level.' },
        { p: 'Week 1 is free to print, themed on their favorite things, with their name on the pages. No card needed.' },
        { button: { label: 'Get a free week built around your child', path: '/program/' } },
        { sign: true },
      ];
  return render({ subject: d.subject, preview: d.preview, blocks, medium: 'welcome', campaign: 'day0', why: WHY_SIGNUP });
}

const D2_TIP: Record<Interest, { subject: string; preview: string; intro: string; tips: string[]; next: { label: string; path: string; line: string } }> = {
  letters: {
    subject: 'A 5-minute way to use tracing pages',
    preview: 'Short, fun and done before anyone gets tired.',
    intro: 'Tracing works best in short bursts. Here is a simple routine many families use:',
    tips: [
      '**Finger first.** Have your child trace the letter with a finger, then with a crayon.',
      '**Short crayons.** A broken crayon or a short pencil often nudges little fingers toward a fingertip grip.',
      '**Say it out loud.** Say the letter\'s name and sound together while they trace.',
      '**Reuse the page.** Slip it into a sheet protector and use a dry-erase marker.',
      '**Stop at 5 minutes,** even if the page isn\'t finished. Tomorrow is another page.',
    ],
    next: { label: 'Pick a letter of the week', path: '/letter-of-the-week/', line: 'For a next step, [letter of the week](/letter-of-the-week/) gives you one letter at a time: tracing, a letter hunt, a bubble letter to color and counting, in one pack.' },
  },
  coloring: {
    subject: 'Coloring pages that do a little more',
    preview: 'Three easy ways to add counting and talking to coloring time.',
    intro: 'Coloring is great on its own. If you want to sneak in a little learning, try one of these:',
    tips: [
      '**Tape the page to the wall** so they color standing up. It\'s a different workout for the arm and shoulder.',
      '**Count as you go.** Ask how many leaves, pumpkins or stars are on the page before they start.',
      '**Name the colors** together, then ask for "something red" or "two blue things."',
      '**Talk about the picture.** Ask what is happening and what might happen next.',
    ],
    next: { label: 'Make a name coloring page', path: '/name-coloring-pages/', line: 'Next, try a [name coloring page](/name-coloring-pages/). Your child\'s name comes out in big letters ready to color, and the name never leaves your device.' },
  },
  math: {
    subject: 'Count real things first',
    preview: 'A simple trick that makes math worksheets click.',
    intro: 'Math worksheets go further when the numbers mean something real. A few ideas:',
    tips: [
      '**Count objects before the page.** Spoons, blocks or snack crackers all work.',
      '**Put small things on the ten frame,** one per box, then count the boxes together.',
      '**Say the number out loud** before writing it.',
      '**One page is enough** for a day. Stop while it\'s still fun.',
    ],
    next: { label: 'Print a ten frame page', path: '/math-worksheets/ten-frames/', line: 'Next, try [ten frame printables](/math-worksheets/ten-frames/). They pair nicely with a handful of buttons or cereal.' },
  },
  homeschool: {
    subject: 'A simple rhythm for your homeschool week',
    preview: 'Short days, the same time each day, and a Sunday print.',
    intro: 'A little routine makes homeschool at this age much easier. Here is one that works for a lot of families:',
    tips: [
      '**Print on Sunday.** Have the whole week ready before Monday.',
      '**Same time each day.** Right after breakfast is a common choice.',
      '**Keep it short.** Short sessions often work better than long ones for 3 to 5 year olds.',
      '**Repeat when you need to.** Doing a week twice is completely fine.',
    ],
    next: { label: 'See letter of the week', path: '/letter-of-the-week/', line: 'If you want a lighter add-on, [letter of the week](/letter-of-the-week/) has a page for every letter, with free one-page tracing and bubble letter printables.' },
  },
  program: {
    subject: 'Getting the most out of week 1',
    preview: 'Read the picture book more than once. Here\'s why it helps.',
    intro: 'A few ideas for the free week:',
    tips: [
      '**Read the picture book more than once.** Kids often notice new things in the pictures each time.',
      '**Let them color the pictures.** Every page of the book is ready to color.',
      '**Talk about the theme off the paper.** If they love dinosaurs, count dinosaur toys or look for dinosaur books at the library.',
      '**Follow their lead.** If a page is too easy or too hard, that is useful to know for the weeks ahead.',
    ],
    next: { label: 'Back to your child\'s plan', path: '/program/', line: 'You can see the whole year as a timeline on the [program page](/program/).' },
  },
  general: {
    subject: 'A 5-minute way to use printables',
    preview: 'Short, fun and done before anyone gets tired.',
    intro: 'Printables work best in short bursts. A few ideas:',
    tips: [
      '**Pick one page a day.** That is plenty for most little kids.',
      '**Finger first.** Trace with a finger before a crayon.',
      '**Reuse pages.** A sheet protector and a dry-erase marker turn one page into many.',
      '**Stop while it\'s fun.** Tomorrow is another page.',
    ],
    next: { label: 'Make a name tracing page', path: '/name-tracing/', line: 'A good next page: [name tracing worksheets](/name-tracing/) with your child\'s name.' },
  },
};

export function welcomeDay2(v: Interest): EmailContent {
  const d = D2_TIP[v];
  const blocks: Block[] = [
    { p: 'Hi there,' },
    { p: d.intro },
    { list: d.tips },
    ...(v === 'letters' || v === 'general' ? [{ small: 'Kids develop grip and letter skills at different speeds, and that is normal. If you have concerns, ask your child\'s teacher or pediatrician.' } as Block] : []),
    { p: d.next.line },
    { button: { label: d.next.label, path: d.next.path } },
    ...(v === 'program' ? [] : [{ small: `${PROGRAM_PITCH_SHORT} [Take the placement check](/program/).` } as Block]),
    { sign: true },
  ];
  return render({ subject: d.subject, preview: d.preview, blocks, medium: 'welcome', campaign: 'day2', why: WHY_SIGNUP });
}

function dinosaurWeekBlocks(): Block[] {
  return [
    { p: 'Say your child loves dinosaurs. Here is what their first week of Tracelings at Home, Personalized looks like.' },
    { pictures: DINO_PICTURES },
    { p: 'The heart of the week is a picture book. The same dinosaur friends come back every week (Stomp the little T-rex, Dot the long-neck and Tops the triceratops), and your child is in the story, helping solve the problem. Every page has a big picture that shows what the words say, ready to color.' },
    { p: 'Around the book, the week has:' },
    { list: [
      'Counting pages, ten frames and adding with dinosaur pictures',
      'Word problems about dinosaurs, at their math level',
      'Letters, word families and sight words for their level, with their name on the pages',
      'A short note for you with 2 ideas to try away from the paper',
    ] },
    { p: 'It\'s built around your child, not an age chart. A 5-minute placement check puts them on the Pre-K or kindergarten track, skips what they already know and adds review where a skill is still settling in. Not a dinosaur kid? There are 12 themes, from trucks and unicorns to space, trains and ocean animals.' },
  ];
}

export function welcomeDay5(): EmailContent {
  const blocks: Block[] = [
    { p: 'Hi there,' },
    ...dinosaurWeekBlocks(),
    { p: 'Week 1 is free to print, with no card needed.' },
    { button: { label: 'Build a free week for your child', path: '/program/' } },
    { sign: true },
  ];
  return render({ subject: 'What week 1 looks like for a kid who loves dinosaurs', preview: 'A picture book, counting pages and word problems, all about the thing they love.', blocks, medium: 'welcome', campaign: 'day5', why: WHY_SIGNUP });
}

export function welcomeDay9(): EmailContent {
  const blocks: Block[] = [
    { p: 'Hi there,' },
    { p: 'Did you get a chance to try the free week of Tracelings at Home, Personalized? If not, here are answers to the questions parents ask most.' },
    { h: 'How much time does it take?' },
    { p: 'Most days take about 10 to 30 minutes. You choose how many days a week and how many minutes a day in the placement check, and the plan fits that.' },
    { h: 'What ages is it for?' },
    { p: 'Kids ages 3 to 7, on a Pre-K or kindergarten track. The placement check looks at what your child can do today, not just their age.' },
    { h: 'What if it isn\'t for us?' },
    { p: 'Week 1 is free, so you can see the real thing first. If you join later, you can cancel anytime from your account page in a couple of clicks, with no phone call.' },
    { h: 'Is my child\'s name private?' },
    { p: 'Yes. Your child\'s name stays on your device. It is never sent to our servers or to the tool that writes the stories. Your browser adds it when it makes the PDF.' },
    { button: { label: 'Try the free week', path: '/program/' } },
    { sign: true },
  ];
  return render({ subject: 'Did you try the free week?', preview: 'Time per day, ages, cancelling and privacy: quick answers.', blocks, medium: 'welcome', campaign: 'day9', why: WHY_SIGNUP });
}

function offerBlocks(): Block[] {
  return [
    { p: 'Tracelings at Home, Personalized is **$14.99 a month**, or **$99 a year** (about $8.25 a month). One price covers every kid in your family, up to 4.' },
    { p: 'Each week, for each child:' },
    { list: [
      'A plan at their level and pace, from a short placement check',
      'Printable packs themed on what they love',
      'A new picture book starring your child, with that week\'s letters, word family and sight words',
      'Word problems, a tracing sentence and a note for you',
      'A 1-minute check-in that adjusts the weeks ahead, and a progress report to print',
    ] },
    { p: 'You can cancel anytime from your account page. Not happy in the first 14 days? Email us for a full refund.' },
    { p: FREE_LINE },
  ];
}

export function welcomeDay14(): EmailContent {
  const blocks: Block[] = [
    { p: 'Hi there,' },
    { p: 'It\'s been a couple of weeks since you joined Tracelings, so here is the plain version of what the paid program costs and what you get.' },
    ...offerBlocks(),
    { button: { label: 'See plans and join', path: '/membership/' } },
    { small: 'Haven\'t tried it yet? [Print week 1 free](/program/) first.' },
    { sign: true },
  ];
  return render({ subject: 'A homeschool plan built for your child, for $14.99 a month', preview: 'Or $99 a year. Covers up to 4 kids, cancel anytime.', blocks, medium: 'welcome', campaign: 'day14', why: WHY_SIGNUP });
}

/** Teachers get one welcome email. The program is for families, so we don't pitch it to a classroom. */
export function welcomeTeacher(): EmailContent {
  const blocks: Block[] = [
    { p: 'Hi there,' },
    { p: 'Thanks for using Tracelings. Every free tool on the site stays free, including for your classroom.' },
    { p: 'A few that teachers use most: [name tracing worksheets](/name-tracing/), [sight words by grade](/sight-words/), [kindergarten math worksheets](/math-worksheets/kindergarten/) and [word family worksheets](/word-families/).' },
    { p: 'You may see us mention Tracelings at Home, Personalized. It\'s a homeschool program built for one family, with a plan for each child, so it isn\'t a classroom product. If you have kids of your own at home, week 1 is free on the [program page](/program/).' },
    { button: { label: 'Browse the free printables', path: '/' } },
    { sign: true },
  ];
  return render({ subject: 'Free printables for your classroom', preview: 'Every free tool on Tracelings stays free. Here are the ones teachers use most.', blocks, medium: 'welcome', campaign: 'day0-teacher', why: WHY_SIGNUP });
}

/** Welcome step by index (0 to 4 = days 0, 2, 5, 9, 14). */
export const WELCOME_DAYS = [0, 2, 5, 9, 14] as const;
export function welcomeStep(step: number, v: Interest): EmailContent {
  switch (step) {
    case 0: return welcomeDay0(v);
    case 1: return welcomeDay2(v);
    case 2: return welcomeDay5();
    case 3: return welcomeDay9();
    case 4: return welcomeDay14();
    default: throw new Error('no such welcome step');
  }
}

// ---------- launch broadcasts (existing list) ----------
// Created as drafts only. (a) program intro, (b) 4 days later the picture book plus seasonal pages,
// (c) 4 days after that the direct offer. Families get a, b, c; teachers get only teacher-a.

const WHY_LIST = 'You are getting this because you signed up for emails when you downloaded a free printable on tracelings.com.';

export function launchA(): EmailContent {
  const blocks: Block[] = [
    { p: 'Hi there,' },
    { p: 'You downloaded free printables from Tracelings, so I wanted you to hear this first. We\'ve built something new: **Tracelings at Home, Personalized**, a homeschool program made for one child.' },
    { p: 'Their level, their pace, their interests. If your child loves dinosaurs, they count dinosaurs, read a picture book about dinosaurs and solve dinosaur word problems, while the plan still teaches the letters, word families, sight words and math for their level.' },
    { h: 'How it works' },
    { list: [
      '**A 5-minute placement check.** Tell us what your child can do today, how much time you have and what they love.',
      '**Their plan.** We place them on the Pre-K or kindergarten track, skip what they already know and add review where they need it.',
      '**Week 1 free.** Print the whole first week, themed and with their name. No card needed.',
    ] },
    { p: FREE_LINE },
    { p: 'If you\'ve been printing our free Pre-K or kindergarten weeks, you can keep printing them free through November 30. That works on the device you\'ve been printing from.' },
    { button: { label: 'Get a free week built around your child', path: '/program/' } },
    { sign: true },
  ];
  return render({ subject: 'New from Tracelings: a homeschool week built around your child', preview: 'Week 1 is free, themed on what your child loves.', blocks, medium: 'broadcast', campaign: 'launch-a', why: WHY_LIST });
}

export function launchATeacher(): EmailContent {
  const blocks: Block[] = [
    { p: 'Hi there,' },
    { p: 'A quick note about what\'s new at Tracelings, and what it means for your classroom.' },
    { p: '**The free tools stay free.** Name tracing, letter and number tracing, sight words, word families, the math worksheets and the coloring pages all keep working exactly as they do today.' },
    { p: '**Fresh for this time of year:** [Thanksgiving coloring pages](/coloring-pages/thanksgiving-coloring-pages/) and [Christmas coloring pages](/coloring-pages/christmas-coloring-pages/), plus [kindergarten word problems](/math-worksheets/kindergarten-word-problems/) you can read aloud to the class.' },
    { p: 'We\'ve also launched Tracelings at Home, Personalized. It\'s a homeschool program built for one family, with a plan for each child, so it isn\'t made for a classroom and we won\'t keep emailing you about it. If you have kids of your own at home, week 1 is free on the [program page](/program/).' },
    { button: { label: 'See the Thanksgiving pages', path: '/coloring-pages/thanksgiving-coloring-pages/' } },
    { sign: true },
  ];
  return render({ subject: 'What\'s new at Tracelings for teachers', preview: 'The free tools stay free, plus new seasonal pages for your class.', blocks, medium: 'broadcast', campaign: 'launch-a-teacher', why: WHY_LIST });
}

export function launchB(): EmailContent {
  const blocks: Block[] = [
    { p: 'Hi there,' },
    ...dinosaurWeekBlocks(),
    { p: 'Week 1 is free to print, with no card needed.' },
    { button: { label: 'Build a free week for your child', path: '/program/' } },
    { h: 'Free for the holidays' },
    { p: 'Seasonal pages for the weeks ahead, free as always: [Thanksgiving coloring pages](/coloring-pages/thanksgiving-coloring-pages/) and [Christmas coloring pages](/coloring-pages/christmas-coloring-pages/).' },
    { sign: true },
  ];
  return render({ subject: 'A picture book starring your child (plus free Thanksgiving pages)', preview: 'Here is what week 1 looks like for a kid who loves dinosaurs.', blocks, medium: 'broadcast', campaign: 'launch-b', why: WHY_LIST });
}

export function launchC(): EmailContent {
  const blocks: Block[] = [
    { p: 'Hi there,' },
    { p: 'Over the last week I\'ve told you about Tracelings at Home, Personalized. Here is the plain version of what it costs and what you get.' },
    ...offerBlocks(),
    { button: { label: 'See plans and join', path: '/membership/' } },
    { small: 'Want to see it first? [Print week 1 free](/program/).' },
    { sign: true },
  ];
  return render({ subject: 'Tracelings at Home: $14.99 a month or $99 a year', preview: 'A homeschool plan built for your child. Covers up to 4 kids, cancel anytime.', blocks, medium: 'broadcast', campaign: 'launch-c', why: WHY_LIST });
}

export type LaunchKey = 'launch-a' | 'launch-a-teacher' | 'launch-b' | 'launch-c';
/** Built-in broadcast templates and the segment each one is meant for. */
export const LAUNCH: Record<LaunchKey, { segment: 'prospects' | 'teachers'; build: () => EmailContent; name: string; sendAfterDays: number }> = {
  'launch-a': { segment: 'prospects', build: launchA, name: 'Launch A: program intro (families)', sendAfterDays: 0 },
  'launch-a-teacher': { segment: 'teachers', build: launchATeacher, name: 'Launch A: teacher note', sendAfterDays: 0 },
  'launch-b': { segment: 'prospects', build: launchB, name: 'Launch B: picture book + seasonal (families)', sendAfterDays: 4 },
  'launch-c': { segment: 'prospects', build: launchC, name: 'Launch C: offer (families)', sendAfterDays: 8 },
};

/** Every template by key, for previews, test sends and the Resend template sync. */
export function allTemplates(): Record<string, EmailContent> {
  const out: Record<string, EmailContent> = {};
  const variants: Interest[] = ['letters', 'coloring', 'math', 'homeschool', 'program', 'general'];
  for (const v of variants) {
    out[`welcome-0-${v}`] = welcomeDay0(v);
    out[`welcome-2-${v}`] = welcomeDay2(v);
  }
  out['welcome-5'] = welcomeDay5();
  out['welcome-9'] = welcomeDay9();
  out['welcome-14'] = welcomeDay14();
  out['welcome-teacher'] = welcomeTeacher();
  for (const k of Object.keys(LAUNCH) as LaunchKey[]) out[k] = LAUNCH[k].build();
  return out;
}

/** Swaps Resend's unsubscribe placeholder for a real link (previews and one-off test sends, where Resend doesn't fill it). */
export const withUnsubscribe = (c: EmailContent, url: string): EmailContent => ({
  ...c,
  html: c.html.split(UNSUB).join(esc(url)),
  text: c.text.split(UNSUB).join(url),
});
