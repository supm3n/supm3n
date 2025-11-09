// ============================================
// Projects Manager
// ============================================

class ProjectsManager {
  constructor() {
    this.projects = [];
    this.filteredProjects = [];
    this.currentTag = null;
    this.currentSort = 'name';
    this.searchQuery = '';
    this.healthStatus = 'unknown';
    
    this.init();
  }
  
  async init() {
    // Load from URL params
    this.loadFromURL();
    
    // Set up event listeners
    this.setupListeners();
    
    // Load projects
    await this.loadProjects();
    
    // Check health
    await this.checkHealth();
    
    // Render
    this.render();
  }
  
  loadFromURL() {
    const params = window.URLParams.getAll();
    this.searchQuery = params.search || '';
    this.currentTag = params.tag || null;
    this.currentSort = params.sort || 'name';
    
    // Update UI
    const searchInput = document.getElementById('project-search');
    if (searchInput) searchInput.value = this.searchQuery;
    
    const sortSelect = document.getElementById('project-sort');
    if (sortSelect) sortSelect.value = this.currentSort;
  }
  
  setupListeners() {
    const searchInput = document.getElementById('project-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        window.URLParams.set('search', this.searchQuery);
        this.filterAndSort();
        this.render();
      });
    }
    
    const sortSelect = document.getElementById('project-sort');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        window.URLParams.set('sort', this.currentSort);
        this.filterAndSort();
        this.render();
      });
    }
    
    // Tag filters
    document.querySelectorAll('.tag-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const tag = chip.dataset.tag;
        if (this.currentTag === tag) {
          this.currentTag = null;
          chip.classList.remove('active');
          window.URLParams.set('tag', '');
        } else {
          // Remove active from all
          document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
          this.currentTag = tag;
          chip.classList.add('active');
          window.URLParams.set('tag', tag);
        }
        this.filterAndSort();
        this.render();
      });
    });
    
    // Refresh button
    const refreshBtn = document.getElementById('refresh-projects');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '↻ Refreshing...';
        await this.loadProjects();
        await this.checkHealth();
        this.render();
        setTimeout(() => {
          refreshBtn.disabled = false;
          refreshBtn.textContent = '↻ Refresh';
        }, 500);
      });
    }
  }
  
  async loadProjects() {
    const container = document.getElementById('projects-container');
    if (container) {
      container.innerHTML = this.renderSkeletons(6);
    }
    
    // Initialize projects as empty array FIRST
    this.projects = [];
    
    try {
      // Try API first
      const response = await fetch('/api/projects', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        // Ensure we got an array
        if (Array.isArray(data)) {
          this.projects = data;
        } else if (data && typeof data === 'object' && Array.isArray(data.projects)) {
          // Handle object format from API
          this.projects = data.projects;
        } else {
          throw new Error('API returned invalid data format');
        }
      } else {
        throw new Error(`API returned ${response.status}`);
      }
    } catch (error) {
      console.warn('API failed, trying projects.json fallback:', error);
      // Fallback to JSON
      try {
        const response = await fetch('/projects.json', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          
          // Handle both array format and object with projects property
          if (Array.isArray(data)) {
            this.projects = data;
          } else if (data && typeof data === 'object') {
            // Check for .projects property first (most common)
            if (Array.isArray(data.projects)) {
              this.projects = data.projects;
            } else {
              // Try to find any array property
              const possibleArray = Object.values(data).find(v => Array.isArray(v));
              if (possibleArray) {
                this.projects = possibleArray;
              } else {
                throw new Error('projects.json has invalid format - no array found');
              }
            }
          } else {
            throw new Error('projects.json has invalid format');
          }
        } else {
          throw new Error(`projects.json returned ${response.status}`);
        }
      } catch (e) {
        console.error('Failed to load projects from both API and JSON:', e);
        this.projects = [];
      }
    }
    
    // CRITICAL: Process projects - ensure we have an array (defensive check)
    // This handles cases where the code above didn't properly extract the array
    // This is the LAST CHANCE to fix it before .map() is called
    if (!Array.isArray(this.projects)) {
      console.warn('⚠️ Projects is not an array after loading, attempting to fix:', this.projects);
      // Try to extract array if it's an object
      if (this.projects && typeof this.projects === 'object' && this.projects !== null) {
        // Check for .projects property first (most common case)
        if (Array.isArray(this.projects.projects)) {
          this.projects = this.projects.projects;
          console.log('✅ Extracted projects from .projects property');
        } else {
          // Try to find any array property
          const possibleArray = Object.values(this.projects).find(v => Array.isArray(v));
          if (possibleArray) {
            this.projects = possibleArray;
            console.log('✅ Extracted projects from object property');
          } else {
            console.error('❌ No array found in projects object, using empty array');
            this.projects = [];
          }
        }
      } else {
        console.error('❌ Projects is not an object or array, using empty array');
        this.projects = [];
      }
    }
    
    // ABSOLUTE FINAL safety check before map - this should NEVER fail now
    if (!Array.isArray(this.projects)) {
      console.error('🚨 CRITICAL: Projects is STILL not an array after all checks!', this.projects);
      this.projects = [];
    }
    
    // Now safely map the projects - this will NEVER fail because we've triple-checked
    try {
      this.projects = this.projects.map(project => ({
        ...project,
        tag: project.tag || 'project',
        favicon: project.favicon || `${project.url}/favicon.ico`
      }));
    } catch (mapError) {
      console.error('🚨 Error mapping projects (this should never happen):', mapError);
      this.projects = [];
    }
    
    this.filterAndSort();
  }
  
  async checkHealth() {
    try {
      const response = await fetch('/api/health', { cache: 'no-store' });
      this.healthStatus = response.ok ? 'ok' : 'warning';
    } catch (error) {
      this.healthStatus = 'warning';
    }
    
    const indicator = document.getElementById('health-indicator');
    if (indicator) {
      indicator.className = 'health-indicator';
      if (this.healthStatus === 'warning') {
        indicator.classList.add('warning');
      }
    }
  }
  
  filterAndSort() {
    // Safety check - ensure projects is an array
    if (!Array.isArray(this.projects)) {
      console.error('filterAndSort: projects is not an array!', this.projects);
      // Try to fix it one more time
      if (this.projects && typeof this.projects === 'object' && this.projects.projects && Array.isArray(this.projects.projects)) {
        this.projects = this.projects.projects;
        console.log('Fixed projects array in filterAndSort');
      } else {
        this.filteredProjects = [];
        return;
      }
    }
    
    // Filter by search
    let filtered = this.projects.filter(project => {
      const searchLower = this.searchQuery.toLowerCase();
      return !searchLower || 
        project.name.toLowerCase().includes(searchLower) ||
        (project.description || '').toLowerCase().includes(searchLower) ||
        (project.tag || '').toLowerCase().includes(searchLower);
    });
    
    // Filter by tag
    if (this.currentTag) {
      filtered = filtered.filter(project => 
        (project.tag || 'project').toLowerCase() === this.currentTag.toLowerCase()
      );
    }
    
    // Sort
    filtered.sort((a, b) => {
      if (this.currentSort === 'name') {
        return a.name.localeCompare(b.name);
      } else if (this.currentSort === 'updated') {
        const aDate = new Date(a.updated || a.lastUpdated || 0);
        const bDate = new Date(b.updated || b.lastUpdated || 0);
        return bDate - aDate;
      }
      return 0;
    });
    
    this.filteredProjects = filtered;
  }
  
  getAllTags() {
    // Safety check
    if (!Array.isArray(this.projects)) {
      console.warn('getAllTags: projects is not an array');
      return [];
    }
    
    const tags = new Set();
    this.projects.forEach(project => {
      if (project && project.tag) {
        tags.add(project.tag);
      }
    });
    return Array.from(tags).sort();
  }
  
  renderSkeletons(count) {
    return Array(count).fill(0).map(() => `
      <div class="skeleton-project-card">
        <div class="skeleton-project-card-header">
          <div class="skeleton skeleton-project-icon"></div>
          <div class="skeleton-project-info">
            <div class="skeleton skeleton-project-title"></div>
            <div class="skeleton skeleton-project-description"></div>
            <div class="skeleton skeleton-project-description short"></div>
          </div>
        </div>
        <div class="skeleton-project-meta">
          <div class="skeleton skeleton-project-tag"></div>
          <div class="skeleton skeleton-project-link"></div>
        </div>
      </div>
    `).join('');
  }
  
  render() {
    const container = document.getElementById('projects-container');
    if (!container) {
      console.error('Projects container not found!');
      return;
    }
    
    // Debug logging
    console.log('Render called:', {
      projectsCount: Array.isArray(this.projects) ? this.projects.length : 'not array',
      filteredCount: Array.isArray(this.filteredProjects) ? this.filteredProjects.length : 'not array',
      projectsType: typeof this.projects,
      filteredType: typeof this.filteredProjects
    });
    
    // Update tag filters
    this.updateTagFilters();
    
    // Check if we have projects but they're all filtered out
    if (Array.isArray(this.projects) && this.projects.length > 0 && this.filteredProjects.length === 0) {
      console.warn('Projects exist but all filtered out. Search:', this.searchQuery, 'Tag:', this.currentTag);
    }
    
    if (this.filteredProjects.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h3 class="empty-state-title">No projects found</h3>
          <p class="empty-state-text">Try adjusting your search or filters.</p>
          <button class="btn btn-secondary" onclick="window.URLParams.set('search', ''); window.URLParams.set('tag', ''); location.reload();">
            Clear filters
          </button>
        </div>
      `;
      return;
    }
    
    container.innerHTML = this.filteredProjects.map(project => this.renderCard(project)).join('');
    this.bindProjectLinkOpeners(container);
    
    // Add reveal animations
    const cards = container.querySelectorAll('.project-card');
    cards.forEach((card, index) => {
      card.classList.add('reveal');
      card.style.transitionDelay = `${index * 0.05}s`;
    });
    
    // Trigger scroll reveal
    setTimeout(() => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      }, { threshold: 0.1 });
      
      cards.forEach(card => observer.observe(card));
    }, 100);
  }
  
  renderCard(project) {
    const tag = project.tag || 'project';
    const safeName = this.escapeHtml(project.name);
    const safeDescription = this.escapeHtml(project.description || '');
    const safeTag = this.escapeHtml(tag);
    const openLabel = this.escapeHtml(`Open ${project.name} in a new tab`);
    return `
      <article class="project-card">
        <a href="${project.url}" class="project-card-link" aria-label="Open ${safeName}">
          <div class="project-card-header">
            <img 
              class="project-icon" 
              src="${project.favicon}" 
              alt="${safeName} icon"
              loading="lazy"
              onerror="this.src='/assets/icons/android-chrome-192x192.png'"
            />
            <div class="project-info">
              <h3 class="project-title">${safeName}</h3>
              <p class="project-description">${safeDescription}</p>
            </div>
          </div>
          <div class="project-meta">
            <span class="project-tag">${safeTag}</span>
            <span 
              class="project-link" 
              data-project-link 
              tabindex="0" 
              role="link" 
              aria-label="${openLabel}"
              title="Open in new tab"
            >
              Open
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
              </svg>
            </span>
          </div>
        </a>
      </article>
    `;
  }

  bindProjectLinkOpeners(root) {
    if (!root) return;

    const links = root.querySelectorAll('.project-link[data-project-link]');
    links.forEach(link => {
      if (link.dataset.linkBound === 'true') return;

      const parentAnchor = link.closest('a.project-card-link');
      if (!parentAnchor || !parentAnchor.href) return;

      const openInNewTab = (event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        window.open(parentAnchor.href, '_blank', 'noopener');
      };

      link.addEventListener('click', openInNewTab);
      link.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openInNewTab(event);
        }
      });

      link.dataset.linkBound = 'true';
    });
  }
  
  updateTagFilters() {
    const container = document.getElementById('tag-filters');
    if (!container) return;
    
    const tags = this.getAllTags();
    container.innerHTML = tags.map(tag => `
      <button 
        class="tag-chip ${this.currentTag === tag ? 'active' : ''}" 
        data-tag="${tag}"
        aria-pressed="${this.currentTag === tag}"
      >
        ${this.escapeHtml(tag)}
      </button>
    `).join('');
    
    // Re-attach listeners
    container.querySelectorAll('.tag-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const tag = chip.dataset.tag;
        if (this.currentTag === tag) {
          this.currentTag = null;
          chip.classList.remove('active');
          window.URLParams.set('tag', '');
        } else {
          document.querySelectorAll('.tag-chip').forEach(c => c.classList.remove('active'));
          this.currentTag = tag;
          chip.classList.add('active');
          window.URLParams.set('tag', tag);
        }
        this.filterAndSort();
        this.render();
      });
    });
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.projectsManager = new ProjectsManager();
  });
} else {
  window.projectsManager = new ProjectsManager();
}



