// Robust stock viewer script
const input = document.getElementById('symbol') || document.querySelector('input[type="text"], input');
const selectEl = document.getElementById('symbol-select') || document.querySelector('select');
const loadBtn = document.getElementById('load') || document.querySelector('button');
const ctx = document.getElementById('chart')?.getContext('2d');
let chart;

function normalizeSymbol(raw){
  let s = String(raw || '').trim().toUpperCase();
  if (s === 'APPL') s = 'AAPL';
  return s;
}

function getSymbol(){
  // Check input field first (for custom symbols), then dropdown
  const fromInput = input && input.value ? input.value.trim() : '';
  const fromSelect = selectEl && selectEl.value && selectEl.value !== '' && selectEl.value !== 'placeholder' ? selectEl.value : '';
  // If input has a value, use it; otherwise use dropdown
  const base = fromInput || fromSelect || '';
  return normalizeSymbol(base);
}

function pickSeries(json){
  return json['Time Series (Daily)']
      || json['Time Series (Digital Currency Daily)']
      || json['Time Series (5min)']
      || json['Time Series (60min)']
      || null;
}

function toRows(series){
  const rows = Object.entries(series).map(([date, o]) => ({
    date,
    close: Number(o['4. close'] || o['4a. close (USD)'] || o['5. adjusted close'] || 0)
  }));
  rows.sort((a,b)=> new Date(a.date) - new Date(b.date));
  return rows;
}

function showError(msg){
  let el = document.getElementById('error-banner');
  if(!el){
    el = document.createElement('div');
    el.id = 'error-banner';
    (document.querySelector('main.container') || document.body).prepend(el);
  }
  el.textContent = msg;
  el.style.display = 'block';
}

function clearError(){
  const el = document.getElementById('error-banner');
  if (el) {
    el.textContent = '';
    el.style.display = 'none';
  }
}

async function fetchSymbol(symbol){
  const r = await fetch(`/api/price/${encodeURIComponent(symbol)}`, { cache:'no-store' });
  const text = await r.text();
  let json;
  try { 
    json = JSON.parse(text); 
  } catch(e) {
    console.error('Non-JSON response from API', { status: r.status, text: text.slice(0, 300) });
    throw new Error(`Unexpected response from server (HTTP ${r.status}). The API may be experiencing issues. Please try again later.`);
  }
  
  // Handle error responses (non-2xx status codes)
  if (!r.ok) {
    // Try to extract error message from response
    let errorMessage = 'Unknown error occurred';
    
    if (json.message) {
      errorMessage = json.message;
      // Append suggestion if available (e.g., for rate limits)
      if (json.suggestion) {
        errorMessage += ` ${json.suggestion}`;
      }
    } else if (json.Note) {
      errorMessage = json.Note;
    } else if (json['Error Message']) {
      errorMessage = json['Error Message'];
    } else if (json.error && json.error !== 'information') {
      errorMessage = json.error;
    } else if (r.status === 429) {
      errorMessage = 'Rate limit exceeded. The free Alpha Vantage API allows 25 requests per day. Please try again tomorrow or upgrade to a premium API key.';
    } else if (r.status === 500) {
      errorMessage = 'Server error: API key may be missing or invalid. Please contact the site administrator.';
    } else if (r.status === 502) {
      errorMessage = json.message || 'Service temporarily unavailable. The stock data service may be down.';
    } else {
      errorMessage = `HTTP ${r.status}: ${json.error || 'Request failed'}`;
    }
    
    // Log detailed error for debugging (includes cache status if available)
    const cacheStatus = r.headers.get('X-Cache-Status');
    console.error('API Error:', {
      status: r.status,
      statusText: r.statusText,
      error: json.error,
      message: json.message,
      suggestion: json.suggestion,
      code: json.code,
      cacheStatus: cacheStatus,
      fullResponse: json
    });

    console.error('About to throw error with message:', errorMessage);
    throw new Error(errorMessage);
  }
  
  // Log cache status for successful responses (helps with debugging)
  const cacheStatus = r.headers.get('X-Cache-Status');
  if (cacheStatus) {
    console.log(`Cache ${cacheStatus} for ${symbol}`);
  }
  
  // Check for error indicators in successful responses (shouldn't happen, but handle gracefully)
  if (json.Note) {
    throw new Error(json.Note);
  }
  if (json['Error Message']) {
    throw new Error(json['Error Message']);
  }
  
  // Extract time series data
  const series = pickSeries(json);
  if(!series || !Object.keys(series).length) {
    // Log what we received to help debug
    console.error('No time series data found in response:', {
      keys: Object.keys(json),
      sample: JSON.stringify(json).slice(0, 500)
    });
    throw new Error('No data available. The stock symbol may be invalid or the API may not have data for this symbol.');
  }
  
  return toRows(series);
}

function render(rows, symbol){
  if(!ctx) return;
  const labels = rows.map(r=>r.date);
  const data = rows.map(r=>r.close);
  if(chart){ chart.destroy(); }
  chart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ label: symbol.toUpperCase(), data, fill:false, tension:.2 }] },
    options: {
      maintainAspectRatio: false,
      responsive: true,
      interaction: { mode:'index', intersect:false },
      plugins: { legend: { display: true }, title: { display: false } },
      scales: { x: { ticks: { maxTicksLimit: 12 } }, y: { beginAtZero: false } }
    }
  });
}

async function load(){
  clearError();
  const symbol = getSymbol();
  if(!symbol){ 
    showError('Please select a stock from the dropdown or enter a symbol in the search field.'); 
    return; 
  }
  try{
    if (loadBtn) { loadBtn.disabled = true; loadBtn.textContent = 'Loading…'; }
    history.replaceState({}, '', `?symbol=${encodeURIComponent(symbol)}`);
    const rows = await fetchSymbol(symbol);
    render(rows, symbol);
  }catch(err){
    showError(`Error loading ${symbol}: ${err.message || err}`);
  }finally{
    if (loadBtn) { loadBtn.disabled = false; loadBtn.textContent = 'Load Chart'; }
  }
}

// Only load when "Load Chart" button is clicked
if (loadBtn) loadBtn.addEventListener('click', load);

// Allow Enter key to trigger load from input field
if (input) input.addEventListener('keydown', (e)=>{ 
  if(e.key==='Enter') {
    e.preventDefault();
    load(); 
  }
});

// Dropdown and input work independently - no auto-loading
// User must click "Load Chart" to fetch data
