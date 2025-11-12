# Adding a Pages Function (Proxy/API)

1. Create file under `projects/<name>/functions/api/your-endpoint.js`:
```js
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  // read env: const KEY = context.env.MY_SECRET;
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' },
  });
}
```

2. Add env secrets in Cloudflare Pages project settings.
3. Call it from your frontend at `/api/your-endpoint?...`.
