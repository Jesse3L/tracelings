Theme icons for the personalized program (public/program/icons/).

1. One 3x3 sheet per theme was generated on Higgsfield (gpt_image_2_5, high, 2k, about 2.75 credits each):
   bold black outline line art on white, no text, 9 icons in the order listed in names.json.
2. crop.py splits each sheet into 9 square, padded, black-and-white PNGs:
     python3 -I scripts/program-icons/crop.py <sheets-dir> <crops-dir> scripts/program-icons/names.json
3. trace.cjs (needs `npm i potrace@2.1.8` in a scratch folder) traces each crop to a vector path and writes
   public/program/icons/<theme>.json (paths for the PDF pages) and <theme>/<icon>.svg (for the picture grid):
     node trace.cjs <crops-dir> public/program/icons trains/track
   The last argument lists icons to leave out (trains/track read like a fence and was dropped).
Every icon was looked at before shipping. Paths use the even-odd fill rule.
