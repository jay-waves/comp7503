# Hong Kong Public Hospital Waiting Times

## Assignment fit

The assignment (`Programming Assignment.pdf`, pages 1 and 4) requires government open-data streams, collection and analysis in Node-RED, correlation, dashboards and a written explanation of the smart-city use case, implementation and storage. It specifically asks students to start accumulating data early. Teams consist of 2–3 students; submission is due 1 December 2026, before 23:55, and includes exported flows, a Docker ID or description file, and the report.

This topic fits. Suggested title: **Hong Kong Public Hospital Waiting Times: A&E Temporal Patterns and Specialist Outpatient Trends**. The smart-city question concerns differences in public healthcare access across locations and times.

Move beyond displaying rankings: identify persistent high-wait periods within a hospital, compare hospitals at the same timestamp and triage category, and investigate weekday/weekend patterns. Prioritize A&E as the core deliverable; SOP is an independent extension because it is reported at cluster level and on a much slower schedule.

## Verified sources

Sources checked on 23 October 2026:

| Dataset | Official frequency | JSON endpoint |
|---|---|---|
| A&E waiting times | Every 15 minutes | https://www.ha.org.hk/opendata/aed/aedwtdata2-en.json |
| Specialist outpatient new-booking waiting times | Quarterly: January, April, July and October | https://www.ha.org.hk/opendata/sop/sop-waiting-time-en.json |
| Hospital locations and clusters | Reference data; check weekly | Select the hospital resource from the Hospital Authority institution directory; verify coordinate system and fields before integration |

Official catalogues and dictionaries:

- https://data.gov.hk/en-data/dataset/hospital-hadata-ae-waiting-time
- https://www.ha.org.hk/opendata/Data-Specification-for-A%26E-Waiting-Time-en.pdf
- https://data.gov.hk/en-data/dataset/hospital-hadata-sop-waiting-time
- https://www.ha.org.hk/opendata/Data-Specification-for-SOP-Waiting-Time-en.pdf
- https://data.gov.hk/en-datasets/provider/hospital

A&E changed its URLs and structure on 13 October 2025. Use `aedwtdata2`, rather than an old `topWait` parser.

### Metric definitions

- Categories I and II: `t1wt` and `t2wt` contain estimated waiting times or textual status. Preserve `manageT1case` and `manageT2case`. Display original status rather than turning these into hospital recommendations.
- Category III: `t3p50` and `t3p95`, expressed in minutes.
- Categories IV/V: `t45p50` and `t45p95`, expressed in hours, rounded upward by the source to half-hour increments. IV and V cannot be separated using this dataset.
- These are published estimates, not measured completed patient journeys.

SOP rows include reporting dates, cluster, specialty, Category, Description and Value. Values can represent waiting times, counts, percentages or next-update dates; do not parse every Value as weeks. The observed reporting window is 1 July 2025–30 June 2026. Quarterly releases can describe overlapping annual windows; explain this when interpreting trends.

## Current implementation

Run `bash start.sh`. On first startup, the seed flow is copied to `node-red/data/flows.json` and loaded automatically through Docker's `FLOWS=flows.json` setting. Later edits in Node-RED Editor are saved to that persistent runtime file; the generator only updates the seed and does not overwrite runtime edits. A one-time startup flow imports the latest 28 days of official A&E archive snapshots into MongoDB, then refreshes the heatmap. Open http://localhost:1880/healthcare/overview . This uses the installed Dashboard 2 and mongodb4 nodes.

Implemented:

- Startup collection followed by A&E polling every 900 seconds and SOP checks every 86400 seconds.
- HTTP/schema checks and explicit conversion of Hong Kong source timestamps.
- Idempotent MongoDB upserts and SOP row-level revision preservation.
- An English dashboard with an interactive hospital map and horizontal bar chart and a detailed ranking table. The selected metric controls both sorting and bar lengths: III or IV/V, P50 or P95. Hours are converted to minutes for a common bar scale; labels retain original values.
- Original category I/II status, source timestamp, and a stale-data message after more than 30 minutes.
- Dashboard updates after successful database writes; collection/database errors are summarized in Debug.

Editable dashboard: `dashboards/hospital-overview.vue`. Regenerate the flow with `python3 scripts/build-hospital-flow.py` after edits.

Not yet implemented: historical line chart, SOP trend chart, automatic retries, collection-run audit records and startup restoration of the last database snapshot. After restart, the dashboard waits for the next successful collection.

