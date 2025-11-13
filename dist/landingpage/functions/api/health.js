export async function onRequest(context) {
  try {
    // Basic health check - you can add more sophisticated checks here
    // e.g., check database connectivity, external API status, etc.
    
    return new Response(
      JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: 'operational'
      }), 
      { 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        timestamp: new Date().toISOString(),
        error: error.message
      }), 
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        } 
      }
    );
  }
}



