// ============================================
// Breadcrumbs Component
// ============================================

(function initBreadcrumbs() {
  const breadcrumbsContainer = document.getElementById('breadcrumbs');
  if (!breadcrumbsContainer) return;
  
  const breadcrumbsList = breadcrumbsContainer.querySelector('.breadcrumbs-list');
  if (!breadcrumbsList) return;
  
  // Get current page info
  const currentPath = window.location.pathname;
  const currentHost = window.location.hostname;
  const isMainSite = currentHost === 'supm3n.com' || currentHost === 'www.supm3n.com';
  
  // Build breadcrumbs based on path
  const pathParts = currentPath.split('/').filter(part => part);
  
  // If we're on a project subdomain, add project name
  if (!isMainSite) {
    const projectName = currentHost.split('.')[0];
    const formattedName = projectName
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    // Add project breadcrumb
    const projectItem = document.createElement('li');
    projectItem.className = 'breadcrumb-item';
    projectItem.innerHTML = `<a href="/">${formattedName}</a>`;
    breadcrumbsList.appendChild(projectItem);
  } else {
    // Main site breadcrumbs
    pathParts.forEach((part, index) => {
      const isLast = index === pathParts.length - 1;
      const formattedPart = part
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      const item = document.createElement('li');
      item.className = 'breadcrumb-item';
      
      if (isLast) {
        item.textContent = formattedPart;
      } else {
        const href = '/' + pathParts.slice(0, index + 1).join('/');
        item.innerHTML = `<a href="${href}">${formattedPart}</a>`;
      }
      
      breadcrumbsList.appendChild(item);
    });
  }
})();

