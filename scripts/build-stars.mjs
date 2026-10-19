// scripts/build-stars.mjs
// Builds public/data/stars.json for /sky from the Yale Bright Star Catalogue,
// 5th revised ed. (Hoffleit & Warren 1991, CDS catalogue V/50). Public data.
//
//   node scripts/build-stars.mjs [path/to/catalog.gz]
//
// Without a path it downloads catalog.gz from CDS. Output per star:
// [hr, raDeg, decDeg, vmag, bv] at J2000 (the page precesses to date).

import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const SOURCE = "https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz";
const MAG_LIMIT = 4.6;

// A few well-known proper names, keyed by Bayer designation
const NAMES = {
  "Alp CMa": "Sirius", "Alp Car": "Canopus", "Alp Cen": "Rigil Kentaurus", "Alp Boo": "Arcturus",
  "Alp Lyr": "Vega", "Alp Aur": "Capella", "Bet Ori": "Rigel", "Alp CMi": "Procyon",
  "Alp Eri": "Achernar", "Alp Ori": "Betelgeuse", "Bet Cen": "Hadar", "Alp Aql": "Altair",
  "Alp Cru": "Acrux", "Alp Tau": "Aldebaran", "Alp Sco": "Antares", "Alp Vir": "Spica",
  "Bet Gem": "Pollux", "Alp PsA": "Fomalhaut", "Alp Cyg": "Deneb", "Bet Cru": "Mimosa",
  "Alp Leo": "Regulus", "Alp UMi": "Polaris", "Alp Gem": "Castor", "Alp Per": "Mirfak",
  "Alp UMa": "Dubhe", "Eta UMa": "Alkaid", "Gam Ori": "Bellatrix", "Bet Tau": "Elnath",
  "Eps Ori": "Alnilam", "Zet Ori": "Alnitak", "Del Ori": "Mintaka", "Kap Ori": "Saiph",
  "Bet Leo": "Denebola", "Alp And": "Alpheratz", "Alp Peg": "Markab", "Bet Per": "Algol",
  "Alp Oph": "Rasalhague", "Eps Sgr": "Kaus Australis", "Lam Sco": "Shaula", "Eps UMa": "Alioth",
  "Zet UMa": "Mizar", "Bet Cyg": "Albireo", "Gam Cyg": "Sadr", "Alp Cas": "Schedar",
};

// Stick figures for a handful of famous constellations (Bayer pairs)
const FIGURES = {
  Orion: "Alp-Gam Gam-Del Alp-Zet Del-Eps Eps-Zet Zet-Kap Del-Bet Alp-Lam Gam-Lam",
  "Ursa Major": "Alp-Bet Bet-Gam Gam-Del Del-Alp Del-Eps Eps-Zet Zet-Eta",
  "Ursa Minor": "Alp-Del Del-Eps Eps-Zet Zet-Bet Bet-Gam Gam-Eta Eta-Zet",
  Cassiopeia: "Eps-Del Del-Gam Gam-Alp Alp-Bet",
  Cygnus: "Alp-Gam Gam-Eta Eta-Bet Del-Gam Gam-Eps",
  Lyra: "Alp-Zet Zet-Bet Bet-Gam Gam-Del Del-Zet",
  Aquila: "Gam-Alp Alp-Bet",
  Scorpius: "Bet-Del Del-Pi Del-Sig Sig-Alp Alp-Tau Tau-Eps Eps-Mu Mu-Zet Zet-Eta Eta-The The-Iot Iot-Kap Kap-Lam Lam-Ups",
  Crux: "Alp-Gam Bet-Del",
  Leo: "Alp-Eta Eta-Gam Gam-Zet Zet-Mu Mu-Eps Gam-Del Del-Bet Bet-The The-Alp",
  "Canis Major": "Bet-Alp Alp-Del Del-Eps Del-Eta",
  Gemini: "Alp-Bet Alp-Tau Tau-Eps Eps-Mu Bet-Del Del-Zet Zet-Gam",
  Taurus: "Gam-Del Del-Eps Gam-The The-Alp Alp-Zet Eps-Bet",
  Sagittarius: "Gam-Del Del-Eps Eps-Gam Del-Lam Lam-Phi Phi-Del Phi-Sig Sig-Tau Tau-Zet Zet-Phi Zet-Eps",
};
const FIGURE_CON = {
  Orion: "Ori", "Ursa Major": "UMa", "Ursa Minor": "UMi", Cassiopeia: "Cas", Cygnus: "Cyg",
  Lyra: "Lyr", Aquila: "Aql", Scorpius: "Sco", Crux: "Cru", Leo: "Leo", "Canis Major": "CMa",
  Gemini: "Gem", Taurus: "Tau", Sagittarius: "Sgr",
};
// The Great Square spans two constellations, so it is listed by full key
const SQUARE = [["Alp Peg", "Bet Peg"], ["Bet Peg", "Alp And"], ["Alp And", "Gam Peg"], ["Gam Peg", "Alp Peg"]];

