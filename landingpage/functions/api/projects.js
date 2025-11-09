export async function onRequest(context) {
  const { request, env } = context;
  const cache = caches.default;
  const cacheKey = new Request(new URL(request.url).origin + "/__projects_cache_v2");
  const cached = await cache.match(cacheKey);
  if (cached) {
    return new Response(cached.body, { headers: { "Content-Type":"application/json", "Cache-Control":"public, max-age=300", "Access-Control-Allow-Origin":"*" } });
  }
  try {
    const ZONE_ID = env.ZONE_ID;
    const TOKEN = env.CF_API_TOKEN;
    
    // Check if required environment variables are set
    if (!ZONE_ID || !TOKEN) {
      throw new Error(`Missing environment variables: ZONE_ID=${!!ZONE_ID}, TOKEN=${!!TOKEN}`);
    }
    
    const headers = { "Authorization": "Bearer " + TOKEN };
    const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?type=CNAME&per_page=100`, { headers });
    if (!r.ok) {
      const errorData = await r.json().catch(() => ({}));
      throw new Error(`CF API error: ${r.status} ${errorData.errors?.[0]?.message || r.statusText}`);
    }
    const data = await r.json();
    const projects = (data.result || [])
      .filter(x => x.name.endsWith(".supm3n.com"))
      .map(x => {
        const sub = x.name.split(".supm3n.com")[0];
        // Format name nicely (e.g., "stock-viewer" -> "Stock Viewer")
        const formattedName = sub.split('-').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        return { 
          name: formattedName, 
          description: `${formattedName} project`, 
          url: `https://${x.name}/`,
          tag: 'project',
          favicon: `https://${x.name}/favicon.ico`
        };
      });
    const body = JSON.stringify(projects);
    const resp = new Response(body, { headers: { "Content-Type":"application/json", "Cache-Control":"public, max-age=300", "Access-Control-Allow-Origin":"*" } });
    context.waitUntil(cache.put(cacheKey, resp.clone()));
    return resp;
  } catch (e) {
    // Fallback to projects.json file
    try {
      // Try to read projects.json from the file system
      // In Cloudflare Pages, we need to fetch it as a static asset
      const url = new URL(request.url);
      const projectsUrl = new URL('/projects.json', url.origin);
      const projectsResponse = await fetch(projectsUrl);
      
      if (projectsResponse.ok) {
        const data = await projectsResponse.json();
        // Handle both array format and object with projects property
        const projects = Array.isArray(data) ? data : (data.projects || []);
        const body = JSON.stringify(projects);
        return new Response(body, { headers: { "Content-Type":"application/json", "Cache-Control":"no-store", "Access-Control-Allow-Origin":"*" } });
      }
    } catch (jsonError) {
      console.error('Failed to load projects.json:', jsonError);
    }
    
    // Final fallback to default projects
    const projects = [
      { 
        "name": "Stock Viewer", 
        "description": "Real-time stock price viewer and tracker", 
        "url": "https://stocks.supm3n.com/",
        "tag": "tool",
        "favicon": "https://stocks.supm3n.com/favicon.ico"
      }
    ];
    const body = JSON.stringify(projects);
    return new Response(body, { headers: { "Content-Type":"application/json", "Cache-Control":"no-store", "Access-Control-Allow-Origin":"*" } });
  }
}
