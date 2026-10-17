# QA harness for the personalized program

Mock Square (payment links, orders, customers, subscriptions, cards) and Anthropic servers, plus API and browser checks.
Needs Python 3 with Playwright (`pip install playwright && playwright install chromium`).

```
bash scripts/qa/up.sh                                   # mocks + astro dev on 4421 (QA_PORT, SQ_PORT, AI_PORT, QA_OUT, REPO)
python3 scripts/qa/fixes.py scripts/qa                  # C1 C2 M2 M3 M9 over the API
python3 scripts/qa/ui_fixes.py 1280                     # N4 N5 N6 M2 M7 M8 in the browser (also 390)
QA_EXTRA_ENV=PROGRAM_STORE_DOWN=1 bash scripts/qa/up.sh # storage down, then: python3 scripts/qa/ui_fixes.py 1280 m1
python3 scripts/qa/api_tests.py scripts/qa out.txt      # broad API checks
python3 scripts/qa/free_flow.py                         # free placement flow, 390 and 1280
python3 scripts/qa/member_flow.py 1280 new1280@example.com 4321  # new buyer: pays the mock order, then the welcome page signs in
python3 scripts/qa/member_flow.py 390 new390@example.com 4321
python3 scripts/qa/names_params.py                      # name edge cases and ?return probes (signs in as member2 itself)
python3 scripts/qa/integration.py scripts/qa            # 27-week plan, story paths, caps, cached weeks after edits
npx tsx scripts/qa/probe-plans.mts                      # print a few placement plans
bash scripts/qa/down.sh
```

Vite won't serve a symlinked `node_modules` from outside the project, so run the dev server from a checkout with a real
`node_modules` (set `REPO`). Only one Astro dev server can run per project folder. The session cookie is `Secure`, so
browser scripts call the API through a page, not Playwright's request context.

Mock test hook: `POST http://127.0.0.1:$SQ_PORT/__pay/<orderId|latest>` with `{"email","last4"}` pays a checkout like a
buyer would (creates the customer, card and subscription and completes the order).
