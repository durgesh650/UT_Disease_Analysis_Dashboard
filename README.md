# Union Territory Disease Analysis Dashboard

A multi-page analytics website for comparing recorded disease case counts across Union Territories and two reporting periods. It uses HTML/CSS/JavaScript, Node.js + Express, and MySQL.

## Pages included

1. **Home** — project introduction and quick start.
2. **Dashboard Filters** — Union Territory, disease, Old Period, New Period, Submit and Reset.
3. **Dashboard Overview** — four summary cards and one full-width Old vs New Period Comparison graph.
4. **Top 5 Diseases** — one full-width graph comparing the separately calculated top-five lists for both periods; definitions removed.
5. **Cases by Disease** — one full-width doughnut chart showing the new-period case distribution.
6. **Disease Trends & Growth** — one full-width line graph comparing total cases across the two available periods, with change summaries below.
7. **Data Table** — disease-wise comparison table, CSV export, and Print / Save as PDF.

Only one graph appears on each graph page. The Reports & Comparison page has been removed; report downloads are now on Data Table.

## Requirements

- Node.js (LTS recommended)
- MySQL Server and MySQL Workbench (Workbench is a database management tool; the website connects to the MySQL server)
- A browser

## Setup

### 1. Create the database and table

Open MySQL Workbench and run `database/schema.sql`.

### 2. Import the dataset

Run `database/hmis_24_disease_actual_insert.sql` in MySQL Workbench. **Warning:** this import script runs `TRUNCATE TABLE disease_cases` before inserting the supplied records. It deletes existing rows in that table first. Back up any data you need before running it.

The dataset uses `year = 2017` for `2017-18` and `year = 2019` for `2019-20`. The filter text boxes accept the period labels, and the backend maps them to these stored year values.

### 3. Configure the backend

Open a terminal in the `backend` folder and run:

```bash
npm install
```

Copy `.env.example` to `.env` and set your local MySQL credentials:

```env
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=ut_disease_db
DB_PORT=3306
```

Do not share your `.env` file or put your real database password into a public ZIP.

### 4. Start the API

In the `backend` folder:

```bash
npm start
```

The API should report that it is running at `http://localhost:5000`. Test `http://localhost:5000/api/health` in a browser.

### 5. Open the frontend

Open `frontend/index.html` in your browser. If your browser blocks local file requests, use VS Code Live Server to serve the `frontend` folder. The frontend calls `http://localhost:5000`. Charts use Chart.js from a CDN, so the browser needs internet access to load the chart library.

## Important behavior

- Changing filters does not fetch new results immediately. Press **Submit & View Dashboard** to apply them.
- **Reset** restores the default comparison (`All Union Territories`, `All Diseases`, `2017-18` vs `2019-20`) and applies it.
- Only `2017-18` and `2019-20` are valid periods in this included dataset. Entering any other value is rejected instead of silently showing incorrect data.
- The PDF option uses the browser print dialog. Choose **Save as PDF**.
- Percentage growth is shown as `N/A` when the old-period case count is zero to avoid division by zero.
- Top-five rankings are calculated separately for each period. If the two top-five lists differ, the graph includes the union of those ranked diseases.
- Counts are not adjusted for population and should not be interpreted as individual disease risk.

## API endpoints

- `GET /` — API status message
- `GET /api/health` — database connection check
- `GET /api/options` — Union Territory, disease, and period options
- `GET /api/dashboard?unionTerritory=All&disease=All&oldPeriod=2017-18&newPeriod=2019-20` — summary, comparisons, top-five lists, and records

## Troubleshooting

- **API not connected:** make sure the backend terminal is running and `PORT=5000`.
- **Database error:** check MySQL service, `.env` credentials, database name, and that both SQL files were run in order.
- **Empty charts:** check that `disease_cases` contains rows for years 2017 and 2019.
- **No PDF download appears:** the browser print dialog opens; select Save as PDF.

## Frontend color theme

- Dark Teal: `#115E59` for navigation, headings, and primary buttons.
- Light Mint: `#E6FFFA` for the main page background.
- White: `#FFFFFF` for cards, tables, and chart containers.

Frontend files remain separate: `index.html`, `style.css`, and `script.js`. Dynamic dashboard sections are currently assembled by JavaScript, so the JavaScript file is kept unchanged to protect existing functionality.
