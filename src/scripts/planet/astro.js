// src/scripts/planet/astro.js
// Sun, moon and satellite maths for /planet. Pure functions, no DOM.

import * as Astronomy from "astronomy-engine";
// See lib/satellite.js for why satellite.js isn't imported by package name
import { twoline2satrec, propagate, gstime, eciToGeodetic } from "../lib/satellite.js";

const DEG = Math.PI / 180;

export const wrapLon = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;

// Point on Earth where the body is straight overhead (geocentric, true equator
// and Greenwich apparent sidereal time of date)
function subPoint(body, date) {
  const vec = Astronomy.GeoVector(body, date, true);
  const eqd = Astronomy.RotateVector(Astronomy.Rotation_EQJ_EQD(date), vec);
  const { ra, dec } = Astronomy.EquatorFromVector(eqd);
  const gast = Astronomy.SiderealTime(date);
  return { lat: dec, lon: wrapLon((ra - gast) * 15) };
}

export const subsolar = (date) => subPoint(Astronomy.Body.Sun, date);
export const sublunar = (date) => subPoint(Astronomy.Body.Moon, date);

// Sun elevation in degrees at a place, from the subsolar point (no refraction)
export function sunElevation(sub, lat, lon) {
  const s =
    Math.sin(lat * DEG) * Math.sin(sub.lat * DEG) +
    Math.cos(lat * DEG) * Math.cos(sub.lat * DEG) * Math.cos((lon - sub.lon) * DEG);
  return Math.asin(Math.max(-1, Math.min(1, s))) / DEG;
}

// Daylight state for an elevation. -0.833° is the standard sunrise/sunset
// altitude (refraction plus the sun's radius).
export function daylightState(elev) {
  if (elev > -0.833) return "day";
  if (elev > -6) return "civil";
  if (elev > -12) return "nautical";
  if (elev > -18) return "astronomical";
  return "night";
}

// Next sunrise or sunset for an observer, null if it doesn't happen within 2 days
export function nextSunEvent(lat, lon, date, kind) {
  const obs = new Astronomy.Observer(lat, lon, 0);
  const t = Astronomy.SearchRiseSet(Astronomy.Body.Sun, obs, kind === "rise" ? 1 : -1, date, 2);
  return t ? t.date : null;
}

// The four principal phases are moments; give each about a day either side
function phaseName(angle) {
  const near = (a) => Math.abs(((angle - a + 540) % 360) - 180) < 12;
  if (near(0)) return "New moon";
  if (near(90)) return "First quarter";
  if (near(180)) return "Full moon";
  if (near(270)) return "Last quarter";
  if (angle < 90) return "Waxing crescent";
  if (angle < 180) return "Waxing gibbous";
  if (angle < 270) return "Waning gibbous";
  return "Waning crescent";
}

export function moonInfo(date) {
  const angle = Astronomy.MoonPhase(date); // 0 new, 90 first quarter, 180 full
  const lit = Astronomy.Illumination(Astronomy.Body.Moon, date).phase_fraction;
  return { angle, lit, name: phaseName(angle) };
}

// --- Satellites ---
export function makeSat({ name, line1, line2 }) {
  try {
    const rec = twoline2satrec(line1, line2);
    return rec && !rec.error ? { name, rec } : null;
  } catch {
    return null;
  }
}

// { lat, lon, alt (km), speed (km/s, inertial) } or null
export function satPosition(sat, date) {
  const pv = propagate(sat.rec, date);
  if (!pv || !pv.position || typeof pv.position === "boolean") return null;
  const geo = eciToGeodetic(pv.position, gstime(date));
  const v = pv.velocity;
  return {
    lat: geo.latitude / DEG,
    lon: wrapLon(geo.longitude / DEG),
    alt: geo.height,
    speed: Math.hypot(v.x, v.y, v.z),
  };
}

// Ground track from -minutes to +minutes around date, as [{ lon, lat, t }]
export function groundTrack(sat, date, minutes = 90, stepSec = 30) {
  const pts = [];
  const t0 = date.getTime();
  for (let s = -minutes * 60; s <= minutes * 60; s += stepSec) {
    const p = satPosition(sat, new Date(t0 + s * 1000));
    if (p) pts.push({ lon: p.lon, lat: p.lat, t: s });
  }
  return pts;
}
