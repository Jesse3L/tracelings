// Where a visit came from ("ChatGPT", "Google", "Email"...), for the owner's daily digest. Shared by the browser
// and the server. Only a label from the fixed list below is ever sent or saved: never the referring URL, a search
// query or anything typed. The browser works it out once per visit (tab session) from the landing page's
// utm_source and document.referrer, and keeps it in sessionStorage so later pages in the same visit keep the label.

export const VISIT_SOURCES = [
  'ChatGPT', 'Perplexity', 'Gemini', 'Copilot', 'Claude', 'Other AI assistant',
  'Google', 'Bing', 'DuckDuckGo', 'Yahoo', 'Other search',
  'Pinterest', 'Facebook', 'Instagram', 'Reddit', 'YouTube', 'Other social',
  'Email', 'Other site', 'Direct',
] as const;
export type VisitSource = (typeof VISIT_SOURCES)[number];
const SOURCE_SET = new Set<string>(VISIT_SOURCES);

/** Sources that are AI assistants (the digest counts these together). */
export const AI_SOURCES: readonly VisitSource[] = ['ChatGPT', 'Perplexity', 'Gemini', 'Copilot', 'Claude', 'Other AI assistant'];

export const cleanSource = (v: unknown): VisitSource | null => (typeof v === 'string' && SOURCE_SET.has(v) ? (v as VisitSource) : null);

// [pattern, label]. Matched against the utm_source value and the referrer's host name, in order.
const RULES: [RegExp, VisitSource][] = [
  [/(^|\.)chatgpt\.com$|(^|\.)openai\.com$|^chatgpt/, 'ChatGPT'],
  [/perplexity/, 'Perplexity'],
  [/(^|\.)gemini\.google\.com$|^gemini|bard\.google/, 'Gemini'],
  [/copilot/, 'Copilot'],
  [/(^|\.)claude\.ai$|^claude/, 'Claude'],
  [/(^|\.)(you\.com|phind\.com|meta\.ai|grok\.com|x\.ai|deepseek\.com|chat\.mistral\.ai|poe\.com)$/, 'Other AI assistant'],
  [/^(email|newsletter|resend)$|^(mail\.google\.com|outlook\.live\.com|outlook\.office\.com|outlook\.office365\.com|mail\.yahoo\.com|mail\.aol\.com|webmail\..+)$/, 'Email'],
  [/(^|\.)google\.[a-z.]+$|^google$/, 'Google'],
  [/(^|\.)bing\.com$|^bing$/, 'Bing'],
  [/duckduckgo/, 'DuckDuckGo'],
  [/(^|\.)yahoo\.[a-z.]+$|^yahoo$/, 'Yahoo'],
  [/(^|\.)(ecosia\.org|brave\.com|search\.brave\.com|startpage\.com|yandex\.[a-z.]+|baidu\.com|qwant\.com)$/, 'Other search'],
  [/pinterest|^pin\.it$/, 'Pinterest'],
  [/facebook|^fb$|(^|\.)fb\.com$|messenger/, 'Facebook'],
  [/instagram/, 'Instagram'],
  [/reddit/, 'Reddit'],
  [/youtube|(^|\.)youtu\.be$/, 'YouTube'],
  [/(^|\.)(t\.co|x\.com|twitter\.com|linkedin\.com|lnkd\.in|tiktok\.com|threads\.net|nextdoor\.com)$/, 'Other social'],
];

/** Works out the label from a utm_source value and the referrer URL. `ownHost` is our own site (no label). */
export function classifySource(utm: string | null | undefined, referrer: string | null | undefined, ownHost = 'tracelings.com'): VisitSource | null {
  const u = (utm ?? '').trim().toLowerCase().slice(0, 60);
  if (u) for (const [re, label] of RULES) if (re.test(u)) return label;
  let host = '';
  try { host = referrer ? new URL(referrer).hostname.toLowerCase().replace(/^www\./, '') : ''; } catch { host = ''; }
  if (host && (host === ownHost || host.endsWith(`.${ownHost}`) || host.endsWith('.vercel.app') || host === 'localhost')) return null; // a page of our own
  if (host) {
    for (const [re, label] of RULES) if (re.test(host)) return label;
    return 'Other site';
  }
  if (u) return 'Other site';
  return 'Direct';
}

const KEY = 'tl-src';

/** Browser only: this visit's source, worked out on the first page of the visit and remembered for the tab. */
export function visitSource(): VisitSource | null {
  try {
    const have = cleanSource(sessionStorage.getItem(KEY));
    if (have) return have;
  } catch { /* storage unavailable */ }
  try {
    const found = classifySource(new URLSearchParams(location.search).get('utm_source'), document.referrer, location.hostname.replace(/^www\./, '')) ?? 'Direct';
    try { sessionStorage.setItem(KEY, found); } catch { /* storage unavailable */ }
    return found;
  } catch { return null; }
}
