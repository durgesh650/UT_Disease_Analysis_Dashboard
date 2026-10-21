'use strict';

// Frontend logic for the Union Territory Disease Analysis Dashboard.
// Page structure is defined in index.html. This file only loads data and updates elements.

const API_BASE = 'http://localhost:5000';
const PERIOD_YEAR = { '2017-18': 2017, '2019-20': 2019 };
const PAGE_TITLES = {
  home: 'Home',
  filters: 'Dashboard Filters',
  overview: 'Dashboard Overview',
  'top-diseases': 'Top 5 Diseases',
  'cases-by-disease': 'Cases by Disease',
  trends: 'Disease Trends & Growth',
  'data-table': 'Data Table'
};

const DEFAULT_FILTERS = {
  unionTerritory: 'All',
  disease: 'All',
  oldPeriod: '2017-18',
  newPeriod: '2019-20'
};

let options = {
  unionTerritories: [],
  diseases: [],
  periods: ['2017-18', '2019-20']
};
let draftFilters = { ...DEFAULT_FILTERS };
let appliedFilters = { ...DEFAULT_FILTERS };
let dashboard = null;
let currentPage = 'home';
let noticeTimer;
const chartInstances = {};
const CHART_COLORS = {
  old: '#3577f6',
  newer: '#17a99a',
  extra: ['#3577f6', '#17a99a', '#f5a623', '#8b6ce8', '#e16b83', '#37a6c8', '#83b84b', '#ef8e45', '#63708a', '#bc77b9']
};

// Small helpers keep repeated tasks consistent and beginner-friendly.
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const number = value => Number(value || 0).toLocaleString('en-IN');
const pctText = value => value === null || value === undefined
  ? 'N/A'
  : `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

function showNotice(message, isError = false) {
  const notice = $('#notice');
  notice.textContent = message;
  notice.classList.remove('hidden', 'error');

  if (isError) notice.classList.add('error');
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => notice.classList.add('hidden'), 6500);
}

// Request JSON from the Express API and show a useful error for failed requests.
async function getJSON(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }
  return data;
}

// Add options to an existing select element without generating HTML strings.
function fillSelect(selectElement, items, selectedValue, firstLabel) {
  selectElement.replaceChildren();

  const firstOption = document.createElement('option');
  firstOption.value = 'All';
  firstOption.textContent = firstLabel;
  selectElement.appendChild(firstOption);

  items.forEach(item => {
    const option = document.createElement('option');
    option.value = item;
    option.textContent = item;
    selectElement.appendChild(option);
  });

  selectElement.value = selectedValue;
}

function renderFilters() {
  fillSelect($('#unionTerritory'), options.unionTerritories, draftFilters.unionTerritory, 'All Union Territories');
  fillSelect($('#disease'), options.diseases, draftFilters.disease, 'All Diseases');
  $('#oldPeriod').value = draftFilters.oldPeriod;
  $('#newPeriod').value = draftFilters.newPeriod;
  $('#applied-filter-summary').textContent = filterSummary();
}

async function loadOptions() {
  try {
    options = await getJSON(`${API_BASE}/api/options`);
    $('#api-status').textContent = 'API connected';
    $('.status-dot').style.background = '#27c69b';
  } catch (error) {
    $('#api-status').textContent = 'API not connected';
    $('.status-dot').style.background = '#f5a623';
    showNotice('Backend API is not reachable. Start the Node.js server and confirm MySQL is running. Filters and charts need the API.', true);
    options = { unionTerritories: [], diseases: [], periods: ['2017-18', '2019-20'] };
  }
  renderFilters();
}

// Fetch data only when Submit or Reset is pressed. The backend API stays unchanged.
async function fetchDashboard(filters = appliedFilters) {
  const query = new URLSearchParams(filters).toString();
  dashboard = await getJSON(`${API_BASE}/api/dashboard?${query}`);
  appliedFilters = { ...filters };
  renderCurrentPage();
  return dashboard;
}

function filterSummary() {
  const territory = appliedFilters.unionTerritory === 'All'
    ? 'All Union Territories'
    : appliedFilters.unionTerritory;
  const disease = appliedFilters.disease === 'All' ? 'All Diseases' : appliedFilters.disease;
  return `${territory} · ${disease} · ${appliedFilters.oldPeriod} vs ${appliedFilters.newPeriod}`;
}

function setContentVisibility(elementId, shouldShow) {
  $(`#${elementId}`).classList.toggle('hidden', !shouldShow);
}

