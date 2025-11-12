// landingpage/functions/api/projects.js - SIMPLIFIED DEBUG
// Test basic connectivity first

export async function onRequest(context) {
  const { env } = context;

  const TOKEN = env.CF_API_TOKEN || env.CF_API_TOK || env.CLOUDFLARE_API_TOKEN;
  const ACCOUNT = env.CF_ACCOUNT_ID || env.CLOUDFLARE_ACCOUNT_ID;

  // Return config status
  if (!TOKEN || !ACCOUNT) {
    return new Response(JSON.stringify({
      error: "Missing credentials",
      has_token: !!TOKEN,
      has_account: !!ACCOUNT,
      env_keys: Object.keys(env)
    }, null, 2), { 
      status: 500, 
      headers: { 
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      } 
    });
  }

  const headers = { Authorization: `Bearer ${TOKEN}` };
  const base = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/pages/projects`;

  try {
    // Step 1: Just list projects (no domain fetching yet)
    const startTime = Date.now();
    const projectsRes = await fetch(`${base}?per_page=100`, { headers });
    const fetchTime = Date.now() - startTime;
    
    const projectsJson = await projectsRes.json();
    const parseTime = Date.now() - startTime;

    if (!projectsRes.ok || !projectsJson?.success) {
      return new Response(JSON.stringify({
        error: "Cloudflare API failed",
        status: projectsRes.status,
        statusText: projectsRes.statusText,
        success: projectsJson?.success,
        cf_errors: projectsJson?.errors || [],
        cf_messages: projectsJson?.messages || [],
        timing: { fetch: fetchTime, parse: parseTime }
      }, null, 2), { 
        status: 502,
        headers: { 
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-store"
        }
      });
    }

    // Just return project names for now
    const projects = (projectsJson.result || []).map(p => ({
      name: p.name,
      created_at: p.created_on,
      production_branch: p.production_branch
    }));

    return new Response(JSON.stringify({
      success: true,
      total_projects: projects.length,
      projects: projects,
      timing: { fetch: fetchTime, parse: parseTime },
      next_step: "If this works, we'll add domain fetching"
    }, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
        "access-control-allow-origin": "*"
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: "Exception caught",
      message: err.message,
      stack: err.stack,
      name: err.name
    }, null, 2), {
      status: 500,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
      }
    });
  }
}
