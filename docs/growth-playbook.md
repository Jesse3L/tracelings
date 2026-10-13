# Tracelings Growth Playbook

How the every-other-day build sessions grow Tracelings. A scheduled task opens a fresh session, reads this file, does **one build item**, and opens a pull request for Jesse to review and merge.

## The goal

Grow the homeschool programs we will sell later: **Tracelings at Home** (Pre-K and Kindergarten now, then 1st, 2nd and 3rd grade), plus the free tools that feed them. Every run should leave the programs deeper and more useful for parents, and give Google another page worth ranking.

This is **build on what we have**, not "find random new keywords." Keyword data is only used to decide *which* piece of the programs to build next and what to call it.

## Rules that never change

- **Free stays free.** Never move an existing free tool, page or download behind the paywall. Never remove a free feature.
- **Paid is depth and convenience:** multi-child printing, several weeks at once, full-year bundles, AI features, no footer line. New member-only features are fine; taking away free ones is not.
- **Names never leave the device.** Every printable is built in the browser. Never send a child's name to a server, an API, analytics or a URL.
- **Follow `docs/content-guide.md`** for every word on the site: no em dashes, no banned words, no invented stats or quotes, ranges for milestones, the "ask your child's teacher or pediatrician" line where it applies.
- **No thin pages.** A new page needs a working tool or printable plus real, specific help for a parent. Never publish a page that only swaps a keyword.
- **One item per run.** Small and finished beats big and half done. At most 3 new URLs in one run (a template that creates 26 letter pages counts as one item, but needs real content per page).
- **Don't change** pricing, Square checkout, sign-in, the membership plans, analytics IDs, or `src/lib/server/` unless an item says so and Jesse approved it.
- **Never merge or push to `main`.** Work on a branch named `grow/<date>-<slug>` and open a pull request.

## Each run, step by step

1. Clone the repo, `npm ci`, and read this file, `docs/content-guide.md`, `docs/growth-queue.json` and the last few entries of `docs/build-log.md`.
2. If an open pull request from a previous run is still waiting, don't stack new work on top of the same files. Pick a queue item that doesn't touch them, or stop and say so.
3. Pick the **first `todo` item** in `docs/growth-queue.json` whose `needs` are all `done` and that isn't marked `needs-approval`.
4. Check its keywords in Ubersuggest (US). Note volume and SD for the main keyword and 3 to 5 close variants. If the item's main keyword turns out to be near zero, pick a better phrasing that keeps the same build, and note it.
5. Look at what's already there (`src/pages/`, `src/lib/homeschool.ts`, existing tools) and build on it. Reuse the page model in `src/lib/sheet.ts`, `rowSheet.ts` and `homeschool.ts`. Match the look of existing pages.
6. Wire it in: link from the related hub or plan pages, add it to nav or footer only if it's a hub, add previews to `scripts/make-previews.mts` when a page has a printable, update the "Live pages" list in `docs/content-guide.md`.
7. Check your work: `npm run build` must pass. Render a sample of every new printable to PNG and look at it. Read every new paragraph against the content guide checklist.
8. Update `docs/growth-queue.json` (status `done`, date, final URLs, keyword numbers) and add 1 to 3 new `todo` items you discovered that build on this one. Append an entry to `docs/build-log.md`.
9. Commit, push the branch and open a pull request titled `Grow: <what was built>`. The description says what was built, the keyword numbers, which URLs are new, and anything Jesse should decide.
10. Send Jesse a short summary: what was built, the PR link, and what's next in the queue.

## How to choose new queue items

Good items grow a program in one of these ways:

- **Fill a gap in a plan.** A week that would be better with a page type we don't have yet (for example a beginning-sounds picture page, a CVC word builder, a shapes page).
- **A free tool the plans already use**, given its own page (for example a ten frame generator, an addition worksheet maker, a word family page).
- **The next grade.** First grade plan, then second, then third, each with its own 36 weeks.
- **A parent guide** that answers a real question about using the plans, with 2 to 4 tool links.
- **Member value** that makes paying worth it without taking anything away from free users.

Prefer items where the main keyword has real volume and SD under about 35. Mark anything that changes pricing, adds AI, adds a faith-based track, or touches payments as `needs-approval`.
