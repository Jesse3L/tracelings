// Traces cropped B/W icon PNGs into compact SVG path data.
// Output: <dst>/<theme>.json  { icons: { name: "M.. C.. Z" } } in a 0..1000 box (absolute M/L/C/Z only),
// and <dst>/<theme>/<name>.svg for <img> use on the site.
const fs = require('fs');
const path = require('path');
const potrace = require('potrace');
const [src, dst, skipArg] = process.argv.slice(2);
const skip = new Set((skipArg || '').split(',').filter(Boolean));

function trace(file) {
  return new Promise((res, rej) => {
    potrace.trace(file, { turdSize: 20, optTolerance: 0.4, threshold: 128, alphaMax: 1 }, (err, svg) => (err ? rej(err) : res(svg)));
  });
}

function normalize(d, size) {
  // potrace emits absolute M, L, C and Z commands.
  const toks = d.match(/[MLCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi);
  const out = [];
  let cmd = '';
  let nums = [];
  const flush = () => {
    if (!cmd) return;
    if (cmd === 'Z') { out.push('Z'); return; }
    const per = cmd === 'C' ? 6 : 2;
    for (let i = 0; i + per <= nums.length; i += per) {
      const seg = nums.slice(i, i + per).map((v) => Math.round((v / size) * 1000));
      out.push((i === 0 || cmd === 'C' || cmd === 'L' ? cmd : 'L') + seg.join(' '));
    }
  };
  for (const t of toks) {
    if (/^[MLCZ]$/i.test(t)) { flush(); cmd = t.toUpperCase(); nums = []; }
    else nums.push(parseFloat(t));
  }
  flush();
  return out.join('');
}

(async () => {
  for (const theme of fs.readdirSync(src).sort()) {
    const dir = path.join(src, theme);
    const icons = {};
    fs.mkdirSync(path.join(dst, theme), { recursive: true });
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.png')).sort()) {
      const name = f.replace('.png', '');
      if (skip.has(`${theme}/${name}`)) continue;
      const svg = await trace(path.join(dir, f));
      const ds = [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]).join(' ');
      const size = Number(svg.match(/width="(\d+)"/)[1]);
      const d = normalize(ds, size);
      if (/[A-Z]{2}|NaN/.test(d.replace(/Z(?=M)|ZZ/g, 'Z'))) throw new Error(`bad path ${theme}/${name}`);
      icons[name] = d;
      fs.writeFileSync(path.join(dst, theme, `${name}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><path d="${d}" fill="#1e2a44" fill-rule="evenodd"/></svg>\n`);
    }
    fs.writeFileSync(path.join(dst, `${theme}.json`), JSON.stringify({ theme, box: 1000, icons }));
    console.log(theme, Object.keys(icons).length, Math.round(fs.statSync(path.join(dst, `${theme}.json`)).size / 1024) + 'KB');
  }
})();
