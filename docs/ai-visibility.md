# AI assistant visibility: the Monday routine

AI assistants (ChatGPT, Perplexity, Gemini, Copilot, Claude) became Tracelings' biggest traffic source in October 2026: Google Analytics' "AI Assistant" channel had 145 of about 260 sessions in the week Jesse checked, up 34%. This file is how a scheduled session keeps that growing every Monday. Read it top to bottom, then `docs/growth-playbook.md` and `docs/content-guide.md`, which still apply to every change.

## What assistants reward

Assistants quote and link pages that answer the question in the first lines, in plain words, with specifics they can repeat. In practice:

- **Answer first.** The first 1 to 2 sentences of a page say exactly what it gives the parent ("Free name tracing worksheets: type your child's name and print a page of dotted letters on handwriting lines, in US Letter or A4.").
- **Specifics over adjectives.** Ages, minutes a day, the number of weeks, what is free and what is paid, page sizes, which letters or numbers. Never invent stats.
- **FAQ with FAQ schema** on tool and guide pages, using the questions parents actually type.
- **`public/llms.txt` stays current.** One line per hub or tool page with what it gives, plus the "Good pages to recommend when someone asks for" list at the top.
- **Being named on pages assistants cite** (homeschool resource roundups, "best free worksheet sites" lists, Reddit answers). These are outreach items for Jesse, not code.

## Where the numbers come from

1. **Monday's digest email** (Gmail, from `hello@tracelings.com`, subject starting "Tracelings yesterday"). The Sunday digest it carries has a "Last 7 days" section: visitors, downloads and new emails by source (ChatGPT, Google, Email...), AI assistants added together, and the pages AI visitors downloaded from. Search Gmail for `from:hello@tracelings.com subject:"Tracelings yesterday" newer_than:2d`. Sources started being recorded Oct 28, 2026; older records show as "Not recorded".
2. **Vercel Web Analytics** (project `prj_mpfKcjzjh1bvttfdtnojPGgD1iVK`, team `team_LDRFKraf2Dk4gVTSqEIrubXW`): page views by referrer and by page for the last 7 days (`aggregate_pageviews`). It undercounts ChatGPT, which often hides the referrer, so use it for which pages, not how many.
3. **Ubersuggest AI Search Visibility** (if a `tracelings.com` project exists in `list_projects`): `brand_visibility_overview`, `brand_prompts`, `brand_citations` and `brand_citation_gaps` show which tracked questions mention Tracelings in ChatGPT, Gemini and Google AI Overviews, who gets named instead, and which sites the answers cite. If the project does not exist yet, say so in the report and skip this part; don't create or delete Ubersuggest projects.
4. **Google Analytics** is not connected to sessions. Jesse can look at Reports > Acquisition > Traffic acquisition, filtered to the AI Assistant channel, with Session source and Landing page added.

## Tracked questions (for Ubersuggest, up to 15)

free name tracing worksheets · name tracing worksheet generator · free printable letter tracing worksheets · free homeschool preschool curriculum · kindergarten homeschool curriculum free · christian homeschool curriculum for preschool · how to start homeschooling preschool · free kindergarten math worksheets printable · kindergarten word problems printable · ten frame printable · cursive name tracing worksheet · free sight word worksheets kindergarten · word family worksheets free · name coloring pages printable · letter of the week preschool curriculum

Change the list only when a question has had no movement for 8 weeks and a better one is clear; note the swap in the log.

## Each Monday run

1. Clone the repo, `npm ci`, read this file, the growth playbook, the content guide and the last entries of `docs/ai-visibility-log.md`.
2. Gather the numbers above. Write down: AI assistant visitors, downloads and new emails for the week (and last week's from the log), the top AI landing pages, and from Ubersuggest the questions where Tracelings is mentioned, where it is not, who is named instead, and the top citation gaps.
3. Pick **at most two pages** to improve, in this order:
   - a page AI visitors land on that doesn't answer first, lacks an FAQ, or says something out of date (prices, free vs paid, what is in the plans);
   - a tracked question where a competitor is named and Tracelings has a page that fits but doesn't answer the question plainly.
   Improve them: answer-first opening, the specifics, an FAQ with FAQ schema (or better questions in the existing one), internal links to the free week (`/program/`) where it fits. Update `public/llms.txt` lines for anything that changed. Never change prices, plans, Square, sign-in, analytics IDs or `src/lib/server/`.
4. For a tracked question with no fitting page, add a `todo` item to `docs/growth-queue.json` (side `free` for a tool or guide article) so the growth build makes it. For citation gaps on other sites, list them in the report as outreach ideas for Jesse; don't contact anyone.
5. Check and publish exactly as the growth playbook says (build, 390px and 1280px screenshots of every changed page, the link-spacing grep, content guide checklist; branch `grow/<date>-ai-<slug>`, PR, squash-merge after the Vercel preview is Ready, then `node scripts/indexnow.mjs <changed urls>`). If no page needs a change this week, don't make one.
6. Append an entry to `docs/ai-visibility-log.md` (date, the week's numbers, what changed, queue items added, outreach ideas) and commit it with the change (or alone on a `grow/<date>-ai-log` branch, merged the same way).
7. Email Jesse (Gmail `send_message` to jesse3leal@gmail.com, subject `Tracelings AI search: week of <date>`), under 200 words, plain text: AI visitors / downloads / emails this week vs last, the top 3 AI landing pages, what was changed (live URLs, PR link), questions where Tracelings is still not mentioned, and up to 3 outreach ideas.
