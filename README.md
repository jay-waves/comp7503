# COMP7503

Local Node-RED, Dashboard 2.0 and MongoDB environment using Docker Compose.

## Usage

```bash
bash install.sh  # Install Docker and start the environment (Fedora)
bash start.sh    # Build and start services in the background
bash stop.sh     # Stop containers and retain data
```

Requires Python 3 and sudo. The Node-RED data directory must be owned by UID 1000.

- Editor: http://localhost:1880
- HKO dashboard: http://localhost:1880/dashboard/temperature
- Healthcare dashboard: http://localhost:1880/healthcare/overview
- MongoDB: `localhost:27017`; use `mongodb:27017` inside Compose.
- Database credentials are generated in `.env`. Node-RED can use `${MONGODB_URI}`.

## Data and logs

Node-RED data lives in `node-red/data/`; MongoDB uses Docker named volumes. Stopping or rebuilding containers retains data. Do not run `docker compose down -v` or delete the data directory to retain collected history. Node-RED flow/global context uses memory by default.

```bash
sudo docker compose ps
sudo docker compose logs -f --tail=100
```

Dashboard and MongoDB nodes are preinstalled by `node-red/Dockerfile`. MongoDB runs as a separate service.

## HKO example

In the editor, select Import, choose `docs/HKO.Flow.dashboard2.json`, and Deploy. The example collects HKO observations every five minutes, stores them in MongoDB, and displays station temperatures over the last 24 hours. History accumulates after collection starts.

The original `docs/HKO.Flow.json` is retained. The migrated example uses Dashboard 2.0, mongodb4 and `${MONGODB_URI}`; the exported flow contains no database password.

## Healthcare project

See [project design](docs/hospital-project-design.md) for assignment fit, metric definitions, dashboard plans, collection, storage and team sharing.

Run `bash start.sh`. On first startup, the hospital flow JSON is copied into `node-red/data/flows.json`, which Node-RED loads automatically. No manual import or Deploy is needed. The Node-RED Editor saves later flow changes to that persistent runtime file. On first run, an automatic one-time flow fetches the latest 28 days of archived A&E snapshots from DATA.GOV.HK and upserts them into MongoDB; later starts skip the completed backfill. The starter then collects A&E data every 15 minutes, checks SOP data daily, and displays an English dashboard with an interactive hospital map, a horizontal bar chart, a ranking table and the 28-day weekday/hour heatmap. SOP trends remain a planned extension.

The dashboard templates are `dashboards/hospital-overview.vue` and `dashboards/hospital-heatmap.vue`. The generator creates the clean first-start seed at `flows/hospital-starter.dashboard2.json`; it never changes `node-red/data/flows.json`, which is the runtime flow edited in Node-RED Editor. Running the generator again does not overwrite Editor changes:

```bash
python3 scripts/build-hospital-flow.py
```

The map uses official Hospital Authority coordinates, refreshed weekly with a bundled fallback snapshot in `data/hospital-locations.json`. Leaflet 1.9.4 loads from unpkg.com; basemap tiles come from OpenStreetMap. Both require browser network access. No API key or Compose changes are needed. Run `node tests/hospital-map.cjs` for dependency-free map/data checks.

The heatmap appears below the overview. Select a hospital and III/IV-V percentile. Cells show the median published estimate in minutes, with sample counts and expected-slot coverage on hover or click. Empty periods remain empty. It refreshes after successful A&E writes and at startup. Run `node tests/hospital-heatmap.cjs` to check aggregation and coverage calculations.
