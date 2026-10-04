// Tells Bing (and other IndexNow engines) about new or changed pages.
// Usage: node scripts/indexnow.mjs            -> submits every URL in the live sitemap
//        node scripts/indexnow.mjs <url> ...   -> submits just those URLs
const KEY = '3dd3017c4bf9568698797afd00a7cca4';
const HOST = 'tracelings.com';
let urls = process.argv.slice(2);
if (!urls.length) {
  const idx = await fetch('https://' + HOST + '/sitemap-0.xml').then((r) => r.text());
  urls = [...idx.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}
const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: 'https://' + HOST + '/' + KEY + '.txt', urlList: urls.slice(0, 10000) }),
});
console.log('IndexNow', res.status, urls.length, 'URLs');
