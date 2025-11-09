export async function onRequest(context) {
  // Simple status endpoint for monitoring
  return new Response('OK', {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-store'
    }
  });
}



