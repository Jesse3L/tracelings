import { useEffect, useState } from 'preact/hooks';

export interface MemberState {
  member: boolean;
  available: boolean; // membership checkout is switched on
  email?: string;
  plan?: string | null;
  planLabel?: string;
  maxNames?: number;
  status?: string;
  paidThrough?: string | null;
  cancelsOn?: string | null;
  lapsed?: boolean;
}

let cached: Promise<MemberState> | null = null;

export function fetchMember(force = false): Promise<MemberState> {
  if (!cached || force) {
    cached = fetch('/api/member/me/', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : { member: false, available: false }))
      .catch(() => ({ member: false, available: false }));
  }
  return cached;
}

/** Member status for this visitor; starts as "not a member" until the check returns. */
export function useMember(): MemberState & { loaded: boolean } {
  const [s, setS] = useState<MemberState & { loaded: boolean }>({ member: false, available: false, loaded: false });
  useEffect(() => { fetchMember().then((m) => setS({ ...m, loaded: true })); }, []);
  return s;
}
