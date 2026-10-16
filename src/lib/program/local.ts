// TEMP stand-in for Part A's local.ts so Part B builds on its own branch. Delete when Part A lands.
import type { ChildProfile } from './types';

const KEY = 'tl-program';
export interface LocalProgram { children: ChildProfile[]; names: Record<string, string> }

export function loadLocalProgram(): LocalProgram {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw && Array.isArray(raw.children)) return { children: raw.children, names: raw.names ?? {} };
  } catch { /* storage unavailable */ }
  return { children: [], names: {} };
}

export function saveLocalProgram(p: LocalProgram) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage unavailable */ }
}
