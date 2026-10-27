# Analysis of Accident and Emergency Waiting Times at Hong Kong Public Hospital

## Project Files

Node-RED, Dashboard 2.0, and MongoDB run through Docker Compose. The
Dashboard and MongoDB nodes are installed in `node-red/Dockerfile`. The
HKO example flow is located at `docs/HKO.Flow.dashboard2.json`; it can
be imported into the Node-RED Editor and deployed. The flow collects
weather observations from the Hong Kong Observatory every five minutes,
stores them in MongoDB, and displays temperatures from the most recent
24 hours. The legacy flow is retained in `docs/HKO.Flow.json`. The
example uses `${MONGODB_URI}`, so the exported flow does not contain the
database password.

The Healthcare dashboard templates are located in `dashboards/`. The
flow-generation script is `scripts/build-hospital-flow.py`, and the
generated first-run template is
`flows/hospital-starter.dashboard2.json`. The `node-red/data/flows.json`
file, which is saved when flows are edited in the Node-RED Editor, is
the flow used by the running instance; regenerating the template does
not overwrite it. The hospital map uses Hospital Authority coordinates,
which are updated weekly, with `data/hospital-locations.json` serving as
a fallback snapshot. The map requires browser access to unpkg.com and
OpenStreetMap.

## Topic and Objectives

This project focuses on access to emergency services at Hong Kong public
hospitals. It uses public data from the Hospital Authority (HA) to
compare estimated Accident and Emergency (A&E) waiting times across
hospitals, time periods, and triage categories, and to observe spatial
and temporal differences in healthcare service pressure. The data
consists of estimates published by official sources. It does not
represent the actual waiting time completed by an individual patient and
does not constitute personal medical advice.

## Deployment and Access

The project uses Docker Compose to start Node-RED and MongoDB. On the
first run of `bash start.sh`, the script checks whether the UID of
`node-red/data` is 1000, initializes the Node-RED runtime flow from the
flow template, and generates a local MongoDB account configuration in
`.env`. It then builds and starts the services. Running the same command
again starts the existing environment. MongoDB data is stored in a
persistent volume, while Node-RED flows are stored in `node-red/data/`.
To stop the services, run `bash stop.sh`; this does not delete the
database volume.

The Node-RED Editor is available at `http://localhost:1880`, where flows
can be viewed and maintained. The healthcare dashboard is available at
`http://localhost:1880/dashboard/healthcare/overview`; scroll down the
page to view the historical heatmap. The dashboard does not require a
Node-RED Editor login. The map tiles and the Leaflet library require the
browser to access OpenStreetMap and unpkg.com. If map resources fail to
load, the comparison charts remain usable. MongoDB is bound only to the
local port `27017`, and its credentials are stored in `.env`.

## Raw Data Structures

The following excerpts show one record from each actual response.

### Accident and Emergency (A&E) Waiting Times

Source: <https://www.ha.org.hk/opendata/aed/aedwtdata2-en.json>

``` json
{
  "waitTime": [
    {
      "hospName": "Alice Ho Miu Ling Nethersole Hospital",
      "t1wt": "0 minute",
      "manageT1case": "N",
      "t2wt": "less than 15 minutes",
      "manageT2case": "Y",
      "t3p50": "42 minutes",
      "t3p95": "68 minutes",
      "t45p50": "3 hours",
      "t45p95": "4 hours"
    }
  ],
  "updateTime": "23/10/2026 6:00PM"
}
```

| Field | Description |
| --- | --- |
| `updateTime` | Publication time in Hong Kong local time, `DD/MM/YYYY h:mmAM/PM` |
| `waitTime[].hospName` | Hospital name |
| `t1wt`、`t2wt` | Estimated waiting times for Categories I and II, such as `0 minute`、`less than 15 minutes`、`Managing multiple resuscitation cases` |
| `manageT1case`、`manageT2case` | Category I and II case-management flags provided by the source: `Y`, `N`, or `N/A` |
| `t3p50`、`t3p95` | Estimated waiting times for Category III at P50 and P95; strings expressed in minutes or hours |
| `t45p50`、`t45p95` | Estimated waiting times for combined Categories IV/V at P50 and P95; strings expressed in minutes or hours |

Categories I and II do not have P50/P95 values. The source does not
contain individual patient records, P25/P75 values, or the minimum and
maximum values required for a complete box plot.

### Specialist Out-patient (SOP) Services

Source: <https://www.ha.org.hk/opendata/sop/sop-waiting-time-en.json>

