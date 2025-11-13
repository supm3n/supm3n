// ============================================
// Shared Theme Toggle - Cookie-based for cross-subdomain sharing
// ============================================

(function bootstrapTheme() {
  // Prefer cookie (cross-subdomain), then localStorage, else system preference
  const match = document.cookie.match(/(?:^|;\s*)theme=(light|dark)\b/);
  let theme = match ? match[1] : null;

  if (!theme) {
    try { theme = localStorage.getItem('theme') || null; } catch (_) {}
  }
  if (!theme) {
    theme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark' : 'light';
  }

  // Apply ASAP to avoid flash
  document.documentElement.setAttribute('data-theme', theme);
})();

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('theme', theme); } catch (_) {}
  // Share across supm3n.com + subdomains
  document.cookie = `theme=${theme}; Max-Age=31536000; Path=/; Domain=.supm3n.com; SameSite=Lax`;
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

export function toggleTheme() {
  const curr = document.documentElement.getAttribute('data-theme') || 'light';
  setTheme(curr === 'dark' ? 'light' : 'dark');
}

// ============================================
// Theme Icon Updater
// ============================================

(function initThemeIcon() {
  function updateThemeToggleIcon(theme) {
    const toggle =
      document.getElementById('theme-toggle') ||
      document.getElementById('themeToggle') ||
      document.querySelector('[data-theme-toggle]');
    if (!toggle) return;

    const svg = toggle.querySelector('svg');
    if (!svg) return;

    svg.innerHTML =
      (theme || 'dark') === 'dark'
        ? '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>'
        : '<path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>';
  }

  // --- START OF FIX ---
  // Function to run on load
  function drawIcon() {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    updateThemeToggleIcon(currentTheme);
  }

  // Wait for the DOM to be ready before drawing the icon
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', drawIcon);
  } else {
    drawIcon(); // DOM is already ready
  }
  // --- END OF FIX ---
  
  // Listen for theme changes
  document.addEventListener('themechange', (event) => {
    updateThemeToggleIcon(event?.detail?.theme || document.documentElement.getAttribute('data-theme'));
  });
})();