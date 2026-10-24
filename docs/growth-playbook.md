# Tracelings Growth Playbook

How the every-other-day build sessions grow Tracelings. A scheduled task opens a fresh session, reads this file, does **one build item**, checks that it renders correctly, and publishes it to the live site (pull request, then merge). Jesse gets a summary afterward.

## The goal

Grow **Tracelings at Home, Personalized**, the paid homeschool program (Pre-K and Kindergarten now, then 1st, 2nd and 3rd grade), plus the free one-page tools and parent guides that bring families to it. Every run should leave the program deeper for members, or give Google another free page worth ranking that points parents to the free week.

### Free side and paid side (Jesse, Oct 24, 2026)

- **Free side: single one-page printable tools and parent guide articles.** Name tracing, letters, numbers, cursive, math worksheet makers (one page at a time), coloring, word family sheets (one page at a time), sight words, bubble letters, the alphabet chart. Guide articles target questions like "how to start homeschooling", and each one links to the free week (`/program/` placement check or week 1 on the plan pages).
- **Paid side: depth in the program.** Every homeschool sequence, plan or program is member work: the 36-week Pre-K and Kindergarten plans, the faith track, weekly packs, letter of the week packs, more weeks, the 1st grade plan, more themes and stories. Week 1 of each plan stays free as the taste.
- **No new free multi-week packs or multi-page sets.** A new page type for the weekly packs is program (members) work. A one-page version of it can also be a free tool.
- The plan pages (`/homeschool/...`, `/letter-of-the-week/...`) stay indexable guides: the outline and explanations are readable by anyone; only the downloads are locked.

This is **build on what we have**, not "find random new keywords." Keyword data is only used to decide *which* piece of the programs to build next and what to call it.

## Rules that never change