const raw = process.argv[2]
  ? readFileSync(process.argv[2])
  : Buffer.from(await (await fetch(SOURCE)).arrayBuffer());
const text = gunzipSync(raw).toString("latin1");

// Byte columns from the catalogue ReadMe (1-based, inclusive)
const col = (line, a, b) => line.slice(a - 1, b).trim();
const all = [];
for (const line of text.split(/\r?\n/)) {
  if (line.length < 107) continue;
  const hr = Number(col(line, 1, 4));
  const raH = col(line, 76, 77);
  const vmag = col(line, 103, 107);
  if (!raH || !vmag) continue; // a few entries are novae/galaxies without positions
  const ra = (Number(raH) + Number(col(line, 78, 79)) / 60 + Number(col(line, 80, 83)) / 3600) * 15;
  const sign = line[83] === "-" ? -1 : 1;
  const dec = sign * (Number(col(line, 85, 86)) + Number(col(line, 87, 88)) / 60 + Number(col(line, 89, 90)) / 3600);
  const bv = col(line, 110, 114);
  const bayer = col(line, 8, 10);
  const con = col(line, 12, 14);
  all.push({
    hr, ra, dec, vmag: Number(vmag),
    bv: bv === "" ? null : Number(bv),
    key: bayer && con ? `${bayer} ${con}` : null,
  });
}

// Brightest star for each Bayer key (handles Alp1/Alp2-style components)
const byKey = new Map();
for (const s of all) {
  if (!s.key) continue;
  const prev = byKey.get(s.key);
  if (!prev || s.vmag < prev.vmag) byKey.set(s.key, s);
}
const find = (key) => {
  const s = byKey.get(key);
  if (!s) throw new Error(`Star not found: ${key}`);
  return s;
};

const keep = new Set(all.filter((s) => s.vmag <= MAG_LIMIT).map((s) => s.hr));
const lines = [];
for (const [name, pairs] of Object.entries(FIGURES)) {
  const segs = pairs.split(" ").map((p) => p.split("-").map((b) => find(`${b} ${FIGURE_CON[name]}`).hr));
  lines.push({ name, segs });
}
lines.push({ name: "Pegasus", segs: SQUARE.map((p) => p.map((k) => find(k).hr)) });
for (const { segs } of lines) for (const seg of segs) seg.forEach((hr) => keep.add(hr));

const names = {};
for (const [key, name] of Object.entries(NAMES)) {
  const s = find(key);
  names[s.hr] = name;
  keep.add(s.hr);
}

const r = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
const stars = all
  .filter((s) => keep.has(s.hr))
  .sort((a, b) => a.vmag - b.vmag)
  .map((s) => [s.hr, r(s.ra, 4), r(s.dec, 4), s.vmag, s.bv]);

const out = {
  source: "Yale Bright Star Catalogue, 5th rev. ed. (Hoffleit & Warren 1991), CDS V/50",
  epoch: "J2000",
  stars,
  names,
  lines,
};
writeFileSync(new URL("../public/data/stars.json", import.meta.url), JSON.stringify(out));
console.log(`${stars.length} stars, ${lines.length} figures, ${Object.keys(names).length} names`);