function renderOverview() {
  const hasData = Boolean(dashboard);
  setContentVisibility('overview-empty', !hasData);
  setContentVisibility('overview-content', hasData);
  $('#overview-kicker').textContent = hasData ? 'Analysis results' : 'Dashboard';
  $('#overview-description').textContent = hasData ? filterSummary() : 'Apply filters to load your comparison.';

  if (!hasData) return;

  const summary = dashboard.summary;
  $('#old-total').textContent = number(summary.oldTotal);
  $('#new-total').textContent = number(summary.newTotal);
  $('#old-period-label').textContent = `Reporting period ${appliedFilters.oldPeriod}`;
  $('#new-period-label').textContent = `Reporting period ${appliedFilters.newPeriod}`;
  $('#growth-percent').textContent = pctText(summary.growthPercent);
  $('#case-difference').textContent = `${number(summary.difference)} net case difference`;
  $('#change-icon').textContent = summary.difference >= 0 ? '↗' : '↘';
  $('#highest-disease').textContent = summary.highestDisease;
  $('#overview-old-legend').textContent = appliedFilters.oldPeriod;
  $('#overview-new-legend').textContent = appliedFilters.newPeriod;
  $('#disease-category-count').textContent = dashboard.comparisons.length;
  $('#overview-period-tag').textContent = `${appliedFilters.oldPeriod} → ${appliedFilters.newPeriod}`;
}

function renderTopDiseases() {
  const hasData = Boolean(dashboard);
  setContentVisibility('top-diseases-content', hasData);
  $('#top-diseases-description').textContent = !hasData
    ? 'Submit dashboard filters to view period-wise rankings.'
    : appliedFilters.disease !== 'All'
      ? `Showing ${appliedFilters.disease} for ${appliedFilters.unionTerritory === 'All' ? 'all Union Territories' : appliedFilters.unionTerritory}; the selected disease filter takes priority over the top-five ranking.`
      : `Top five diseases for ${appliedFilters.unionTerritory === 'All' ? 'all Union Territories' : appliedFilters.unionTerritory}, compared across both selected periods.`;

  if (hasData) {
    $('#top-old-legend').textContent = appliedFilters.oldPeriod;
    $('#top-new-legend').textContent = appliedFilters.newPeriod;
  }
}

function renderCasesByDisease() {
  const hasData = Boolean(dashboard);
  setContentVisibility('cases-content', hasData);
  $('#cases-description').textContent = hasData
    ? `Compare ${appliedFilters.oldPeriod} and ${appliedFilters.newPeriod} cases for the applied filters.`
    : 'Submit dashboard filters to view the comparison.';

  if (hasData) {
    $('#cases-chart-description').textContent = `Recorded cases in ${appliedFilters.oldPeriod} versus ${appliedFilters.newPeriod}.`;
  }
}

function renderTrends() {
  const hasData = Boolean(dashboard);
  setContentVisibility('trends-content', hasData);
  $('#trends-description').textContent = hasData
    ? 'A single trend graph shows total recorded cases across the two available reporting periods.'
    : 'Submit dashboard filters to calculate changes.';

  if (!hasData) return;

  const summary = dashboard.summary;
  $('#trend-growth-value').textContent = pctText(summary.growthPercent);
  $('#trend-growth-description').textContent = `From ${appliedFilters.oldPeriod} to ${appliedFilters.newPeriod}, the filtered total changed by ${number(summary.difference)} cases.`;
  $('#trend-highest-disease').textContent = summary.highestDisease;
}

// Build table rows with DOM methods; the table structure itself stays in index.html.
function renderDataTable() {
  const hasData = Boolean(dashboard);
  setContentVisibility('data-table-content', hasData);
  setContentVisibility('table-export-actions', hasData);
  $('#table-description').textContent = hasData
    ? 'Disease-level summary and report downloads for the applied filters.'
    : 'Submit filters to view data.';

  if (!hasData) return;

  const rows = dashboard.comparisons || [];
  $('#table-summary').textContent = `${filterSummary()} · ${rows.length} disease categories`;
  $('#old-table-heading').textContent = `${appliedFilters.oldPeriod} cases`;
  $('#new-table-heading').textContent = `${appliedFilters.newPeriod} cases`;

  const tableBody = $('#comparison-table-body');
  tableBody.replaceChildren();

  if (rows.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 5;
    cell.className = 'empty-state';
    cell.textContent = 'No matching records.';
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }

  rows.forEach(item => {
    const row = document.createElement('tr');
    row.appendChild(createTextCell(item.disease));
    row.appendChild(createNumberCell(item.oldCases));
    row.appendChild(createNumberCell(item.newCases));

    const differenceCell = createNumberCell(`${item.difference > 0 ? '+' : ''}${number(item.difference)}`);
    if (item.difference > 0) differenceCell.classList.add('growth-up');
    if (item.difference < 0) differenceCell.classList.add('growth-down');
    row.appendChild(differenceCell);

    const growthCell = createNumberCell(pctText(item.growthPercent));
    if (item.growthPercent > 0) growthCell.classList.add('growth-up');
    else if (item.growthPercent < 0) growthCell.classList.add('growth-down');
    else growthCell.classList.add('growth-neutral');
    row.appendChild(growthCell);
    tableBody.appendChild(row);
  });
}

