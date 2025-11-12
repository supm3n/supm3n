// landingpage/functions/api/projects.js - DEBUG VERSION
// Add this temporarily to diagnose the issue

export async function onRequest(context) {
  const { env } = context;

  const TOKEN = env.CF_API_TOKEN || env.CF_API_TOK || env.CLOUDFLARE_API_TOKEN;
  const ACCOUNT = env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID;

  if (!TOKEN || !ACCOUNT) {
    return new Response(JSON.stringify({
      error: "Missing token or account id",
      details: { hasToken: !!TOKEN, hasAccount: !!ACCOUNT }
    }), { status: 500, headers: { "content-type": "application/json; charset=utf-8" } });
  }

  const headers = { Authorization: `Bearer ${TOKEN}` };
  const base = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects`;

  try {
    // 1) List Pages projects
    const projectsRes = await fetch(`${base}?per_page=100`, { headers });
    const projectsJson = await projectsRes.json();
    
    if (!projectsJson?.success) {
      return new Response(JSON.stringify({
        error: "Cloudflare API error",
        cf_errors: projectsJson?.errors || [],
        cf_messages: projectsJson?.messages || []
      }, null, 2), { 
        status: 502, 
        headers: { "content-type": "application/json; charset=utf-8" } 
      });
    }

    const list = [];
    const debugInfo = [];

    // Process each project with error handling
    for (const p of projectsJson.result || []) {
      try {
        // 2) For each project, list its domains
        const domRes = await fetch(`${base}/${encodeURIComponent(p.name)}/domains`, { headers });
        const domJson = await domRes.json();
        
        // Check if domains fetch was successful
        if (!domJson?.success) {
          debugInfo.push({
            project_name: p.name,
            error: "Failed to fetch domains",
            cf_errors: domJson?.errors || []
          });
          continue;
        }
        
        const domains = (domJson?.result || []).map(d => d.domain);

        // DEBUG: Log all projects and their domains
        debugInfo.push({
          project_name: p.name,
          all_domains: domains,
        });

        // 3) Keep only our zone (supm3n.com)
        const filtered = domains.filter(d => d === "supm3n.com" || d.endsWith(".supm3n.com"));
        
        // DEBUG: Log filtered result
        debugInfo[debugInfo.length - 1].filtered_domains = filtered;
        debugInfo[debugInfo.length - 1].skipped = filtered.length === 0;
        
        if (filtered.length === 0) continue;

        // prefer subdomain for url
        const sub = filtered.find(d => d.endsWith(".supm3n.com"));
        const domain = sub || "supm3n.com";
        const url = `https://${domain}`;
        const slug = sub ? sub.split(".")[0] : "landingpage";

        debugInfo[debugInfo.length - 1].extracted_slug = slug;
        debugInfo[debugInfo.length - 1].will_fetch_from_github = `https://raw.githubusercontent.com/supm3n/supm3n/main/projects/${slug}/project.json`;

        // 4) Optional enrichment from GitHub project manifests (public)
        let meta = null;
        try {
          const gh = await fetch(`https://raw.githubusercontent.com/supm3n/supm3n/main/projects/${slug}/project.json`);
          debugInfo[debugInfo.length - 1].github_response_ok = gh.ok;
          if (gh.ok) meta = await gh.json();
        } catch (e) {
          debugInfo[debugInfo.length - 1].github_error = e.message;
        }

        list.push({
          project_name: p.name,
          slug,
          name: meta?.name || (slug.charAt(0).toUpperCase() + slug.slice(1)),
          description: meta?.description || "",
          domain,
          url: url.endsWith("/") ? url : url + "/",
          tags: meta?.tags || [],
          favicon: `${url}/favicon.ico`
        });
      } catch (projectError) {
        debugInfo.push({
          project_name: p.name,
          error: projectError.message
        });
      }
    }

    list.sort((a, b) => a.slug.localeCompare(b.slug));

    // RETURN DEBUG INFO
    return new Response(JSON.stringify({
      projects: list,
      debug: debugInfo,
      total_projects_found: projectsJson.result?.length || 0,
      projects_after_filter: list.length
    }, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*"
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      stack: err.stack
    }, null, 2), {
      status: 500,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*"
      }
    });
  }
}
