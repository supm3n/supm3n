// src/scripts/lib/satellite.js
// The plain-JS parts of satellite.js (SGP4), shared by /sky and /planet.
// The package entry also re-exports its WebAssembly build, which breaks the
// static build ("Module format iife does not support top-level await"), and its
// exports map hides subpaths, so the dist modules are imported by path here.
export { twoline2satrec } from "../../../node_modules/satellite.js/dist/io.js";
export { propagate, gstime } from "../../../node_modules/satellite.js/dist/propagation.js";
export { eciToEcf, eciToGeodetic, geodeticToEcf } from "../../../node_modules/satellite.js/dist/transforms.js";
