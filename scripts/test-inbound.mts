// Tests the hello@ forwarding: webhook signature check and the forward request, against a tiny local mock.
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
let pass = 0, fail = 0;
const ok = (c: boolean, m: string) => { c ? pass++ : (fail++, console.log('FAIL', m)); };
const secretRaw = Buffer.from('test-secret-bytes-1234567890');
process.env.RESEND_WEBHOOK_SECRET = 'whsec_' + secretRaw.toString('base64');
process.env.RESEND_API_KEY = 're_test';
process.env.OWNER_EMAIL = 'owner@example.com';
const sent: any[] = [];
const srv = createServer((req, res) => {
  let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
    res.setHeader('content-type', 'application/json');
    if (req.url?.startsWith('/emails/receiving/em1/attachments')) return res.end(JSON.stringify({ data: [] }));
    if (req.url?.startsWith('/emails/receiving/em1')) return res.end(JSON.stringify({ id: 'em1', from: 'Jane Parent <jane@example.org>', to: ['hello@tracelings.com'], subject: 'Question about week 2', html: '<p>Hi!</p>', text: 'Hi!', authentication: { spf: 'pass', dkim: 'pass' } }));
    if (req.url?.startsWith('/emails/receiving/other')) return res.end(JSON.stringify({ id: 'other', from: 'info@x.com', to: ['someone@otherbusiness.com'], subject: 'code', html: '', text: '' }));
    if (req.url?.startsWith('/emails/receiving/loop')) return res.end(JSON.stringify({ id: 'loop', from: 'hello@tracelings.com', to: ['hello@tracelings.com'], subject: 'x', html: '', text: '' }));
    if (req.url === '/emails' && req.method === 'POST') { sent.push(JSON.parse(b)); return res.end(JSON.stringify({ id: 'out1' })); }
    res.statusCode = 404; res.end('{}');
  });
}).listen(4199);
process.env.RESEND_BASE_URL = 'http://127.0.0.1:4199';
const { verifyWebhook, forwardReceived } = await import('../src/lib/server/inbound.ts');
const body = JSON.stringify({ type: 'email.received', data: { email_id: 'em1' } });
const ts = String(Math.floor(Date.now() / 1000));
const sig = createHmac('sha256', secretRaw).update(`msg1.${ts}.${body}`).digest('base64');
const h = (s: string, t = ts) => new Headers({ 'svix-id': 'msg1', 'svix-timestamp': t, 'svix-signature': s });
ok(verifyWebhook(body, h(`v1,${sig}`)), 'valid signature accepted');
ok(verifyWebhook(body, h(`v1,bad v1,${sig}`)), 'multiple signatures, one valid');
ok(!verifyWebhook(body + ' ', h(`v1,${sig}`)), 'tampered body rejected');
ok(!verifyWebhook(body, h('v1,AAAA')), 'wrong signature rejected');
ok(!verifyWebhook(body, h(`v1,${sig}`, String(Number(ts) - 3600))), 'old timestamp rejected');
ok(!verifyWebhook(body, new Headers()), 'missing headers rejected');
ok((await forwardReceived('em1')) === 'forwarded', 'forwarded');
const m = sent[0];
ok(m?.to?.[0] === 'owner@example.com' && m.reply_to?.[0] === 'jane@example.org' && m.subject === 'Fwd: Question about week 2' && m.from.includes('hello@tracelings.com') && m.html.includes('<p>Hi!</p>'), 'forward fields');
ok((await forwardReceived('loop')) === 'skipped' && sent.length === 1, 'own mail not forwarded (no loop)');
ok((await forwardReceived('other')) === 'skipped' && sent.length === 1, 'other domains on the Resend account are never forwarded');
srv.close();
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