## Target dashboard layout

```text
Summary: source timestamp / hospital coverage / missingness / selected metric
Filters: hospital or cluster / category / percentile / historical date range
Hospital map                          Hospital waiting-time bars
Selected hospital historical line    Weekday-by-hour heatmap
Separate SOP page: specialty / cluster / triage category / reporting window
```

### Hospital map

Implemented above the comparison chart: a pan/zoom Leaflet map with the official coordinates of 18 A&E hospitals. Hospital names are matched exactly to the waiting-time feed, with one explicit alias from `St John Hospital` to the directory name `St. John Hospital`; unmatched names are listed for review. An official reference snapshot is bundled in `data/hospital-locations.json`, with source URL and retrieval time. Node-RED refreshes reference data at startup and weekly, validates coordinates, and merges it with the latest successful A&E view.

Markers use fixed minute bands: under 60, 60–179, 180–359, and 360+; unknown values are grey. Switching category/percentile recolours markers. Clicking a marker displays address, cluster and all four published III/IV-V metrics plus I/II status. “Show all hospitals” resets the bounds. These bands are display choices, not official clinical targets.

Leaflet 1.9.4 is loaded from unpkg.com with integrity checks, and OpenStreetMap provides attributed tiles. Browser access to both hosts is required. Library/tile errors show a message while the table remains available. No browser installation or API key is required. Both datasets use published geographic latitude/longitude directly; no geocoding or invented coordinates are used.

### Historical heatmap

Implemented as a separate dashboard widget below the overview, defaulting to the last 28 days in Asia/Hong_Kong time. Columns are hours 0–23, rows Monday–Sunday, for one hospital/category/metric. Each cell shows the approximate median of published estimates (MongoDB 8 `$median`) and includes sample count and expected-slot coverage. Expected slots are counted every 15 minutes within the exact rolling query window. The query runs at startup and after successful A&E writes; selectors update the view locally. Missing cells remain missing rather than zero.

This is a waiting-estimate heatmap, not patient volume, occupancy or actual patient waiting time. The median of published P95 values is not the pooled P95 across patients. One week describes that week only; collect 2–4 weeks before discussing recurring patterns.

### SOP trends

Start with current-period cluster comparisons. Draw a trend only after obtaining at least two distinct reporting windows. Use reporting-window end dates on the horizontal axis, and show full window, metric, original value and revision in tooltips. Daily retrievals of the same report do not create a daily trend.

Check DATA.GOV.HK historical downloads before promising a long time series; the presence of a download interface does not guarantee adequate history. Keep overlapping-window limitations visible.

## Collection and storage strategy

### Existing collections

`ha_ae_snapshots`: one raw snapshot per source timestamp. `_id` is `ae:<sourceTime ISO>`. Fields include BSON sourceTime, first fetchedAt, lastSeenAt, sourceUrl and complete raw response. Repeated polling updates lastSeenAt without duplicating records. This starter retains the first content seen at a timestamp; a later production version should preserve same-timestamp revisions with a content hash.

`ha_sop_snapshots`: raw rows with an ID derived from reporting dates, cluster, specialty, category, description and value. A changed value in the same period creates a revision. Keep fetchedAt and lastSeenAt. Resolve revisions by logical row key and most recently first-observed version; retrieval dates are not reporting periods.

### Proposed analysis collection

```text
hospitalId, sourceTime(Date), fetchedAt(Date), triage(III/IV_V),
metric(p50/p95), rawValue, valueMinutes(number/null),
qualifier(exact/lt/gt/status/unknown), sourceRevision
```

Suggested unique index: `{hospitalId:1, sourceTime:1, triage:1, metric:1, sourceRevision:1}`. Query index: `{hospitalId:1, triage:1, metric:1, sourceTime:1}`. Add `{sourceTime:1}` to raw snapshots. Store dates as BSON Date, rather than localized strings.

Preserve bounds and statuses: “less than 15 minutes” is an upper bound, not exactly 15; missing and resuscitation-status values must not become zero. The current chart only converts exact numeric minute/hour strings. Other values remain in the table and sort after numeric values without a bar.

### Scheduling and reliability