``` json
[
  {
    "date_id_from": 20250701,
    "date_id_to": 20260630,
    "cluster": "Hong Kong East Cluster",
    "specialty": "Ear, Nose, Throat",
    "Category": "Urgent Case - Median",
    "Description": "Median Waiting Time for New Case Booking for Specialist Out-patient Services",
    "Value": "Less than 1 week"
  }
]
```

-   `date_id_from` and `date_id_to`: start and end dates of the
    reporting period, as integers in `YYYYMMDD` format.
-   `cluster` and `specialty`: hospital cluster and specialty.
-   `Category` and `Description`: statistical category and indicator
    description.
-   `Value`: the original statistical value as a string, retaining its
    unit and qualifiers such as "less than".

### Hospital Directory and Coordinates

Source: <https://www.ha.org.hk/opendata/facility-hosp.json>

``` json
[
  {
    "cluster_eng": "Hong Kong Island Cluster",
    "institution_eng": "Cheshire Home, Chung Hom Kok",
    "with_AE_service_eng": "No",
    "address_eng": "128 Chung Hom Kok Road, HK",
    "cluster_tc": "香港島醫院聯網",
    "institution_tc": "舂磡角慈氏護養院",
    "with_AE_service_tc": "否",
    "address_tc": "香港舂磡角道128號",
    "cluster_sc": "香港岛医院联网",
    "institution_sc": "舂磡角慈氏护养院",
    "address_sc": "香港舂磡角道128号",
    "latitude": 22.212024,
    "longitude": 114.1973
  }
]
```

-   `cluster_*`, `institution_*`, `with_AE_service_*`, and `address_*`:
    hospital cluster, institution name, whether A&E services are
    provided, and address. The suffixes `eng`, `tc`, and `sc` represent
    English, Traditional Chinese, and Simplified Chinese, respectively.
-   `latitude` and `longitude`: geographic coordinates. The application
    filters for records where `with_AE_service_eng = "Yes"`.
-   `sourceTime`, `fetchedAt`, `lastSeenAt`, and `sourceUrl` are
    metadata added by the application when storing the data; they are
    not part of the original response above.

### Hospital Survice Demand

source: <https://www.ha.org.hk/opendata/pas_report/Daily_Services_Statistics/Daily_Services_Statistics_EN.json>

``` json
[
  {
    "surge_year": "2026-27",
    "date": "2026-08-04",
    "cluster": "Hong Kong East",
    "hospital": "Pamela Youde Nethersole Eastern Hospital",
    "ae_first_attend": 306,
    "ae_to_med_ip": 97,
    "med_bed_occ_rate": 100,
    "ped_bed_occ_rate": 55
  }
]
```

-   `surge_year`, and `date`:Year and date of service demand surge period.
-   `cluster`, and `hospital`: hospital cluster and hospital name.
-   `ae_first_attend`, `ae_to_med_ip`, and `med_bed_occ_rate`: No. of A&E first attendances and inpatient admissions to Med via A&E, Medical inpatient bed occupancy rate at midnight.

### Flu

Source: <https://www.chp.gov.hk/files/misc/flux_data.csv>

The original influenza surveillance data is obtained from the Centre for Health Protection (CHP) as a CSV file and normalized into JSON for processing and visualization.

``` json
{
    "source":"flu",
    "latest":"2026-10-17",
    "rows":[
        {
            "date":"2024-10-19",
            "start":"2024-10-13",
            "AandB_proportion":0.0048,
            "H1":23,
            "H3":2,
            "B":10,
            "ILI_School":2,
            "ILI_NonSchool":1,
            "Adm_0_5":0.084,
            "Adm_6_11":0.061,
            "Adm_12_17":0.056,
            "Adm_18_49":0.013,
            "Adm_50_64":0.022,
            "Adm_65_higher":0.087,
            "Adm_All":0.039
        }
    ]
}
```

### A&E Syndromic Surveillance

Source: <https://www.chp.gov.hk/files/misc/aed_weekly.csv>

The original CSV data is normalized into JSON and stored in `data/health/aed.json`. The following excerpt contains one weekly record.

```json
{
  "source": "aed",
  "latest": "2026-10-17",
  "rows": [
    {
      "date": "2024-10-19",
      "start": "2024-10-13",
      "ili_weekly_average_rate": 122.54179517,
      "hfmd_weekly_average_rate": 1.17680035,
      "age_weekly_average_rate": 85.20647685,
      "acj_weekly_average_rate": 5.1021145
    }
  ]
}
```