function createTextCell(value) {
  const cell = document.createElement('td');
  cell.textContent = value ?? '';
  return cell;
}

function createNumberCell(value) {
  const cell = document.createElement('td');
  cell.className = 'number-cell';
  cell.textContent = value;
  return cell;
}

function renderCurrentPage() {
  // Destroy charts before updating their data so old charts do not remain on screen.
  Object.values(chartInstances).forEach(chart => {
    if (chart) chart.destroy();
  });
  Object.keys(chartInstances).forEach(key => delete chartInstances[key]);

  renderFilters();
  renderOverview();
  renderTopDiseases();
  renderCasesByDisease();
  renderTrends();
  renderDataTable();
  setTimeout(drawCharts, 60);
}

function navigatePage(direction) {
  const pages = Object.keys(PAGE_TITLES);
  const currentIndex = pages.indexOf(currentPage);
  const nextIndex = Math.min(pages.length - 1, Math.max(0, currentIndex + direction));
  location.hash = pages[nextIndex];
}

function updatePageNavigation() {
  const pages = Object.keys(PAGE_TITLES);
  const index = pages.indexOf(currentPage);
  $('#page-counter').textContent = `Page ${index + 1} of ${pages.length}`;
  $('#go-previous').disabled = index === 0;
  $('#go-next').disabled = index === pages.length - 1;
}

function setPage(page) {
  if (!PAGE_TITLES[page]) page = 'home';
  currentPage = page;

  $$('.page').forEach(section => {
    section.classList.toggle('hidden', section.id !== `page-${page}`);
  });
  $$('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.page === page);
  });

  $('#page-title').textContent = PAGE_TITLES[page];
  updatePageNavigation();
  $('#sidebar').classList.remove('open');
  setTimeout(drawCharts, 80);
}