- A&E: 15-minute polling means 96 requests per day. A future scheduler can run 60–120 seconds after Hong Kong quarter-hour boundaries to allow publication to finish. Startup/retry collection uses the same deduplication keys.
- SOP: daily checks are sufficient. Hospital reference data can be checked weekly.
- Add at most two retries, for example after 30 and 120 seconds with jitter. Honor Retry-After on 429. The starter currently waits for the next scheduled poll after failure.
- Flag three consecutive failed polls or a source timestamp older than 30 minutes. Record outages as gaps; never backfill past timestamps using the current value.
- Add `ingestion_runs` for request time, status code, latency, source time, row count, error type and retry count. Avoid logging whole responses or cookies.

At the currently observed 18 hospitals, raw storage grows by up to 96 snapshots daily. Four derived metrics yield roughly 6,912 observations daily, or 207,360 in 30 days. This is manageable without Kafka or a large-data platform; measure actual storage and index overhead.

Keep raw history until grading is complete; do not add a TTL yet. Back up daily and test restores. Docker volumes preserve data across restarts but do not constitute a backup.

## Analysis for the report

1. Compare weekday/weekend and daytime/nighttime distributions for the same hospital/category, with sample counts and missingness.
2. Compare hospitals at aligned source timestamps and distinguish local versus widespread high estimates.
3. For additional correlation work, align existing HKO observations hourly and investigate rainfall versus waiting estimates, accounting for hospital, hour and weekday effects and any lag window. Temporal autocorrelation and confounding prevent a causal interpretation. If time is limited, prioritize hospital/category/time-pattern comparisons.
4. Interpret SOP independently at cluster/specialty/reporting-window level. Do not use hourly A&E changes to explain quarterly rolling statistics.

## Team data sharing — discussion only

Recommended for a 2–3 person team: **one continuous collector, versioned data snapshots, local analysis environments**.

- Assign collection to one always-on machine. Other members disable scheduled collection to avoid divergent histories.
- Share flows, source, schema definitions and documentation through Git. Keep `.env`, passwords, database volumes and runtime data out of Git.
- Export a compressed MongoDB archive daily or weekly to a private shared drive. Include schemaVersion, export time, sourceTime range, record counts and SHA-256 checksums.
- Restore into a separate local database. CSV/JSONL can supplement backups for analysis, but CSV does not fully preserve BSON dates, nested structures or bound semantics.
- Freeze a named snapshot for the report so all figures can be reproduced while collection continues separately.

If live shared access becomes necessary, use a central MongoDB with separate read-only accounts for teammates and a dedicated writer for collection. Access through an SSH tunnel or existing VPN. The current localhost-only Compose binding can remain; do not expose port 27017 publicly or share the root `.env` credentials.

For flow development, use separate tabs and ID prefixes, with one designated integrator. Shared editing in one Node-RED instance can overwrite work. Viewing a dashboard does not require editor access. No account or network changes have been made for sharing.

## Delivery sequence and validation

1. Start continuous collection and backups immediately; prevent host sleep from interrupting collection.
2. Verify storage, deduplication and status reporting, then add hospital reference data and map.
3. Build the first heatmap after a week; evaluate recurring patterns after 2–4 weeks.
4. Check and backfill SOP history, or retain a current-period comparison if history is insufficient.
5. Freeze report data and prepare exported flows, Compose description and reproduction instructions.

On 23 October 2026, the starter was deployed to local Node-RED. A MongoDB read-back confirmed a snapshot for 18 hospitals at `2026-10-23T08:00:00Z` and SOP records for reporting dates 20250701–20260630. The dashboard route returned HTTP 200. Temporary read-only verification routes were removed. The MongoDB connection explicitly selects `uriTabActive=tab-uri-advanced`; the original HKO example was not changed.

The English bar-chart revision receives JavaScript syntax and calculation checks. Browser layout and end-to-end interaction have not been visually verified. No browser or browser dependencies were downloaded.

Map revision: dependency-free checks cover the 18 reference coordinates, exact matching and unmatched rows, fixed colour bands, metric switching, marker creation, bounds fitting and generated flow syntax. Browser layout and live tile loading remain unverified.

Heatmap implementation: `scripts/hospital-heatmap-query.js` builds the MongoDB aggregation; `scripts/hospital-heatmap-result.js` counts expected Hong Kong time slots; `dashboards/hospital-heatmap.vue` renders the interactive 7×24 grid. Bound expressions and non-numeric statuses are excluded, zero values are retained. The current query groups stored source timestamps without inventing missing history. Add a sourceTime index as the collection grows.
