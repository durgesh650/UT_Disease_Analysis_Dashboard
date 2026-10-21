require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');
const app = express();
app.use(cors());
app.use(express.json());

const PERIOD_TO_YEAR = { '2017-18': 2017, '2019-20': 2019 };
const normaliseUT = (value) => value === 'Dadra and Nagar Haveli and Daman and Diu'
  ? ['Dadra and Nagar Haveli', 'Daman and Diu'] : [value];

app.get('/', (_req, res) => res.json({ message: 'Union Territory Disease Analysis API is running' }));
app.get('/api/health', async (_req, res) => {
  try { const [rows] = await pool.query('SELECT 1 AS ok'); res.json({ status: 'ok', database: rows[0].ok === 1 }); }
  catch (err) { res.status(500).json({ status: 'error', message: 'Database connection failed' }); }
});
app.get('/api/options', async (_req, res) => {
  try {
    const [utRows] = await pool.query('SELECT DISTINCT union_territory FROM disease_cases ORDER BY union_territory');
    const [diseaseRows] = await pool.query('SELECT DISTINCT disease FROM disease_cases ORDER BY disease');
    const territories = utRows.map(r => r.union_territory).filter(n => n !== 'Dadra and Nagar Haveli' && n !== 'Daman and Diu');
    if (utRows.some(r => r.union_territory === 'Dadra and Nagar Haveli') || utRows.some(r => r.union_territory === 'Daman and Diu')) territories.push('Dadra and Nagar Haveli and Daman and Diu');
    territories.sort((a,b) => a.localeCompare(b));
    res.json({ unionTerritories: territories, diseases: diseaseRows.map(r => r.disease), periods: Object.keys(PERIOD_TO_YEAR) });
  } catch (err) { res.status(500).json({ error: 'Could not load filter options. Check MySQL setup and database import.' }); }
});

app.get('/api/dashboard', async (req, res) => {
  const unionTerritory = String(req.query.unionTerritory || 'All');
  const disease = String(req.query.disease || 'All');
  const oldPeriod = String(req.query.oldPeriod || '2017-18');
  const newPeriod = String(req.query.newPeriod || '2019-20');
  if (!PERIOD_TO_YEAR[oldPeriod] || !PERIOD_TO_YEAR[newPeriod]) return res.status(400).json({ error: 'Period must be 2017-18 or 2019-20.' });
  if (oldPeriod === newPeriod) return res.status(400).json({ error: 'Choose two different periods for comparison.' });
  try {
    const years = [PERIOD_TO_YEAR[oldPeriod], PERIOD_TO_YEAR[newPeriod]];
    let where = 'year IN (?, ?)'; const params = [...years];
    if (unionTerritory !== 'All') {
      const names = normaliseUT(unionTerritory); where += ` AND union_territory IN (${names.map(() => '?').join(',')})`; params.push(...names);
    }
    if (disease !== 'All') { where += ' AND disease = ?'; params.push(disease); }
    const [rows] = await pool.query(`SELECT union_territory, year, disease, SUM(cases) AS cases FROM disease_cases WHERE ${where} GROUP BY union_territory, year, disease ORDER BY disease`, params);
    const diseaseMap = new Map();
    for (const row of rows) {
      if (!diseaseMap.has(row.disease)) diseaseMap.set(row.disease, { disease: row.disease, oldCases: 0, newCases: 0, oldRows: 0, newRows: 0 });
      const item = diseaseMap.get(row.disease);
      if (Number(row.year) === years[0]) { item.oldCases += Number(row.cases); item.oldRows++; }
      if (Number(row.year) === years[1]) { item.newCases += Number(row.cases); item.newRows++; }
    }
    const comparisons = [...diseaseMap.values()].map(d => ({
      ...d,
      difference: d.newCases - d.oldCases,
      growthPercent: d.oldCases === 0 ? null : Number((((d.newCases - d.oldCases) / d.oldCases) * 100).toFixed(2))
    }));
    const oldTotal = comparisons.reduce((s, d) => s + d.oldCases, 0);
    const newTotal = comparisons.reduce((s, d) => s + d.newCases, 0);
    const highest = [...comparisons].sort((a,b) => b.newCases - a.newCases)[0];
    const topOld = [...comparisons].sort((a,b) => b.oldCases - a.oldCases).slice(0,5);
    const topNew = [...comparisons].sort((a,b) => b.newCases - a.newCases).slice(0,5);
    const [tableRows] = await pool.query(`SELECT union_territory, disease, year, SUM(cases) AS cases FROM disease_cases WHERE ${where} GROUP BY union_territory, disease, year ORDER BY disease, union_territory, year`, params);
    res.json({ filters: { unionTerritory, disease, oldPeriod, newPeriod }, summary: {
      oldTotal, newTotal, difference: newTotal - oldTotal,
      growthPercent: oldTotal === 0 ? null : Number((((newTotal-oldTotal)/oldTotal)*100).toFixed(2)),
      highestDisease: highest ? highest.disease : 'N/A'
    }, comparisons, topOld, topNew, tableRows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not load dashboard data. Check database connection and disease_cases table.' });
  }
});

const port = Number(process.env.PORT || 5000);

async function startServer() {
  try {
    await pool.query('SELECT 1');
    console.log('\x1b[32m%s\x1b[0m', '✓ MySQL Database Connected Successfully');

    app.listen(port, () => {
      console.log('\x1b[32m%s\x1b[0m', `✓ Server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '✗ MySQL Database Connection Failed');
    console.error(error.message);
    process.exit(1);
  }
}

startServer();
