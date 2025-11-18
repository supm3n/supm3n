// src/scripts/theme.js

(function bootstrapTheme() {
  const match = document.cookie.match(/(?:^|;\s*)theme=(light|dark)\b/);
  let theme = match ? match[1] : null;

  if (!theme) {
    try { theme = localStorage.getItem('theme') || null; } catch (_) {}
  }
  if (!theme) {
    theme = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)
      ? 'dark' : 'light';
  }

  document.documentElement.setAttribute('data-theme', theme);
})();

export function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try { localStorage.setItem('theme', theme); } catch (_) {}
  document.cookie = `theme=${theme}; Max-Age=31536000; Path=/; SameSite=Lax`;
  document.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
}

export function toggleTheme() {
  const curr = document.documentElement.getAttribute('data-theme') || 'light';
  setTheme(curr === 'dark' ? 'light' : 'dark');
}

export function initThemeIcon() {
  function updateThemeToggleIcon(theme) {
    const toggle =
      document.getElementById('theme-toggle') ||
      document.getElementById('themeToggle') ||
      document.querySelector('[data-theme-toggle]');
    if (!toggle) return;

    const sun = toggle.querySelector('.sun-icon');
    const moon = toggle.querySelector('.moon-icon');
    
    if (sun && moon) {
        if (theme === 'light') {
            sun.style.display = 'block';
            moon.style.display = 'none';
        } else {
            sun.style.display = 'none';
            moon.style.display = 'block';
        }
    }
  }

  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  updateThemeToggleIcon(currentTheme);

  document.addEventListener('themechange', (event) => {
    updateThemeToggleIcon(event?.detail?.theme || document.documentElement.getAttribute('data-theme'));
  });
}