function drawCharts() {
  if (!dashboard || typeof Chart === 'undefined') return;

  const visiblePage = document.querySelector(`#page-${currentPage}`);
  if (!visiblePage) return;
  const canvas = visiblePage.querySelector('canvas');
  if (!canvas) return;

  if (chartInstances[canvas.id]) {
    chartInstances[canvas.id].resize();
    return;
  }

  const oldLabel = appliedFilters.oldPeriod;
  const newLabel = appliedFilters.newPeriod;
  const comparisons = dashboard.comparisons || [];
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: {
        position: 'bottom',
        labels: { usePointStyle: true, boxWidth: 8, padding: 18, font: { family: 'DM Sans', size: 11 } }
      },
      tooltip: {
        callbacks: {
          label: context => `${context.dataset.label || context.label}: ${Number(context.raw || 0).toLocaleString('en-IN')}`
        }
      }
    }
  };

  let config;

  if (canvas.id === 'overview-chart') {
    config = {
      type: 'bar',
      data: {
        labels: comparisons.map(item => item.disease),
        datasets: [
          { label: oldLabel, data: comparisons.map(item => Number(item.oldCases)), backgroundColor: CHART_COLORS.old, borderRadius: 5, maxBarThickness: 34 },
          { label: newLabel, data: comparisons.map(item => Number(item.newCases)), backgroundColor: CHART_COLORS.newer, borderRadius: 5, maxBarThickness: 34 }
        ]
      },
      options: {
        ...baseOptions,
        scales: {
          x: { ticks: { autoSkip: false, maxRotation: 55, minRotation: 35, font: { size: 10 } }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { callback: value => Number(value).toLocaleString('en-IN') }, title: { display: true, text: 'Recorded cases' } }
        }
      }
    };
  } else if (canvas.id === 'top-five-chart') {
    const topNames = [...new Set([
      ...(dashboard.topOld || []).map(item => item.disease),
      ...(dashboard.topNew || []).map(item => item.disease)
    ])];
    const lookup = new Map(comparisons.map(item => [item.disease, item]));
    const ordered = topNames.map(name => lookup.get(name)).filter(Boolean)
      .sort((first, second) => Math.max(second.oldCases, second.newCases) - Math.max(first.oldCases, first.newCases));

    config = {
      type: 'bar',
      data: {
        labels: ordered.map(item => item.disease),
        datasets: [
          { label: oldLabel, data: ordered.map(item => Number(item.oldCases)), backgroundColor: CHART_COLORS.old, borderRadius: 5, maxBarThickness: 42 },
          { label: newLabel, data: ordered.map(item => Number(item.newCases)), backgroundColor: CHART_COLORS.newer, borderRadius: 5, maxBarThickness: 42 }
        ]
      },
      options: {
        ...baseOptions,
        scales: {
          x: { ticks: { autoSkip: false, maxRotation: 30, minRotation: 0, font: { size: 11 } }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { callback: value => Number(value).toLocaleString('en-IN') }, title: { display: true, text: 'Recorded cases' } }
        }
      }
    };
  } else if (canvas.id === 'disease-distribution-chart') {
    const items = [...comparisons].sort((first, second) =>
      Math.max(second.oldCases, second.newCases) - Math.max(first.oldCases, first.newCases)
    );
    config = {
      type: 'bar',
      data: {
        labels: items.map(item => item.disease),
        datasets: [
          { label: oldLabel, data: items.map(item => Number(item.oldCases)), backgroundColor: CHART_COLORS.old, borderRadius: 5, maxBarThickness: 38 },
          { label: newLabel, data: items.map(item => Number(item.newCases)), backgroundColor: CHART_COLORS.newer, borderRadius: 5, maxBarThickness: 38 }
        ]
      },
      options: {
        ...baseOptions,
        scales: {
          x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 0, font: { size: 10 } }, grid: { display: false } },
          y: { beginAtZero: true, ticks: { callback: value => Number(value).toLocaleString('en-IN') }, title: { display: true, text: 'Recorded cases' } }
        }
      }
    };
  } else if (canvas.id === 'trend-chart') {
    config = {
      type: 'line',
      data: {
        labels: [oldLabel, newLabel],
        datasets: [{
          label: 'Total recorded cases',
          data: [Number(dashboard.summary.oldTotal), Number(dashboard.summary.newTotal)],
          borderColor: CHART_COLORS.old,
          backgroundColor: '#3577f622',
          pointBackgroundColor: [CHART_COLORS.old, CHART_COLORS.newer],
          pointRadius: 6,
          pointHoverRadius: 8,
          borderWidth: 3,
          tension: 0.25,
          fill: true
        }]
      },
      options: {
        ...baseOptions,
        plugins: { ...baseOptions.plugins, legend: { display: false } },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { callback: value => Number(value).toLocaleString('en-IN') }, title: { display: true, text: 'Total recorded cases' } }
        }
      }
    };
  }

  if (config) chartInstances[canvas.id] = new Chart(canvas, config);
}

