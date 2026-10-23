# Email (Resend)

How Tracelings email works, for future sessions.

- **Provider:** Resend. Sends from `hello@tracelings.com` (tracelings.com is verified in Resend). Plan: free marketing tier (1,000 contacts, 3 segments; Resend's own "General" segment uses one).
- **Segments:** `prospects` (families, not members, get launch and sales emails) and `teachers` (honest classroom note only). Members are marked with the `member` contact property; the welcome series stops at the next step for members and for anyone who unsubscribes.
- **Sign-ups:** `/api/subscribe/` sends to Zapier (alerts) and Resend (contact + welcome trigger). Never blocks a download.
- **Welcome series:** Resend Automations, one per interest (letters, coloring, math, homeschool, program, general, teacher), days 0, 2, 5, 9, 14. Created switched off; turned on with the admin action `automations-enable` after Jesse approves.
- **Templates:** `src/lib/email/templates.ts`. `setup` pushes and publishes them to Resend. Preview with `npx tsx scripts/email-preview.mts <dir>`.
- **Launch broadcasts** for the imported Oct 2026 list: drafts `launch-a`, `launch-a-teacher`, `launch-b`, `launch-c`. Sent only with `broadcast-send` and `confirm: "SEND"`.
- **Admin API:** `POST https://tracelings.com/api/admin/email/` with `Authorization: Bearer $EMAIL_ADMIN_TOKEN`. Actions: domain-status, domain-verify, setup, automations-enable/disable, import, broadcast-create, broadcast-send, test-send (only to OWNER_EMAIL), templates, stats, inbound-webhook.
- **Replies to hello@tracelings.com:** Resend receiving (enabled on the domain in the Resend dashboard) calls `/api/email/inbound/` (signed with RESEND_WEBHOOK_SECRET), which forwards to OWNER_EMAIL with Reply-To set to the sender.
- **Env (production):** RESEND_API_KEY (full access), EMAIL_ADMIN_TOKEN, OWNER_EMAIL, RESEND_WEBHOOK_SECRET.
- **Footer (CAN-SPAM):** Tracelings, 17350 State Hwy 249, Ste 220 #35878, Houston, TX 77064, US, plus Resend's one-click unsubscribe.
- **Tests:** `scripts/test-email.mts`, `scripts/test-inbound.mts`, `scripts/qa/email_api.py` (mock Resend, see scripts/qa/README.md).
