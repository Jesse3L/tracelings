# Tracelings Content Guide

House style for every article in `src/content/articles/`. The topic queue lives in `src/data/blog-backlog.json`. Pick the next `todo` item whose `publishAfter` date has arrived, write it to this guide, then set its status to `done`.

## Who we write for

- **Parents of 3 to 7 year olds** who want to help at home and don't have a teaching background.
- **Preschool and kindergarten teachers** who need ideas they can use with a whole class tomorrow.
- **Homeschool parents** who are planning a week, a term, or a year.

All three are busy and are often reading on a phone. They want a clear answer and something they can do today. We write for the adult. **Never address the child** ("Hey kids!", "Can you find the letter B?"). Talk to the grown-up about the child.

## Voice

- **Natural and warm.** Sound like a friend who has taught a lot of four year olds. Don't sound like a brochure.
- **Specific.** "Tape the paper to the wall so they draw standing up" beats "try different surfaces." Name the materials, the time, the number of lines.
- **Short sentences.** Most sentences should be under 20 words. Keep paragraphs to 1 to 4 sentences.
- **Plain words.** Say "hand strength," not "intrinsic hand musculature." When a technical term helps search (tripod grasp, pincer grasp), define it in one sentence the first time you use it.
- **Calm and reassuring.** Kids develop at different speeds. Never shame a child or a parent, and never create worry to sell a worksheet.
- **No em dashes.** Use a period, a comma, a colon, or parentheses. (En dashes in number ranges are also out. Write "ages 4 to 5.")

### Banned words and phrases

Do not use any of these, in any form:

- unlock
- seamless / seamlessly
- elevate
- dive in / dive into / deep dive
- whether you're
- in today's world
- game-changer / game changer
- it's important to note

Also avoid filler like "look no further," "in this article we will," "without further ado," "navigate," "journey" (for learning), and "the ultimate guide."

## Developmental claims

Get this right. Parents act on it.

- **Use ranges, not deadlines.** "Many kids do this somewhere between 4 and 5" and not "By age 4 your child should."
- **Use soft verbs:** many, often, usually, typically, some kids. Avoid "all," "always," "must," and "should be able to."
- **Say that variation is normal,** and include the referral line wherever an article touches on milestones, grip, reversals, or readiness: *"If you have concerns, ask your child's teacher or pediatrician."* For grip and motor topics, you may also mention an occupational therapist.
- **Never diagnose.** Don't link a behavior (reversals, an awkward grip, left-handedness) to a condition. You can say "reversals are common in early writers" and then point to a professional.
- **Never advise switching a left-handed child** to the right hand.

## Facts, sources, and honesty

- **No invented statistics, studies, surveys, or percentages.** If you can't point to a real, checkable source, leave the number out.
- **No invented quotes.** Don't quote "experts," teachers, OTs, or parents unless the founder supplies a real quote with permission.
- **No fake personal anecdotes.** Don't write "When my daughter was 4..." or "In my classroom..." Write in a general, practical voice instead. The founder may add a real experience note during review.
- **Public-domain lists are fine** (Dolch, Fry). Name the list you are drawing from.
- **Rules that vary by place** (cursive laws, kindergarten screenings, state standards) must be described as varying. Tell the reader how to check for their own school or state. Don't assert a count of states unless it is sourced and dated.
- If you're unsure about a claim, cut it or flag it for the founder with `<!-- CHECK: ... -->`.

## Length and structure

- **900 to 1,400 words.**
- **Open with a direct answer in 2 to 3 sentences**, before any heading. Someone who reads only that paragraph should get the answer. Then add one or two short sentences that set up the rest of the article.
- **H2s only** (`##`). No H3s or deeper. Make each H2 a plain statement or a question a parent would actually search ("Capital letter first, then lowercase", "When should letter reversals stop?").
- Use bullets for lists of activities, materials, or signs. Keep each bullet to a line or two.
- **Bold** only short labels inside lists or routine steps. Don't bold random phrases in body text.
- **End with a concrete routine or activity section**, for example "A simple 10-minute routine" or "Try this tomorrow morning." Give numbered steps with times or amounts. **Never end with a generic recap** ("In conclusion...", "Remember, every child is different...").