function exportCSV() {
  if (!dashboard) {
    showNotice('Apply filters before exporting.', true);
    return;
  }

  const rows = [[
    'Union Territory', 'Disease', 'Old Period', 'Old Cases',
    'New Period', 'New Cases', 'Difference', 'Growth Percent'
  ]];

  dashboard.comparisons.forEach(item => {
    rows.push([
      appliedFilters.unionTerritory,
      item.disease,
      appliedFilters.oldPeriod,
      item.oldCases,
      appliedFilters.newPeriod,
      item.newCases,
      item.difference,
      item.growthPercent === null ? 'N/A' : item.growthPercent
    ]);
  });

  // Escape quotes so disease names or labels cannot break the CSV columns.
  const csv = rows.map(row => row
    .map(value => `"${String(value ?? '').replace(/"/g, '""')}"`)
    .join(',')
  ).join('\r\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = `disease-comparison-${appliedFilters.oldPeriod}-vs-${appliedFilters.newPeriod}.csv`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  downloadLink.remove();
  URL.revokeObjectURL(url);
  showNotice('CSV report exported.');
}

function exportPDF() {
  if (!dashboard) {
    showNotice('Apply filters before exporting.', true);
    return;
  }

  if (!window.jspdf || !window.jspdf.jsPDF) {
    showNotice('PDF library could not load. Check your internet connection and try again.', true);
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const left = 14;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const rows = dashboard.comparisons || [];
  const columns = [
    { title: 'Disease', x: left, width: 70 },
    { title: `${appliedFilters.oldPeriod} Cases`, x: 88, width: 35 },
    { title: `${appliedFilters.newPeriod} Cases`, x: 130, width: 35 },
    { title: 'Difference', x: 172, width: 35 },
    { title: 'Change %', x: 214, width: 35 }
  ];

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(16);
  pdf.text('Union Territory Disease Analysis Report', left, 16);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.text(`Filters: ${filterSummary()}`, left, 23);
  pdf.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, left, 29);

  let y = 39;
  const drawHeader = () => {
    pdf.setFillColor(17, 94, 89);
    pdf.rect(left - 2, y - 5, pageWidth - left * 2 + 4, 9, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    columns.forEach(column => pdf.text(column.title, column.x, y));
    pdf.setTextColor(35, 45, 55);
    pdf.setFont('helvetica', 'normal');
    y += 8;
  };

  drawHeader();
  rows.forEach(item => {
    if (y > pageHeight - 14) {
      pdf.addPage();
      y = 18;
      drawHeader();
    }

    const values = [
      String(item.disease ?? ''),
      number(item.oldCases),
      number(item.newCases),
      `${item.difference > 0 ? '+' : ''}${number(item.difference)}`,
      pctText(item.growthPercent)
    ];

    columns.forEach((column, index) => {
      const text = pdf.splitTextToSize(values[index], column.width - 3);
      pdf.text(text, column.x, y);
    });
    pdf.setDrawColor(225, 232, 235);
    pdf.line(left - 2, y + 2, pageWidth - left + 2, y + 2);
    y += 8;
  });

  const filename = `disease-comparison-${appliedFilters.oldPeriod}-vs-${appliedFilters.newPeriod}.pdf`;
  pdf.save(filename);
  showNotice('PDF report downloaded.');
}

// Filter form events are registered once; the HTML form is not rebuilt in JavaScript.
$('#filter-form').addEventListener('submit', async event => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const nextFilters = {
    unionTerritory: formData.get('unionTerritory'),
    disease: formData.get('disease'),
    oldPeriod: String(formData.get('oldPeriod')).trim(),
    newPeriod: String(formData.get('newPeriod')).trim()
  };
  const feedback = $('#filter-feedback');

  if (!PERIOD_YEAR[nextFilters.oldPeriod] || !PERIOD_YEAR[nextFilters.newPeriod]) {
    feedback.textContent = 'Use 2017-18 or 2019-20 in both boxes.';
    showNotice('Invalid period. This dataset supports 2017-18 and 2019-20 only.', true);
    return;
  }
  if (nextFilters.oldPeriod === nextFilters.newPeriod) {
    feedback.textContent = 'Choose two different periods.';
    showNotice('Old Period and New Period must be different.', true);
    return;
  }

  feedback.textContent = 'Loading…';
  draftFilters = { ...nextFilters };
  try {
    await fetchDashboard(nextFilters);
    feedback.textContent = '';
    location.hash = 'overview';
    showNotice('Filters applied. Dashboard results have been updated.');
  } catch (error) {
    feedback.textContent = '';
    showNotice(error.message, true);
  }
});

$('#reset-filters').addEventListener('click', async () => {
  draftFilters = { ...DEFAULT_FILTERS };
  renderFilters();
  $('#filter-feedback').textContent = '';

  try {
    await fetchDashboard({ ...DEFAULT_FILTERS });
    location.hash = 'overview';
    showNotice('Filters reset to the default period comparison.');
  } catch (error) {
    showNotice(error.message, true);
  }
});

$('#menu-toggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$('#table-csv').addEventListener('click', exportCSV);
$('#table-pdf').addEventListener('click', exportPDF);
$('#go-home').addEventListener('click', () => { location.hash = 'home'; });
$('#go-previous').addEventListener('click', () => navigatePage(-1));
$('#go-next').addEventListener('click', () => navigatePage(1));
window.addEventListener('hashchange', () => setPage(location.hash.replace('#', '') || 'home'));
window.addEventListener('resize', () => drawCharts());

// Start the page, load filter options, and then request the default comparison.
async function initialiseDashboard() {
  renderFilters();
  setPage(location.hash.replace('#', '') || 'home');
  await loadOptions();

  try {
    await fetchDashboard(appliedFilters);
  } catch (error) {
    showNotice(error.message, true);
  }
  setPage(location.hash.replace('#', '') || 'home');
}

initialiseDashboard();
