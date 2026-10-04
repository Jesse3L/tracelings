# Tracelings

Personalized kids' printables: free generators plus a membership (planned).

## Run it
```
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/, deploy to Vercel
```

## Where things live
- `src/config.ts` — brand name, domain and email (change the brand here)
- `src/lib/glyphs.ts` — license-free ball-and-stick letters, A–Z, a–z, 0–9, drawn as strokes
- `src/lib/sheet.ts` — the page model: guide lines, rows, layout, starting dots
- `src/lib/render.ts` — the same page model drawn as SVG (preview) and as a PDF (pdf-lib)
- `src/components/NameTracer.tsx` — the name tracing tool
- `src/components/HeroTracer.tsx` — the homepage live demo
- `src/pages/` — homepage, /name-tracing/, /privacy/

Names typed into the tools are never sent anywhere; PDFs are built in the browser.
