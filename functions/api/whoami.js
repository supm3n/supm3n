// functions/api/whoami.js
// Returns the requester's own connection info. Nothing is stored or logged.
import colos from '../../src/data/cf-colos.json';

export const onRequestGet = ({ request }) => {
  const cf = request.cf || {};
  const ip = request.headers.get('cf-connecting-ip');
  const num = (v) => (v == null || v === '' || isNaN(Number(v)) ? null : Number(v));

  let edge = null;
  if (cf.colo) {
    const c = colos[cf.colo];
    edge = { code: cf.colo, city: c?.[2] ?? null, country: c?.[3] ?? null, lat: c?.[0] ?? null, lon: c?.[1] ?? null };
  }

  const body = {
    ip: ip || null,
    ipVersion: ip ? (ip.includes(':') ? 6 : 4) : null,
    country: cf.country ?? null,
    region: cf.region ?? null,
    city: cf.city ?? null,
    postalCode: cf.postalCode ?? null,
    latitude: num(cf.latitude),
    longitude: num(cf.longitude),
    timezone: cf.timezone ?? null,
    asn: cf.asn ?? null,
    isp: cf.asOrganization ?? null,
    edge,
    protocol: cf.httpProtocol ?? null,
    tls: cf.tlsVersion ?? null,
    rttMs: cf.clientTcpRtt || null,
  };

  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
};
