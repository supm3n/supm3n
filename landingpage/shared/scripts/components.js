// ============================================
// Component Loader - Loads shared components into pages
// ============================================

window.Supm3nComponents = {
  // Base URL for shared components
  // Auto-detect development mode (localhost or dev subdomain)
  get baseURL() {
    const hostname = window.location.hostname;
    const isDev = hostname === 'localhost' || 
                  hostname === '127.0.0.1' || 
                  hostname.includes('.dev') ||
                  hostname.includes('pages.dev');
    return isDev ? '/shared' : 'https://supm3n.com/shared';
  },

  // Optional version to bust caches (set when deploying landingpage)
  version: '20251108',

  // Helper to append ?v=
  withVersion(path) {
    if (!this.version) return path;
    return path + (path.includes('?') ? `&v=${this.version}` : `?v=${this.version}`);
  },
  
  // Fallback components if loading fails
  getFallbackComponent(name) {
    const fallbacks = {
      header: `<header class="site-header" role="banner">
  <div class="container header-inner">
    <a class="brand" href="https://supm3n.com/" aria-label="Supm3n Home">
      <img src="https://supm3n.com/assets/logo.png" alt="Supm3n logo" class="brand-logo" />
    </a>
    <nav class="main-nav" role="navigation" aria-label="Main navigation">
      <a class="nav-link" href="https://supm3n.com/">Home</a>
      <a class="nav-link" href="https://supm3n.com/projects">Projects</a>
    </nav>
  </div>
</header>`,
      footer: `<footer class="site-footer" role="contentinfo">
  <div class="container footer-inner">
    <div class="footer-links">
      <a href="https://supm3n.com/">© Supm3n</a>
    </div>
  </div>
</footer>`,
      breadcrumbs: `<nav class="breadcrumbs" aria-label="Breadcrumb" id="breadcrumbs">
  <ol class="breadcrumbs-list">
    <li class="breadcrumb-item">
      <a href="https://supm3n.com/">Home</a>
    </li>
  </ol>
</nav>`
    };
    return fallbacks[name] || '';
  },
  
  // Load component HTML with retry logic
  async loadComponent(name, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const url = this.withVersion(`${this.baseURL}/components/${name}.html`);
        const response = await fetch(url, {
          cache: attempt === 0 ? 'default' : 'no-cache'
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.text();
      } catch (error) {
        if (attempt === retries) {
          console.warn(`Could not load component ${name} after ${retries + 1} attempts, using fallback:`, error);
          return this.getFallbackComponent(name);
        }
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, attempt)));
      }
    }
    return this.getFallbackComponent(name);
  },
  
  // Inject component into element
  async injectComponent(selector, componentName, options = {}) {
    const { replace = true } = options;
    const element = document.querySelector(selector);
    if (!element) {
      console.warn(`Element ${selector} not found for component ${componentName}`);
      return;
    }
    
    const html = await this.loadComponent(componentName);
    if (html) {
      if (replace) {
        const template = document.createElement('template');
        template.innerHTML = html.trim();
        const node = template.content.firstElementChild;
        if (node) {
          element.replaceWith(node);
          // Dispatch event on the new node
          node.dispatchEvent(new CustomEvent('component-loaded', {
            detail: { component: componentName }
          }));
          return node;
        } else {
          // Fallback to innerHTML if parsing failed
          element.innerHTML = html;
          element.dispatchEvent(new CustomEvent('component-loaded', {
            detail: { component: componentName }
          }));
          return element;
        }
      } else {
        element.innerHTML = html;
        element.dispatchEvent(new CustomEvent('component-loaded', { 
          detail: { component: componentName } 
        }));
        return element;
      }
    } else {
      // If no HTML returned, use fallback
      const fallback = this.getFallbackComponent(componentName);
      if (fallback) {
        if (replace) {
          const template = document.createElement('template');
          template.innerHTML = fallback.trim();
          const node = template.content.firstElementChild;
          if (node) {
            element.replaceWith(node);
            node.dispatchEvent(new CustomEvent('component-loaded', {
              detail: { component: componentName }
            }));
            return node;
          }
        }
        element.innerHTML = fallback;        
        console.warn(`Using fallback for component ${componentName}`);
        element.dispatchEvent(new CustomEvent('component-loaded', {
          detail: { component: componentName }
        }));
        return element;
      }
    }
  },
  
  // Load header
  async loadHeader(selector = 'header.site-header') {
    const node = await this.injectComponent(selector, 'header', { replace: true });
    // Load theme script after header is loaded
    await this.loadScript('theme');
    return node;
  },
  
  // Load footer
  async loadFooter(selector = 'footer.site-footer') {
    return await this.injectComponent(selector, 'footer', { replace: true });
  },
  
  // Load breadcrumbs
  async loadBreadcrumbs(selector = 'nav.breadcrumbs') {
    return await this.injectComponent(selector, 'breadcrumbs', { replace: true });
    // Load breadcrumbs script after component is loaded
    await this.loadScript('breadcrumbs');
  },
  
  // Load script
  async loadScript(name) {
    // Check if already loaded
    if (document.querySelector(`script[data-supm3n-script="${name}"]`)) {
      return;
    }
    
    const script = document.createElement('script');
    script.src = this.withVersion(`${this.baseURL}/scripts/${name}.js`);
    script.setAttribute('data-supm3n-script', name);
    document.body.appendChild(script);
  },
  
  // Load all shared styles
  loadStyles() {
    // Check if already loaded
    if (document.querySelector('link[data-supm3n-styles]')) {
      return;
    }
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = this.withVersion(`${this.baseURL}/styles/variables.css`);
    link.setAttribute('data-supm3n-styles', 'variables');
    document.head.appendChild(link);
    
    const link2 = document.createElement('link');
    link2.rel = 'stylesheet';
    link2.href = this.withVersion(`${this.baseURL}/styles/components.css`);
    link2.setAttribute('data-supm3n-styles', 'components');
    document.head.appendChild(link2);
  },
  
  // Initialize - loads all components
  async init(options = {}) {
    const {
      header = true,
      footer = true,
      breadcrumbs = false,
      styles = true,
      utils = true
    } = options;
    
    if (styles) {
      this.loadStyles();
    }
    
    if (utils) {
      await this.loadScript('utils');
    }
    
    const promises = [];
    
    if (header) {
      promises.push(this.loadHeader());
    }
    
    if (footer) {
      promises.push(this.loadFooter());
    }
    
    if (breadcrumbs) {
      promises.push(this.loadBreadcrumbs());
    }
    
    await Promise.all(promises);
  }
};

