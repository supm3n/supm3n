// ============================================
// Theme Icon Updater (listens to shared theme module)
// ============================================

/*(function initThemeIcon() {
  function updateThemeIcon(theme) {
    const themeToggle = document.getElementById('theme-toggle') || document.getElementById('themeToggle');
    if (!themeToggle) return;
    const icon = themeToggle.querySelector('svg');
    if (icon) {
      icon.innerHTML = theme === 'dark' 
        ? '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>'
        : '<path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>';
    }
  }
  
  // Update icon on load
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  updateThemeIcon(currentTheme);
  
  // Listen to theme changes from shared module
  document.addEventListener('themechange', (e) => {
    updateThemeIcon(e.detail.theme);
  });
})();*/

// ============================================
// Sticky Header (Hide on scroll down, show on scroll up)
// ============================================

(function initStickyHeader() {
  const header = document.querySelector('.site-header');
  if (!header) return;
  
  let lastScroll = 0;
  let ticking = false;
  
  function updateHeader() {
    const currentScroll = window.pageYOffset || document.documentElement.scrollTop;
    
    if (currentScroll <= 0) {
      header.classList.remove('hidden');
    } else if (currentScroll > lastScroll && currentScroll > 100) {
      // Scrolling down
      header.classList.add('hidden');
    } else {
      // Scrolling up
      header.classList.remove('hidden');
    }
    
    lastScroll = currentScroll;
    ticking = false;
  }
  
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(updateHeader);
      ticking = true;
    }
  }, { passive: true });
})();

// ============================================
// Scroll Reveal
// ============================================

(function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length === 0) return;
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });
  
  reveals.forEach(el => observer.observe(el));
})();

// ============================================
// Command Palette (Cmd/Ctrl + K)
// ============================================

(function initCommandPalette() {
  const palette = document.getElementById('command-palette');
  const input = document.getElementById('command-input');
  const results = document.getElementById('command-results');
  
  if (!palette || !input || !results) return;
  
  const commands = [
    { title: 'Home', url: '/', desc: 'Go to homepage' },
    { title: 'Projects', url: '/projects', desc: 'View all projects' },
    { title: 'Uses', url: '/uses', desc: 'My gear and software stack' },
    // { title: 'Now', url: '/now', desc: 'What I\'m working on now' },
    // { title: 'Contact', url: '/contact', desc: 'Get in touch' },
  ];
  
  let selectedIndex = -1;
  let filteredCommands = [];
  
  function openPalette() {
    palette.classList.add('active');
    input.value = '';
    input.focus();
    filterCommands('');
  }
  
  function closePalette() {
    palette.classList.remove('active');
    selectedIndex = -1;
  }
  
  function filterCommands(query) {
    const q = query.toLowerCase().trim();
    filteredCommands = commands.filter(cmd => 
      cmd.title.toLowerCase().includes(q) || 
      cmd.desc.toLowerCase().includes(q)
    );
    
    // Also search project titles if available
    const projectCards = document.querySelectorAll('.project-card');
    projectCards.forEach(card => {
      const title = card.querySelector('.project-title')?.textContent || '';
      const url = card.querySelector('.project-card-link')?.href || '';
      if (title.toLowerCase().includes(q)) {
        filteredCommands.push({
          title: title,
          url: url,
          desc: 'Open project'
        });
      }
    });
    
    renderResults();
  }
  
  function renderResults() {
    results.innerHTML = '';
    
    if (filteredCommands.length === 0) {
      results.innerHTML = '<div class="command-item"><div class="command-item-desc">No results found</div></div>';
      return;
    }
    
    filteredCommands.forEach((cmd, index) => {
      const item = document.createElement('div');
      item.className = 'command-item';
      if (index === selectedIndex) {
        item.classList.add('selected');
      }
      item.innerHTML = `
        <div>
          <div class="command-item-title">${cmd.title}</div>
          <div class="command-item-desc">${cmd.desc}</div>
        </div>
      `;
      item.addEventListener('click', () => {
        window.location.href = cmd.url;
      });
      results.appendChild(item);
    });
  }
  
  function navigate(direction) {
    if (filteredCommands.length === 0) return;
    
    if (direction === 'down') {
      selectedIndex = (selectedIndex + 1) % filteredCommands.length;
    } else {
      selectedIndex = selectedIndex <= 0 ? filteredCommands.length - 1 : selectedIndex - 1;
    }
    
    renderResults();
    const selected = results.querySelector('.selected');
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }
  
  function executeSelected() {
    if (selectedIndex >= 0 && filteredCommands[selectedIndex]) {
      window.location.href = filteredCommands[selectedIndex].url;
    }
  }
  
  // Keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (palette.classList.contains('active')) {
        closePalette();
      } else {
        openPalette();
      }
    }
    
    if (palette.classList.contains('active')) {
      if (e.key === 'Escape') {
        closePalette();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigate('down');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigate('up');
      } else if (e.key === 'Enter') {
        e.preventDefault();
        executeSelected();
      }
    }
  });
  
  // Click outside to close
  palette.addEventListener('click', (e) => {
    if (e.target === palette) {
      closePalette();
    }
  });
  
  // Input handler
  input.addEventListener('input', (e) => {
    filterCommands(e.target.value);
    selectedIndex = -1;
  });
})();

// ============================================
// Magnetic CTAs
// ============================================

(function initMagneticButtons() {
  // Check for reduced motion preference
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;
  
  // Disable on touch devices
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (isTouchDevice) return;
  
  const magneticElements = document.querySelectorAll('.magnetic');
  
  magneticElements.forEach(el => {
    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      
      const moveX = x * 0.15;
      const moveY = y * 0.15;
      
      el.style.transform = `translate(${moveX}px, ${moveY}px)`;
    });
    
    el.addEventListener('mouseleave', () => {
      el.style.transform = 'translate(0, 0)';
    });
  });
})();

// ============================================
// Page Transitions
// ============================================

(function initPageTransitions() {
  const main = document.querySelector('main');
  if (main) {
    main.classList.add('page-transition');
  }
  
  // Handle internal link clicks
  document.querySelectorAll('a[href^="/"]').forEach(link => {
    link.addEventListener('click', (e) => {
      // Only handle same-origin links
      if (link.hostname === window.location.hostname) {
        // Add fade out effect
        document.body.style.opacity = '0.8';
        document.body.style.transition = 'opacity 0.2s';
      }
    });
  });
})();

// ============================================
// URL Parameter Utilities
// ============================================

window.URLParams = {
  get: (key) => {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  },
  
  set: (key, value) => {
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.pushState({}, '', newUrl);
  },
  
  getAll: () => {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params) {
      result[key] = value;
    }
    return result;
  }
};