- `source`: Data source identifier, `aed`, representing A&E syndromic surveillance.
- `latest`: End date of the latest available statistical week.
- `rows`: Array of weekly surveillance records.
- `date` and `start`: End and start dates of the reporting week, respectively, in `YYYY-MM-DD` format.
- `ili_weekly_average_rate`: Weekly average consultation rate for influenza-like illness (ILI).
- `hfmd_weekly_average_rate`: Weekly average consultation rate for hand, foot and mouth disease (HFMD).
- `age_weekly_average_rate`: Weekly average consultation rate for acute gastroenteritis (AGE).
- `acj_weekly_average_rate`: Weekly average consultation rate for acute conjunctivitis (ACJ).

The four indicators are expressed as rates per 1,000 coded A&E consultations rather than absolute patient counts. The data is based on diagnosis codes and symptom groups, not laboratory-confirmed infections. It is published weekly and may be subject to revision. The dashboard uses these records to display trends for the four syndromic categories.

## Data Flow and Status Handling

The A&E data flow is triggered every 15 minutes. Node-RED requests the
Hospital Authority JSON, checks and processes the source timestamp and
hospital records, and writes the data to `ha_ae_snapshots` using the
source timestamp as the key. If the same timestamp is fetched again, the
latest fetch time is updated rather than inserting a duplicate snapshot.
On the first startup, a separate one-time historical backfill process
downloads and stores the most recent 28 days of official archives, then
refreshes the heatmap. After a successful A&E collection and database
write, the latest hospital records are combined with hospital locations
and sent to the overview dashboard.

The SOP data flow checks the Hospital Authority data daily and writes
records to `ha_sop_snapshots`. Reporting periods and record contents are
used to distinguish data revisions. The new standalone cards can be
filtered by specialty and hospital cluster. They display median waiting
times for urgent, semi-urgent, and stable cases, as well as the
90th-percentile waiting time for stable cases in the latest statistical
period, retaining the source units and cluster names. Reference data for
hospital locations is updated and coordinate-validated weekly, and is
used to supply map markers.

The filters for each chart operate independently; there is no single
global indicator selector at the top. Status information is updated
together with the dashboard data. The page displays the source update
time and calculates data age from the source timestamp, marking data as
stale if it is more than 30 minutes old. Collection, format-validation,
or database errors are caught by a Catch flow, summarized, and output to
the Node-RED Debug panel. If the dashboard displays no data, the Debug
panel in the Editor should also be checked. The source update time is
shown at the top of the page. Each chart retains its statistical time
window, sample count, and expected collection-interval coverage. Missing
values remain empty and are not treated as zero.

## Charts and Interactive Features

-   **Triage guide:** Explains the priority levels of Categories I
    (Critical), II (Emergency), III (Urgent), IV (Semi-urgent), and V
    (Non-urgent), along with the service targets for Categories I--III.
    These targets do not represent real-time target-attainment rates.
    The panel also explains P50/P95 and the combined Categories IV/V
    definition, with a link to the Hospital Authority's explanation.
-   **Hospital map:** Displays hospitals with official A&E coordinates.
    Marker colours are fixed according to ranges of Category III
    (Urgent) P50 waiting times in minutes; grey indicates that no usable
    value is available. The map can be zoomed and dragged. Clicking a
    marker shows the hospital name, district, address, the four Category
    III and IV/V indicators, and the raw Category I/II statuses. "Show
    all hospitals" resets the view to include all hospitals.
-   **Hospital waiting-time comparison:** Categories III and
    combined IV/V are displayed in separate cards, each with its own
    district selector. Districts are grouped into Hong Kong Island,
    Kowloon, New Territories East, New Territories West, Tsuen Wan/Kwai
    Tsing, Tseung Kwan O, and Islands. For the selected time window, the
    charts show the arithmetic means of the waiting-time estimates
    published by each hospital, using P50 circles, interval bars, and
    P95 diamonds. Values are displayed in hours. Missing or textual
    values are not plotted as zero. These are P50--P95 interval charts,
    not complete box plots.
