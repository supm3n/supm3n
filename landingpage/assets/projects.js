// /assets/projects.js
// Populates the Projects page with items from /api/projects (Pages Function) and
// falls back to /projects.json if the API is not available.
// Safe for static hosting; no secrets used on client.
(function () {
  async function fetchProjects() {
    // Try API first
    try {
      const res = await fetch('/api/projects', { cache: 'no-store', headers: { 'accept': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.projects)) return data.projects;
      }
    } catch (e) {
      console.warn('API failed, using fallback /projects.json', e);
    }
    // Fallback
    try {
      const res = await fetch('/projects.json', { cache: 'no-store', headers: { 'accept': 'application/json' } });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
        if (data && Array.isArray(data.projects)) return data.projects;
      }
    } catch (e) {
      console.error('Fallback /projects.json failed', e);
    }
    return [];
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
  }

  function normalize(items) {
    return (items || []).map(p => {
      const url = (p.url || (p.domain ? `https://${p.domain}` : '/')).replace(/\/$/, '') + '/';
      return {
        slug: p.slug || '',
        name: p.name || (p.slug ? p.slug[0].toUpperCase() + p.slug.slice(1) : 'Project'),
        description: p.description || '',
        url,
        tag: p.tag || (Array.isArray(p.tags) ? p.tags[0] : 'project'),
        favicon: p.favicon || `${url}favicon.ico`
      };
    });
  }

  function renderGrid(container, items) {
    container.innerHTML = items.map(project => {
      const safeName = escapeHtml(project.name);
      const safeDescription = escapeHtml(project.description);
      const safeTag = escapeHtml(project.tag);
      const openLabel = escapeHtml(`Open ${project.name} in a new tab`);
      return `
        <article class="project-card reveal">
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
    }).join('');
    bindProjectLinkOpeners(container);
  }

  function bindProjectLinkOpeners(root) {
    if (!root) return;
    root.querySelectorAll('.project-link[data-project-link]').forEach(link => {
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

  async function init() {
    const container = document.getElementById('projects-container');
    if (!container) return;

    // Skeletons
    container.innerHTML = Array(9).fill(0).map(() => `
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

    let items = await fetchProjects();
    items = normalize(items);

    // small delay for skeleton
    await new Promise(r => setTimeout(r, 200));

    if (!items.length) {
      container.innerHTML = '<p style="color: var(--color-text-muted);">No projects available yet.</p>';
      return;
    }
    renderGrid(container, items);

    // reveal animation
    setTimeout(() => {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) entry.target.classList.add('visible');
        });
      }, { threshold: 0.1 });
      container.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    }, 100);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
