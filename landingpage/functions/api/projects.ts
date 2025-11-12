// landingpage/functions/api/projects.ts
// Pages Function that lists Cloudflare Pages projects and their supm3n.com domains.
// Requires two secrets set in the Cloudflare Pages project:
//  - CF_API_TOKEN  (Account-scoped token with Pages:Read)
//  - CF_ACCOUNT_ID (your Cloudflare Account ID)
// Optionally enriches with projects/<slug>/project.json from GitHub if present.

export const onRequestGet: PagesFunction<{ CF_API_TOKEN: string; CF_ACCOUNT_ID: string }> = async (ctx) => {
  const token = ctx.env.CF_API_TOKEN;
  const account = ctx.env.CF_ACCOUNT_ID;
  if (!token || !account) {
    return new Response(JSON.stringify({ error: "Missing CF_API_TOKEN or CF_ACCOUNT_ID" }), { status: 500 });
  }

  const base = `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects`;
  const headers = { Authorization: `Bearer ${token}` };

  // Fetch projects (first 100 is ample here; adjust if you grow beyond this)
  const projectsResp = await fetch(`${base}?per_page=100`, { headers });
  const data = await projectsResp.json();
  if (!data?.success) {
    return new Response(JSON.stringify({ error: "Cloudflare API error", details: data?.errors || null }), { status: 502 });
  }

  const results: Array<any> = [];
  for (const p of data.result || []) {
    // For each project, get its domains
    const domResp = await fetch(`${base}/${encodeURIComponent(p.name)}/domains`, { headers });
    const domData = await domResp.json();
    const domains: string[] = (domData?.result || []).map((d: any) => d.domain);

    // Keep only domains in your zone
    const matched = domains.filter((d) => d === "supm3n.com" || d.endsWith(".supm3n.com"));
    if (matched.length === 0) continue;

    // Prefer a subdomain over apex when choosing a link
    const sub = matched.find((d) => d.endsWith(".supm3n.com"));
    const url = "https://" + (sub || "supm3n.com");
    const slug = sub ? sub.split(".")[0] : "landingpage";

    // Optional enrichment from GitHub project.json (public repo)
    let meta: any = null;
    try {
      const gh = await fetch(`https://raw.githubusercontent.com/supm3n/supm3n/main/projects/${slug}/project.json`);
      if (gh.ok) meta = await gh.json();
    } catch {
      /* ignore */ 
    }

    results.push({
      project_name: p.name,
      slug,
      name: meta?.name || (slug[0].toUpperCase() + slug.slice(1)),
      description: meta?.description || "",
      domain: sub || "supm3n.com",
      url,
      tags: meta?.tags || [],
    });
  }

  results.sort((a, b) => a.slug.localeCompare(b.slug));

  return new Response(JSON.stringify(results, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    },
  });
};
