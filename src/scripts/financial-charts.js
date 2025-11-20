// src/scripts/financial-charts.js
// Note: We assume Chart.js is loaded via CDN in the layout

let charts = {};

const THEME = {
  rev: "#3B82F6",  // Blue
  net: "#10B981",  // Green
  loss: "#EF4444", // Red
  accent: "#8B5CF6", // Purple
  grid: "rgba(255, 255, 255, 0.05)",
  text: "#94a3b8",
  font: "JetBrains Mono, monospace"
};

const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: {
    legend: { labels: { color: THEME.text, font: { family: THEME.font } } },
    tooltip: {
      backgroundColor: 'rgba(11, 12, 16, 0.95)',
      titleColor: '#fff',
      bodyColor: '#e2e8f0',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
      callbacks: {
        label: function (context) {
          let label = context.dataset.label || '';
          if (label) label += ': ';
          let value = context.parsed.y;

          // Format billions/millions
          if (Math.abs(value) >= 1e9) {
            return label + '$' + (value / 1e9).toFixed(2) + 'B';
          } else if (Math.abs(value) >= 1e6) {
            return label + '$' + (value / 1e6).toFixed(2) + 'M';
          } else if (context.dataset.yAxisID === 'percentage') {
            return label + value.toFixed(2) + '%';
          }
          return label + value;
        }
      }
    }
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: THEME.text, font: { family: THEME.font, size: 11 } }
    },
    y: {
      grid: { color: THEME.grid },
      ticks: {
        color: THEME.text,
        font: { family: THEME.font, size: 11 },
        callback: function (value) {
          if (Math.abs(value) >= 1e9) return '$' + (value / 1e9).toFixed(0) + 'B';
          if (Math.abs(value) >= 1e6) return '$' + (value / 1e6).toFixed(0) + 'M';
          return value;
        }
      }
    }
  }
};

export function destroyCharts() {
  Object.values(charts).forEach(chart => chart.destroy());
  charts = {};
}

export function renderGrowthView(data, containers) {
  const labels = data.map(d => `${d.fp} ${d.fy}`);

  // 1. Revenue vs Net Income (Mixed Bar/Line)
  const ctx1 = document.getElementById(containers.main).getContext('2d');
  charts.main = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Revenue',
          data: data.map(d => d.revenue),
          backgroundColor: 'rgba(59, 130, 246, 0.8)',
          borderRadius: 4,
          order: 2
        },
        {
          label: 'Net Income',
          data: data.map(d => d.net_income),
          borderColor: THEME.net,
          backgroundColor: THEME.net,
          type: 'line',
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 2,
          order: 1
        }
      ]
    },
    options: commonOptions
  });

  // 2. EPS
  const ctx2 = document.getElementById(containers.sub1).getContext('2d');
  charts.sub1 = new Chart(ctx2, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Diluted EPS',
        data: data.map(d => d.diluted_eps),
        borderColor: THEME.accent,
        backgroundColor: 'rgba(139, 92, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 0,
        pointHoverRadius: 4
      }]
    },
    options: {
      ...commonOptions,
      scales: {
        ...commonOptions.scales,
        y: { ...commonOptions.scales.y, ticks: { color: THEME.text, callback: v => '$' + v } }
      }
    }
  });
}

export function renderMarginsView(data, containers) {
  const labels = data.map(d => `${d.fp} ${d.fy}`);

  const ctx1 = document.getElementById(containers.main).getContext('2d');
  charts.main = new Chart(ctx1, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Operating Margin', data: data.map(d => d.operating_margin * 100), borderColor: THEME.rev, tension: 0.3 },
        { label: 'Net Margin', data: data.map(d => d.net_margin * 100), borderColor: THEME.net, tension: 0.3 }
      ]
    },
    options: {
      ...commonOptions,
      scales: {
        ...commonOptions.scales,
        y: { ticks: { color: THEME.text, callback: v => v + '%' }, grid: { color: THEME.grid } }
      }
    }
  });
}

export function renderCashFlowView(data, containers) {
  const labels = data.map(d => `${d.fp} ${d.fy}`);

  const ctx1 = document.getElementById(containers.main).getContext('2d');
  charts.main = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Operating Cash Flow', data: data.map(d => d.operating_cash_flow), backgroundColor: THEME.net },
        { label: 'CapEx', data: data.map(d => -Math.abs(d.capex)), backgroundColor: THEME.loss } // Show CapEx as negative
      ]
    },
    options: commonOptions
  });

  const ctx2 = document.getElementById(containers.sub1).getContext('2d');
  charts.sub1 = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Free Cash Flow',
        data: data.map(d => d.free_cash_flow),
        backgroundColor: THEME.accent,
        borderRadius: 4
      }]
    },
    options: commonOptions
  });
}