-   **Hospital historical trend:** The chart on the right of the
    comparison chart shows all hospitals in the selected district. Each
    hospital is represented by a solid P50 line, a same-colour
    semi-transparent P50--P95 band, and a dashed P95 upper boundary.
    Colours correspond to the hospital legend, and there is no separate
    hospital selector. Clicking a hospital name or legend item
    highlights that hospital in both charts and fades the others;
    clicking it again restores all hospitals. Changing the district
    clears the highlight. The 3h, 12h, 24 Hours, and 7 Days options
    appear beside the district selector at the top of the card and
    control both charts. There is no longer a P50/P95 toggle; triage
    category is fixed by each card. The vertical axis uses hours. The
    3h, 12h, and 24-hour modes retain the original samples, and lines
    break at missing values or gaps exceeding 30 minutes. The 7-day mode
    groups data by Hong Kong time into 3-hour intervals and takes the
    median of each hospital's published P50 and P95 values separately;
    empty intervals produce gaps, and hovering displays the sample
    count. The band is not a confidence interval, and an aggregated P95
    is not the combined patient-level P95. Hovering displays both
    estimates and their difference. On narrow screens, the charts are
    stacked vertically. The detailed numeric table has been removed;
    Category I/II statuses remain available in the map details.
-   **Weekly waiting-time patterns:** Filters by hospital and the four
    indicators, using records from the most recent 28 days. Records are
    grouped by Hong Kong local time, day of the week (Monday to Sunday),
    and hour (00--23), and each cell displays the median of the
    published estimates. Hovering, focusing, or clicking a cell shows
    the sample count, expected number of 15-minute intervals, and
    coverage. Colours represent minute ranges; an empty cell indicates
    that no valid numeric value is available. The P95 shown in the
    heatmap is the median of published P95 estimates, not a combined
    patient-level P95.

## Recent Updates (2026-10-26)

-   **New surveillance data and dashboard panel:** Added Hospital
    Authority surge-period service-demand statistics, Centre for Health
    Protection influenza data, and A&E syndromic surveillance data. The
    system checks these sources daily and writes them separately to
    `ha_health_sources`. Service-demand statistics are published daily
    only during surge periods, while the other two data sources are
    published weekly. Each panel displays its statistical date and a
    historical/delayed-data indicator. The current data extends through
    2026-08-04, 2026-10-17, and 2026-10-17, respectively.
-   **High-density visualizations:** Added hospital service-load
    rankings, cluster filters, trend charts, and a 100% occupancy
    reference line. Influenza charts show positivity-rate trends,
    historical stacked bars by subtype, and admission rates by age
    group. The four A&E syndromes are displayed in separate small charts
    with independent scales and support 13-, 26-, and 52-week windows.
    Syndrome surveillance is based on diagnostic codes and does not
    represent laboratory-confirmed case counts.
-   **Influenza doughnut chart:** Shows the latest week's detected
    counts and proportions for A(H1), A(H3), and B, using the same
    colours as the historical bar chart. The centre total and percentage
    denominator are the sum of these three subtype counts and must not
    be interpreted as all influenza A/B positives. If subtype data is
    missing, proportions are not drawn; if the total is zero, an empty
    ring and an explanation are displayed.
-   **Colours and layout:** Category III map and heatmap colours now use
    fixed ranges of `<10`, `10–<20`, `20–<30`, `30–<45`, `45–<60`, and
    `60+` minutes to avoid placing most observations in a single colour
    band. Category IV/V retains its previous ranges, and the legend
    changes with the selected indicator. The Dashboard top title bar is
    hidden, while data-update times remain visible inside the cards.
-   **Quality control and validation:** Rejects invalid numeric values,
    malformed CSV files, duplicate records, and invalid weekly
    statistical windows. Missing values are not converted to zero.
    Atomic MongoDB updates prevent older statistical dates from
    overwriting newer data while allowing revisions within the same
    statistical period. Errors for each source are recorded and cleared
    independently. Code tests, Vue template compilation, and MongoDB
    write validation have been completed. Deployment was performed with
    a backup through the Node-RED API; browser-based or screenshot-based
    validation was not performed.

## Analysis Directions and Limitations

Further analysis could compare distributions on weekdays and weekends,
during daytime and nighttime, and across hospitals under the same time
and triage-category conditions. If Hong Kong Observatory weather data is
used in correlation analysis, timestamps should first be aligned, and
factors such as hospital, day of the week, and time of day should be
considered. Correlation alone cannot establish causation. SOP data
should be compared by reporting period to avoid misinterpreting
quarterly statistics as daily changes. Conclusions are limited by
missing data, differences in estimation methodology, and the length of
the historical record. Reliable assessments of periodic patterns in the
heatmap require data covering a sufficient number of weeks.

## Data Storage

MongoDB stores A&E snapshots with the source timestamp, first and most
recent fetch times, source URL, and original response. It also stores
the original SOP records and their fetch information, supporting
deduplication, review, and further analysis. Docker persistent volumes
preserve database data across container restarts, but they are not a
substitute for backups. Data should also be exported separately to
protect against host failure.
