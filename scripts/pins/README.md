# Pinterest pins

Pins are tall images (1000x1500) made from `pins.json` by `make-pins.py`. They are served from `tracelings.com/pins/<id>.jpg`, so a batch's images have to be merged and live before its CSV is uploaded. Each batch has its own CSV for Pinterest's bulk create (pinterest.com, Create, Bulk create Pins, upload the .csv; desktop only, up to 200 pins per file).

## Batches

Which CSVs are on Pinterest and which are still waiting. This table is rebuilt from `batches.json` every time `make-pins.py` runs; edit `batches.json`, not the table.

<!-- batches:start -->
| Batch | Pins | CSV | First pin (UTC) | Last pin (UTC) | Uploaded | Status |
|---|---|---|---|---|---|---|
| launch-2026-10 | 20 | `pinterest-bulk.csv` | 2026-10-13 14:00 | 2026-10-19 18:00 | yes | uploaded |
| pets-2026-11 | 5 | `pinterest-bulk-pets-2026-11.csv` | 2026-11-30 15:00 | 2026-12-01 19:00 | not confirmed | ready to upload |
| themes-2026-11 | 8 | `pinterest-bulk-themes-2026-11.csv` | 2026-12-02 15:00 | 2026-12-04 19:00 | not confirmed | ready to upload |
<!-- batches:end -->

"Not confirmed" means no one has recorded the upload yet. If you already uploaded that CSV, don't upload it again; mark it uploaded instead (below), or tell the next Claude run.

## Uploading a batch

1. Run `python3 scripts/pins/make-pins.py --status`. Each batch shows "ready to upload", "stale" or "uploaded".
2. If the batch you want is stale (its first pin time has passed), make a fresh CSV with later dates. The images stay as they are:
   `PIN_SKIP_RENDER=1 PIN_BATCH=<batch> PIN_START=<YYYY-MM-DD> python3 scripts/pins/make-pins.py`
3. Upload `scripts/pins/pinterest-bulk-<batch>.csv` in Pinterest's bulk create.
4. Mark it uploaded so it is never scheduled twice:
   `python3 scripts/pins/make-pins.py --uploaded <batch>`

## Making a new batch

1. Add the pins to `pins.json` with a new `"batch"` name (for example `spring-2027-03`). Titles stay under 100 characters and descriptions under 500; the script stops if one is longer.
2. `PIN_BATCH=<batch> PIN_START=<YYYY-MM-DD> python3 scripts/pins/make-pins.py` renders the images to `public/pins/`, writes the CSV and adds the batch to `batches.json` as not uploaded.
3. Look at every jpg before merging.

Pins go out 3 a day at 9am, 1pm and 7pm Central time (the CSV holds the UTC times, which shift by an hour when daylight saving time starts or ends). Without `PIN_START` the first day is two days from today.

## What the script refuses to do

- Write a CSV whose first pin time is already past, or less than an hour away. Pinterest only schedules future dates, so pick a later `PIN_START`.
- Rewrite the CSV of a batch marked uploaded. Those pins are already scheduled on Pinterest.
- Write a CSV without `PIN_BATCH`. Running it with no batch re-renders every image and writes no CSV, so old pins can't land in a new upload by mistake.
