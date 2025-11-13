// landingpage/functions/api/projects.js
//
// IMPROVED VERSION:
// This function now serves the static 'projects.json' file directly.
// This is much faster, more reliable, and doesn't require any API tokens.
// Just update your 'landingpage/projects.json' file when you add a new project.

export async function onRequest(context) {
  try {
    // 1. Get the 'ASSETS' binding from the environment
    const { env } = context;

    // 2. Create a URL to the static projects.json file in your repo
    const url = new URL(context.request.url);
    url.pathname = '/projects.json';

    // 3. Fetch the asset directly from the project's static files
    // This is the official and most reliable way to read a file
    // from inside a Pages Function.
    const response = await env.ASSETS.fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch projects.json: ${response.status}`);
    }

    // 4. Get the JSON content
    // Note: .json() is not needed here, we return the raw response
    // which is already the JSON file.
    
    // 5. Return the projects list directly
    return new Response(response.body, {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        // It's a static file, but let's cache it for 5 minutes
        // so changes in projects.json appear reasonably quickly.
        'cache-control': 'public, max-age=300',
        'access-control-allow-origin': '*'
      }
    });

  } catch (err) {
    console.error('Projects API error:', err);
    return new Response(JSON.stringify({
      error: "Could not load projects list.",
      details: err.message
    }), {
      status: 500,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'access-control-allow-origin': '*'
      }
    });
  }
}