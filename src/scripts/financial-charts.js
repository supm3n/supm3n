// src/scripts/financial-charts.js

let mainChartInstance = null;
let subChartInstance = null;

// Helper to parse "Q3 25" labels from data
const getLabels = (data) => data.map(item => `${item.fp} ${item.fy.toString().slice(2)}`);

// Common Chart Options for consistency
const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: {
    mode: 'index',
    intersect: false,
  },
  plugins: {
    legend: {
      labels: {
        color: 'rgba(150, 150, 150, 1)',
        font: { family: 'monospace' }
      }
    },
    tooltip: {
      backgroundColor: 'rgba(20, 20, 20, 0.9)',
      titleColor: '#fff',
      bodyColor: '#ccc',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1
    }
  },
  scales: {
    x: {
      grid: { color: 'rgba(255, 255, 255, 0.05)' },
      ticks: { color: 'rgba(150, 150, 150, 0.8)' }
    },
    y: {
      grid: { color: 'rgba(255, 255, 255, 0.05)' },
      ticks: { color: 'rgba(150, 150, 150, 0.8)' }
    }
  }
};

export function destroyCharts() {
  if (mainChartInstance) {
    mainChartInstance.destroy();
    mainChartInstance = null;
  }
  if (subChartInstance) {
    subChartInstance.destroy();
    subChartInstance = null;
  }
}

// --- VIEW 1: GROWTH (Revenue vs Net Income + EPS) ---
export function renderGrowthView(data, containers) {
  const ctxMain = document.getElementById(containers.main);
  const ctxSub = document.getElementById(containers.sub1);
  if (!ctxMain || !ctxSub) return;

  const labels = getLabels(data);

  // Main: Revenue vs Net Income
  mainChartInstance = new Chart(ctxMain, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Revenue',
          data: data.map(d => d.revenue),
          backgroundColor: 'rgba(124, 58, 237, 0.6)', // Purple
          borderRadius: 4
        },
        {
          label: 'Net Income',
          data: data.map(d => d.net_income),
          backgroundColor: 'rgba(16, 185, 129, 0.8)', // Green
          borderRadius: 4
        }
      ]
    },
    options: commonOptions
  });

  // Sub: Diluted EPS (Line Chart)
  // KEY FIX: Mapping 'eps_diluted' correctly
  subChartInstance = new Chart(ctxSub, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Diluted EPS ($)',
        data: data.map(d => d.eps_diluted || 0), // Fallback to 0 if null
        borderColor: '#f59e0b', // Amber
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        tension: 0.3,
        fill: true,
        pointRadius: 3
      }]
    },
    options: commonOptions
  });
}

// --- VIEW 2: MARGINS (Operating vs Net + Efficiency) ---
export function renderMarginsView(data, containers) {
  const ctxMain = document.getElementById(containers.main);
  const ctxSub = document.getElementById(containers.sub1);
  if (!ctxMain || !ctxSub) return;

  const labels = getLabels(data);

  // Main: Margin % Trends
  // KEY FIX: Multiplying by 100 to show percentage, and mapping 'net_margin' / 'operating_margin'
  mainChartInstance = new Chart(ctxMain, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Operating Margin %',
          data: data.map(d => (d.operating_margin * 100).toFixed(1)),
          borderColor: '#3b82f6', // Blue
          tension: 0.2
        },
        {
          label: 'Net Margin %',
          data: data.map(d => (d.net_margin * 100).toFixed(1)),
          borderColor: '#10b981', // Green
          tension: 0.2
        }
      ]
    },
    options: commonOptions
  });

  // Sub: Profit Efficiency (Net Income as % of Revenue area chart)
  subChartInstance = new Chart(ctxSub, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Efficiency (Net Margin)',
        data: data.map(d => (d.net_margin * 100).toFixed(1)),
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      ...commonOptions,
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' }
        }
      }
    }
  });
}

// --- VIEW 3: CASH FLOW (OCF vs CapEx + FCF) ---
export function renderCashFlowView(data, containers) {
  const ctxMain = document.getElementById(containers.main);
  const ctxSub = document.getElementById(containers.sub1);
  if (!ctxMain || !ctxSub) return;

  const labels = getLabels(data);

  // Main: OCF vs CapEx
  mainChartInstance = new Chart(ctxMain, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Operating Cash Flow',
          data: data.map(d => d.operating_cash_flow),
          backgroundColor: '#0ea5e9', // Sky Blue
        },
        {
          label: 'CapEx',
          data: data.map(d => d.capital_expenditures ? d.capital_expenditures * -1 : 0), // Show as negative bars
          backgroundColor: '#f43f5e', // Rose Red
        }
      ]
    },
    options: {
      ...commonOptions,
      scales: {
        x: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });

  // Sub: Free Cash Flow Trend
  subChartInstance = new Chart(ctxSub, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Free Cash Flow',
        data: data.map(d => d.free_cash_flow),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderRadius: 4
      }]
    },
    options: commonOptions
  });
}