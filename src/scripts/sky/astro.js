// src/scripts/sky/astro.js
// Sun, Moon, planets and stars in the observer's horizon frame, via astronomy-engine.
// Angles in degrees; azimuth from north through east.

import * as A from "astronomy-engine";

const DEG = Math.PI / 180;

export const PLANETS = [
  { id: "mercury", name: "Mercury", body: A.Body.Mercury, color: "#cbd5e1", eye: true },
  { id: "venus", name: "Venus", body: A.Body.Venus, color: "#fef3c7", eye: true },
  { id: "mars", name: "Mars", body: A.Body.Mars, color: "#fb923c", eye: true },
  { id: "jupiter", name: "Jupiter", body: A.Body.Jupiter, color: "#fde68a", eye: true },
  { id: "saturn", name: "Saturn", body: A.Body.Saturn, color: "#fcd34d", eye: true },
  { id: "uranus", name: "Uranus", body: A.Body.Uranus, color: "#67e8f9", eye: false },
  { id: "neptune", name: "Neptune", body: A.Body.Neptune, color: "#93c5fd", eye: false },
];

export const makeObserver = (lat, lon) => new A.Observer(lat, lon, 0);

// Apparent (refracted) alt/az of a solar-system body
export function bodyHorizon(body, date, obs) {
  const eq = A.Equator(body, date, obs, true, true);
  const h = A.Horizon(date, obs, eq.ra, eq.dec, "normal");
  return { alt: h.altitude, az: h.azimuth };
}

// Sun altitude for the observer plus geocentric unit vector to the Sun
// (J2000 equator), for satellite shadow tests
export function sunState(date, obs) {
  const gv = A.GeoVector(A.Body.Sun, date, true);
  const len = Math.hypot(gv.x, gv.y, gv.z);
  return { alt: bodyHorizon(A.Body.Sun, date, obs).alt, dir: [gv.x / len, gv.y / len, gv.z / len] };
}

export function skyPhase(sunAlt) {
  if (sunAlt > -0.833) return "Daylight";
  if (sunAlt > -6) return "Civil twilight";
  if (sunAlt > -12) return "Nautical twilight";
  if (sunAlt > -18) return "Astronomical twilight";
  return "Night";
}

export function moonPhaseName(angle) {
  if (angle < 6 || angle >= 354) return "New Moon";
  if (angle < 84) return "Waxing Crescent";
  if (angle < 96) return "First Quarter";
  if (angle < 174) return "Waxing Gibbous";
  if (angle < 186) return "Full Moon";
  if (angle < 264) return "Waning Gibbous";
  if (angle < 276) return "Last Quarter";
  return "Waning Crescent";
}

const nextEvent = (body, obs, dir, date) => {
  const t = A.SearchRiseSet(body, obs, dir, date, 2);
  return t ? t.date : null;
};

// Everything that changes slowly: refreshed once a minute
export function solarSystem(date, obs) {
  const sun = bodyHorizon(A.Body.Sun, date, obs);
  const moon = bodyHorizon(A.Body.Moon, date, obs);
  const moonIllum = A.Illumination(A.Body.Moon, date);
  const phaseAngle = A.MoonPhase(date);
  const planets = PLANETS.map((p) => {
    const pos = bodyHorizon(p.body, date, obs);
    const out = { ...p, ...pos, mag: A.Illumination(p.body, date).mag };
    // Naked-eye planets below the horizon: when and where they rise next
    if (p.eye && pos.alt < 0) {
      const t = A.SearchRiseSet(p.body, obs, +1, date, 1);
      if (t) out.rise = { date: t.date, az: bodyHorizon(p.body, t.date, obs).az };
    }
    return out;
  });
  return {
    sun: {
      ...sun,
      rise: nextEvent(A.Body.Sun, obs, +1, date),
      set: nextEvent(A.Body.Sun, obs, -1, date),
    },
    moon: {
      ...moon,
      fraction: moonIllum.phase_fraction,
      phaseAngle,
      phaseName: moonPhaseName(phaseAngle),
      rise: nextEvent(A.Body.Moon, obs, +1, date),
      set: nextEvent(A.Body.Moon, obs, -1, date),
    },
    planets,
    sunDir: sunState(date, obs).dir,
  };
}

// Catalogue stars are J2000 unit vectors; one rotation matrix (precession,
// nutation, Earth rotation) takes them all to the horizon frame.
export function starVectors(stars) {
  const v = new Float64Array(stars.length * 3);
  stars.forEach(([, ra, dec], i) => {
    const r = ra * DEG, d = dec * DEG;
    v[i * 3] = Math.cos(d) * Math.cos(r);
    v[i * 3 + 1] = Math.cos(d) * Math.sin(r);
    v[i * 3 + 2] = Math.sin(d);
  });
  return v;
}

// Fills out[i*2] = alt, out[i*2+1] = az (degrees, refracted)
export function starsHorizon(vecs, date, obs, out) {
  const m = A.Rotation_EQJ_HOR(date, obs).rot;
  const n = vecs.length / 3;
  for (let i = 0; i < n; i++) {
    const x = vecs[i * 3], y = vecs[i * 3 + 1], z = vecs[i * 3 + 2];
    // Same convention as A.RotateVector; HOR is x = north, y = west, z = up
    const hn = m[0][0] * x + m[1][0] * y + m[2][0] * z;
    const hw = m[0][1] * x + m[1][1] * y + m[2][1] * z;
    const hu = m[0][2] * x + m[1][2] * y + m[2][2] * z;
    const alt = Math.asin(Math.max(-1, Math.min(1, hu))) / DEG;
    let az = Math.atan2(-hw, hn) / DEG;
    if (az < 0) az += 360;
    out[i * 2] = alt > -1 ? alt + A.Refraction("normal", alt) : alt;
    out[i * 2 + 1] = az;
  }
  return out;
}
