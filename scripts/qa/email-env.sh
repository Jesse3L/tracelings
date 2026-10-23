#!/bin/bash
# Prints the env for email QA (Resend mock, admin token, owner address, webhook stand-in). Used as QA_EXTRA_ENV.
echo "RESEND_API_KEY=re_qa_mock_key RESEND_BASE_URL=http://127.0.0.1:${RESEND_PORT:-4112} EMAIL_ADMIN_TOKEN=${EMAIL_ADMIN_TOKEN_QA:-qa-admin-token-0123456789abcdef0123456789} OWNER_EMAIL=owner@example.com NOTIFY_WEBHOOK_URL=http://127.0.0.1:${RESEND_PORT:-4112}/__notify"
