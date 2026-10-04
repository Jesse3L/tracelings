import { useEffect, useState } from 'preact/hooks';

// A member's class list, saved only in this browser (localStorage). It never goes to our servers.
const KEY = 'tl-roster';
const EVT = 'tl-roster-change';
export const NAME_MAX = 24;

const HEADER = /^(first\s*name|first|name|names|student|students|student\s*name|child|child'?s?\s*name|kid|kids)$/i;

/** Turns pasted text or a CSV/TXT file into a list of names. One per line, or a single comma-separated line. Takes the first column of a spreadsheet. */
export function parseRoster(text: string): string[] {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.trim()).filter(Boolean);
  let cells: string[];
  if (lines.length === 1 && !/\t/.test(lines[0])) cells = lines[0].split(/[,;]/);
  else cells = lines.map((l) => l.split(/\t|,(?=(?:[^"]*"[^"]*")*[^"]*$)/)[0]);
  const out: string[] = [];
  cells.forEach((c, i) => {
    const name = c.replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
    if (!name) return;
    if (i === 0 && HEADER.test(name)) return;
    out.push(name);
  });
  return out;
}

export function loadRoster(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 60) : [];
  } catch {
    return [];
  }
}

export function saveRoster(names: string[]) {
  try {
    if (names.length) localStorage.setItem(KEY, JSON.stringify(names.slice(0, 60)));
    else localStorage.removeItem(KEY);
  } catch { /* storage unavailable: list still works for this visit */ }
  memory = names;
  window.dispatchEvent(new Event(EVT));
}

let memory: string[] | null = null;

/** The saved class list, kept in sync across every tool on the page. */
export function useRoster(): [string[], (names: string[]) => void] {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    const read = () => { const stored = loadRoster(); setNames(stored.length || !memory ? stored : memory); };
    read();
    window.addEventListener(EVT, read);
    window.addEventListener('storage', read);
    return () => { window.removeEventListener(EVT, read); window.removeEventListener('storage', read); };
  }, []);
  return [names, saveRoster];
}
