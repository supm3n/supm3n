// ============================================
// Shared Utility Functions
// ============================================

window.Supm3nUtils = {
  // Escape HTML to prevent XSS
  escapeHtml: (text) => {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
  
  // Format text (e.g., "stock-viewer" -> "Stock Viewer")
  formatName: (text) => {
    return text
      .split(/[-_\s]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  },
  
  // Debounce function
  debounce: (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },
  
  // Throttle function
  throttle: (func, limit) => {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  },
  
  // Check if element is in viewport
  isInViewport: (element) => {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  },
  
  // Smooth scroll to element
  scrollTo: (element, offset = 0) => {
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;
    
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  },
  
  // Get URL parameters
  getURLParams: () => {
    const params = new URLSearchParams(window.location.search);
    const result = {};
    for (const [key, value] of params) {
      result[key] = value;
    }
    return result;
  },
  
  // Set URL parameter
  setURLParam: (key, value) => {
    const params = new URLSearchParams(window.location.search);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.pushState({}, '', newUrl);
  },
  
  // Initialize navigation active states
  initNavigation: () => {
    const navLinks = document.querySelectorAll('.nav-link');
    const currentPath = window.location.pathname;
    const currentHost = window.location.host;
    
    navLinks.forEach(link => {
      // Remove any existing active class
      link.classList.remove('active');
      
      const linkUrl = new URL(link.href);
      const linkPath = linkUrl.pathname;
      const linkHost = linkUrl.host;
      
      // Check if this link matches the current page
      let isActive = false;
      
      // For same-host links, compare paths
      if (linkHost === currentHost) {
        if (linkPath === currentPath) {
          isActive = true;
        } else if (linkPath === '/' && currentPath === '/') {
          isActive = true;
        }
      } 
      // For cross-domain links (subdomains to main site)
      else {
        // If on a subdomain and link points to main site path
        if (linkHost === 'supm3n.com' || linkHost.endsWith('.supm3n.com')) {
          // Extract the page name from the link
          const linkPage = linkPath.replace('/', '').replace(/\/$/, '');
          
          // Special handling for "Home" link
          if (linkPath === '/' && linkHost === 'supm3n.com') {
            // Home link should only be active on the main landing page
            if (currentHost === 'supm3n.com' && (currentPath === '/' || currentPath === '')) {
              isActive = true;
            }
          }
        }
      }
      
      if (isActive) {
        link.classList.add('active');
      }
    });
  }
};

// Auto-initialize navigation on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.Supm3nUtils.initNavigation();
  });
} else {
  window.Supm3nUtils.initNavigation();
}

