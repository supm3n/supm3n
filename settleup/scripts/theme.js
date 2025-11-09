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

