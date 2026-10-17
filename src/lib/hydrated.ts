import { useEffect, useState } from 'preact/hooks';

/** False in the server-rendered HTML and until the island has hydrated, then true. Download buttons stay disabled
 *  (and say "Loading…") until then, so a click before the script runs is never lost or turned into a page reload. */
export function useHydrated(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  return ready;
}
