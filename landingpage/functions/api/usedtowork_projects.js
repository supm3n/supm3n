// landingpage/functions/api/projects.js
// Cloudflare Pages Function that lists Pages projects attached to supm3n.com.

export async function onRequest(context) {
  const { env } = context;

  const TOKEN = env.CF_API_TOKEN || env.CF_API_TOK || env.CLOUDFLARE_API_TOKEN;
  const ACCOUNT = env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID;

  if (!TOKEN || !ACCOUNT) {
    return new Response(JSON.stringify({
      error: "Missing token or account id",
      details: {
        hasToken: !!TOKEN,
        hasAccount: !!ACCOUNT
      }
    }), { status: 500, headers: { "content-type": "application/json; charset=utf-8" } });
  }

  const headers = { Authorization: `Bearer ${TOKEN}` };
  const base = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects`;

  try {
    // 1) List Pages projects (no pagination params - not supported by Pages API)
    const projectsRes = await fetch(base, { headers });
    const projectsJson = await projectsRes.json();
    if (!projectsJson?.success) throw new Error("Pages projects API error");

    const list = [];
    for (const p of projectsJson.result || []) {
      // Skip the landingpage project (it's the homepage, not a project)
      if (p.name === "landingpage") continue;
      
      // 2) For each project, list its domains
      const domRes = await fetch(`${base}/${encodeURIComponent(p.name)}/domains`, { headers });
      const domJson = await domRes.json();
      
      // Domain objects have 'name' property (not 'domain')
      const domains = (domJson?.result || []).map(d => d.name || d.domain).filter(Boolean);

      // 3) Keep only our zone (supm3n.com)
      const filtered = domains.filter(d => d === "supm3n.com" || d.endsWith(".supm3n.com"));
      if (filtered.length === 0) continue;

      // prefer subdomain for url
      const sub = filtered.find(d => d.endsWith(".supm3n.com"));
      const domain = sub || "supm3n.com";
      const url = `https://${domain}`;
      const slug = sub ? sub.split(".")[0] : "landingpage";

      // 4) Optional enrichment from GitHub project manifests (public)
      let meta = null;
      try {
        const gh = await fetch(`https://raw.githubusercontent.com/supm3n/supm3n/main/projects/${slug}/project.json`);
        if (gh.ok) meta = await gh.json();
      } catch {}

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
    }

    list.sort((a, b) => a.slug.localeCompare(b.slug));

    return new Response(JSON.stringify(list, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*"
      }
    });
  } catch (err) {
    console.error('Projects API error:', err);
    // Minimal safe fallback
    const fallback = [
      {
        slug: "disasters",
        name: "Disasters",
        description: "Real-time earthquake and wildfire tracking",
        domain: "disasters.supm3n.com",
        url: "https://disasters.supm3n.com/",
        tags: ["tool"],
        favicon: "https://disasters.supm3n.com/favicon.ico"
      }
    ];
    return new Response(JSON.stringify(fallback, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*"
      }
    });
  }
}