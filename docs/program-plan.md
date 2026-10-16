# Tracelings at Home, Personalized: product and build plan

Decided with Jesse on 2026-10-16. This replaces the old membership (Family, Classroom, Founding), which gave a one-kid family nothing they couldn't already get free. Nobody bought the founding plan.

## The offer

**A homeschool program built for one child: their level, their pace, their interests.** If a kid loves dinosaurs, they count dinosaurs, read a short story about a dinosaur, and solve dinosaur word problems, while the plan still teaches the letters, word families, sight words and math for their level.

- **Price:** $14.99/month or $99/year. Covers every kid in one family (up to 4 child profiles).
- **Free first week, no free trial.** A trial would let people download a whole year in 7 days. The free week is week 1 of their own personalized plan, fully themed and with their child's name, so they see exactly what they'd be paying for.
- **Coffee tips stay** for free users.
- **Free stays free.** Every existing free tool, the two free 36-week plans and their weekly packs keep working exactly as they do today. The paid program is the personalized layer on top.

## How it works for a parent

1. **Placement check (free, about 5 minutes)** at `/program/`.
   - The parent answers: age, what the child can do today (names letters, knows letter sounds, writes their name, counts to 10 or 20, adds small numbers, reads simple words), days per week and minutes per day, faith track yes or no, and up to 3 interests from a picture grid (dinosaurs, trucks and cars, unicorns, ocean animals, space, farm animals, bugs, princesses and castles, trains, sports, pets, jungle animals).
   - An optional printable "show me" page lets the child demonstrate letters and numbers; the parent ticks what they got right.
2. **Their plan.** The rules engine places the child on the Pre-K or Kindergarten track, at the right starting week, skipping skills the child already has and repeating ones they're shaky on. The parent sees the whole year as a timeline (what's coming each week) but can only print week 1 until they pay.
3. **Free week 1 pack**: plan page plus Monday to Friday pages, themed to the child's interests, with their name. Email required (same gate as today).
4. **Paid**: every week of the plan, ready each Monday, with:
   - **Themed printables**: counting pages, ten frames, addition and more or less with the child's interest pictures; word family and letter pages with themed words and pictures where they fit.
   - **AI pieces made fresh for that child each week** (this is what makes it feel personal):
     - a short story at the child's reading level, starring the child, about their interest, using that week's letters, word family and sight words, printable as a little book;
     - 4 to 6 themed word problems at the week's math level;
     - a tracing sentence about their interest;
     - a parent note: what this week teaches, why, and 2 off-paper activity ideas tied to the interest.
   - **1 minute weekly check-in**: per skill, "got it" or "still working". The next weeks adjust (extra review week, or skip ahead).
   - **Progress report** to print (useful for homeschool records).
   - Batch printing, no footer line, no email prompts (the old member perks).

## Rules that make it safe and affordable

- **Names never leave the device.** The child's name is never stored on the server or sent to the AI. The AI writes with the placeholder `{{name}}`; the browser swaps in the real name when it builds the PDF. Server profiles store only a nickname-free profile: level, skills, interests, pace, faith toggle.
- **AI runs only for signed-in paying members**, never for free visitors or bots.
  - One generation per child per week, cached; at most 2 "make a new story" redos per child per week.
  - Hard monthly spend guard: stop generating (fall back to templates) if the month's AI calls pass a set count.
  - Model: the cheapest current Claude model that writes well for kids (Haiku tier), structured JSON output, validated in code. Numbers in word problems are chosen and checked by code, not by the AI. Stories are checked for length, banned words, and that the week's words appear.
  - If the AI is down or the key is missing, the week still prints using themed templates. Nothing breaks.
- **Free week 1 uses no AI at runtime.** Its themed story and word problems come from pre-written templates per interest, so a bot hitting the placement check costs nothing.
- Faith track keeps using the Berean Standard Bible only.
- Content guide rules apply to every template and to the AI's instructions.

## What gets built (one project, done in parts)

**Part A: program content and plan engine** (no server, no payments)
- `src/lib/program/`: the placement scoring and rules engine (profile in, ordered list of weeks out, with skips and review weeks), check-in adjustment, and theme data.
- Theme art: a small set of simple, original, black-and-white line icons per interest (8 to 10 per theme), made with the same image pipeline as the coloring pages and processed to crisp print PNGs or traced to SVG.
- Themed page types built on the existing page model (`homeschool.ts`, `mathSheets.ts`, `wordFamilies.ts`): themed counting, ten frames, addition, more or less, word family and letter pages, a little-book story page, word problems page, parent note on the plan page.
- Template content for free week 1 per interest and level (story, word problems, tracing sentence, parent note).
- `/program/` landing page with the placement check, plan timeline and free week 1 download.

**Part B: paid program, accounts and AI**
- Square: two new plans, `program-monthly` (1499, MONTHLY) and `program-annual` (9900, ANNUAL). Old plans stop being sold; any existing subscriber on an old plan keeps full access to the new program.
- `/membership/` rewritten as the program sales page; old plan table and Class Pack copy retired (Class Pack page stays reachable for anyone with an old classroom plan).
- Member storage (Vercel Blob, private): per family, keyed by a hash of the member email: child profiles (no names), check-ins, cached weekly AI content, usage counters.
- API: save and load profiles and check-ins, `POST /api/program/week` to get or generate a child's week (member only, cached, capped).
- `/account/` becomes the program dashboard: kids, this week's pack, check-in, plan timeline, progress report.
- Needs from Jesse: an `ANTHROPIC_API_KEY` for Tracelings in Vercel (a separate key from Speechfolk, with a monthly spend limit set in the Anthropic console), and a real checkout test once live.

## After launch

- Watch: placement checks started and finished, free week 1 downloads, checkouts started, paid.
- The every-other-day growth builds keep going and now also feed the program (1st grade plan next, so kids past kindergarten have somewhere to go).