## Internal links to our tools

Every article links to **2 to 4 Tracelings tools**, placed naturally where the reader needs them. Start with the `linkTo` list in the backlog item.

| Tool | Path | Status |
|---|---|---|
| Name tracing | `/name-tracing/` | live |
| Letter tracing (all) | `/letter-tracing/` | live |
| Single letter | `/letter-tracing/a/` ... `/letter-tracing/z/` | live |
| Number tracing (all) | `/number-tracing/` | live |
| Single number | `/number-tracing/0/` ... `/number-tracing/9/` | live |
| Membership waitlist | `/membership/` | live |
| Cursive | `/cursive/` | coming |
| Name coloring pages | `/name-coloring-pages/` | coming |
| Coloring pages | `/coloring-pages/` | coming |

- **Use descriptive anchor text** that includes a keyword: "a [free name tracing worksheet](/name-tracing/)" or "[letter B tracing page](/letter-tracing/b/)." Never use "click here."
- **Link where the tool solves the problem being discussed,** not in a block at the end.
- Link a **single letter or number page** when the article is about that character (b/d reversals → `/letter-tracing/b/` and `/letter-tracing/d/`).
- **Check that "coming" tools are live before you publish.** If one isn't live yet, swap in the closest live tool and add `<!-- TODO: link /cursive/ when live -->`.
- Mention `/membership/` at most once, and only where it fits (planning and schedule articles). It is never the main link.
- Linking to other articles under `/learn/` is welcome, but it doesn't count toward the 2 to 4 tool links.

## Keywords

- Use the `primaryKeyword` in the `title`, in the `description`, in the opening answer (naturally, close to word for word), and in at least one H2 where it reads well.
- Work in close variants and related terms through the body ("pencil grasp," "how to hold a pencil," "grip"). Write for the reader first. Never stuff.

## Frontmatter

Use exactly these fields, in this order, matching the existing articles and `src/content.config.ts`:

```yaml
---
title: "Tripod Grasp: What It Is and How to Encourage It"
seoTitle: "Tripod Grasp: What It Is and How to Help | Tracelings"
description: "What a tripod grasp is, when many kids develop it, and simple ways to encourage it at home with short crayons, play and tracing."
primaryKeyword: "tripod grasp"
published: 2026-10-20
readingMinutes: 6
---
```

- `title`: the on-page H1. Use sentence case, include the primary keyword, and keep it under about 70 characters.
- `seoTitle`: 60 characters or fewer, ending with ` | Tracelings`.
- `description`: 140 to 160 characters, contains the keyword, and states the payoff.
- `primaryKeyword`: lowercase, exactly as in the backlog item.
- `published`: the actual publish date (`YYYY-MM-DD`), on or after `publishAfter`.
- `readingMinutes`: the word count divided by about 220, rounded (usually 5 to 7).
- `updated` (optional): add it only when you revise a published article.

The filename is the slug: lowercase, hyphenated, and usually the primary keyword (`tripod-grasp.md`).

## Seasonal articles

- Seasonal items are scheduled 6 to 8 weeks before the season, so they have time to get indexed and pinned. Don't push them later than their `publishAfter` date.
- Keep them neutral and inclusive. Don't use licensed characters or brand art (refer to "rhyming books," not character names in images).
- Use an evergreen slug with no year (`christmas-activities-for-preschoolers`, not `...-2026`). Update the same URL each year.

## Before you publish: checklist

- [ ] 900 to 1,400 words. The opening is a 2 to 3 sentence direct answer.
- [ ] H2s only. The final section is a concrete routine or activity, not a recap.
- [ ] 2 to 4 tool links with descriptive anchors, all live (or swapped and flagged).
- [ ] No em dashes. Nothing from the banned list.
- [ ] No invented stats, studies, quotes, or personal stories.
- [ ] Milestones are given as ranges, with the "ask your child's teacher or pediatrician" line where relevant.
- [ ] Nothing speaks to the child directly.
- [ ] Frontmatter fields exactly as above. `seoTitle` is 60 characters or fewer.
- [ ] The backlog item's `status` is set to `done`.