- **One-page tools stay free.** Never move an existing free one-page tool behind the paywall and never remove a free feature from one. (The homeschool plans moved into the membership on Oct 24, 2026, by Jesse's decision. That was a one-time owner call, not something a growth run does.)
- **Paid is depth and convenience:** more weeks, more plans, themes and stories, multi-child printing, several weeks at once, full-year bundles, no footer line. New member-only features are fine; taking away free one-page tools is not.
- **Names never leave the device.** Every printable is built in the browser. Never send a child's name to a server, an API, analytics or a URL.
- **Follow `docs/content-guide.md`** for every word on the site: no em dashes, no banned words, no invented stats or quotes, ranges for milestones, the "ask your child's teacher or pediatrician" line where it applies.
- **No thin pages.** A new page needs a working tool or printable plus real, specific help for a parent. Never publish a page that only swaps a keyword. A guide article counts when it gives a parent a real answer and links 2 to 4 tools plus the free week.
- **One item per run.** Small and finished beats big and half done. At most 3 new URLs in one run (a template that creates 26 letter pages counts as one item, but needs real content per page).
- **Don't change** pricing, Square checkout, sign-in, the membership plans, analytics IDs, or `src/lib/server/` unless an item says so and Jesse approved it.
- **No AI features for now.** Jesse put AI on hold (Oct 13, 2026): no AI APIs and no server endpoints that cost money per request, because bots could run up the bill. Don't queue new AI items; `reading-stories` stays `on-hold` until he says otherwise.
- **Bible verses use the Berean Standard Bible only** (public domain, easy modern English, official text at bereanbible.com). Never NIV, ESV, NLT or other copyrighted translations. Check every verse word for word against the official text.
- **Publish when it checks out (Jesse, Oct 15, 2026).** Work on a branch named `grow/<date>-<slug>`, open a pull request, and once every check below passes, squash-merge it into `main` yourself so the page goes live and starts ranking. Never push commits straight to `main`, never force-push, and never merge anything that touches a `needs-approval` area (pricing, Square, sign-in, membership plans, analytics IDs, `src/lib/server/`, AI, payments). Those PRs stay open for Jesse.
- **Rendering must be right before you merge.** Jesse's one ask: nothing ships with text that overlaps, runs off the page, or looks wrong. See step 7.

## Each run, step by step

1. Clone the repo, `npm ci`, and read this file, `docs/content-guide.md`, `docs/growth-queue.json` and the last few entries of `docs/build-log.md`.
2. If an open pull request from a previous run is still waiting, don't stack new work on top of the same files. Pick a queue item that doesn't touch them, or stop and say so.
3. Pick the **first `todo` item** in `docs/growth-queue.json` whose `needs` are all `done` and that isn't marked `needs-approval`.
4. Check its keywords in Ubersuggest (US). Note volume and SD for the main keyword and 3 to 5 close variants. If the item's main keyword turns out to be near zero, pick a better phrasing that keeps the same build, and note it.
5. Look at what's already there (`src/pages/`, `src/lib/homeschool.ts`, existing tools) and build on it. Reuse the page model in `src/lib/sheet.ts`, `rowSheet.ts` and `homeschool.ts`. Match the look of existing pages.
6. Wire it in: link from the related hub or plan pages, add it to nav or footer only if it's a hub, add previews to `scripts/make-previews.mts` when a page has a printable, update the "Live pages" list in `docs/content-guide.md`. When the item adds a new hub or tool page, add one line for it to `public/llms.txt` (the plain-text site guide that ChatGPT, Claude and other AI assistants read). Open every new page with a 1 to 2 sentence plain answer of what it gives the parent, and give it an FAQ section with FAQ schema; assistants quote and link pages that answer the question directly. After the production deploy, run `node scripts/indexnow.mjs <new urls>` so Bing (which feeds ChatGPT search and Copilot) picks them up the same day.
7. Check your work before merging:
   - `npm run build` must pass.
   - Render every new printable type (US Letter and A4, with a long name) to PNG and look at it: no text over lines or shapes, nothing clipped at the edges, numbers and labels where they belong.
   - Screenshot every new or changed page at phone width (390px) and desktop width (1280px) from the built site, full page, and look at it: no horizontal scroll, no overlapping text, headings and buttons readable.
   - Scan the built HTML for missing spaces around links (`grep -roE '[A-Za-z,.:]<a href|</a>[A-Za-z]' dist/client --include=index.html` must print nothing). Astro drops the space when a line ends in a word and the next line starts with `<a`, so keep the word that comes before a link on the link's line.
   - Read every new paragraph against the content guide checklist.
   If anything fails, fix it and check again. If you can't fix it, leave the PR open and tell Jesse what is wrong.
8. Update `docs/growth-queue.json` (status `done`, date, final URLs, keyword numbers) and add 1 to 3 new `todo` items you discovered that build on this one. Append an entry to `docs/build-log.md`.
9. Commit, push the branch and open a pull request titled `Grow: <what was built>`. The description says what was built, the keyword numbers, which URLs are new, and the checks you ran.
10. Wait for the Vercel preview on the PR to be Ready, then squash-merge the PR into `main` (unless it touches a needs-approval area). After the production deployment is Ready, open the new URL on tracelings.com and confirm it loads.
11. Send Jesse a short summary: what was built and why, the live URL, the PR link, and what's next in the queue.

## How to choose new queue items

Every item is labeled `"side": "free"` or `"side": "program"` in the queue. Good items do one of these:

- **Free: a one-page tool** the plans already use, given its own page (for example a ten frame generator, an addition worksheet maker, a word family page). One page at a time for everyone; members get batch printing.
- **Free: a parent guide article** that answers a real search ("how to homeschool preschool", "homeschool kindergarten schedule") with 2 to 4 tool links and a link to the free week.
- **Program (members): fill a gap in a plan.** A page type added to the weekly packs (for example a beginning-sounds picture page, a CVC word builder, a shapes page). Week 1 stays free; the rest is for members.
- **Program (members): the next grade.** First grade plan, then second, then third, each with its own 36 weeks.
- **Program (members): more themes and stories** for the personalized weeks.

Never queue a free multi-week pack, a free bundle of several pages, or anything that makes weeks 2 to 36 printable without the membership.

Prefer items where the main keyword has real volume and SD under about 35. Mark anything that changes pricing, adds AI, adds a faith-based track, or touches payments as `needs-approval`.
