// ============================================
// Shared Theme Toggle
// ============================================

(function initTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const html = document.documentElement;
  
  // Get saved theme or system preference
  const savedTheme = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme) {
    html.setAttribute('data-theme', savedTheme);
  } else if (!systemPrefersDark) {
    html.setAttribute('data-theme', 'light');
  }
  
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const currentTheme = html.getAttribute('data-theme') || (systemPrefersDark ? 'dark' : 'light');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeIcon(newTheme);
    });
    
    // Update icon on load
    const currentTheme = html.getAttribute('data-theme') || (systemPrefersDark ? 'dark' : 'light');
    updateThemeIcon(currentTheme);
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        html.setAttribute('data-theme', e.matches ? 'dark' : 'light');
        updateThemeIcon(e.matches ? 'dark' : 'light');
      }
    });
  }
  
  function updateThemeIcon(theme) {
    if (!themeToggle) return;
    const icon = themeToggle.querySelector('svg');
    if (icon) {
      icon.innerHTML = theme === 'dark' 
        ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>'
        : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>';
    }
  }
})();

