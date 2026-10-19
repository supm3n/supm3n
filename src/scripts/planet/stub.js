// src/scripts/planet/stub.js
// Dev-only sample data for /planet?stub (astro dev has no /api). Real USGS
// events and CelesTrak elements from one day, with quake times kept relative
// to now. Never bundled in production builds.

// [mag, place, minutes ago, lon, lat, depth, id]
const QUAKES = [
  [2.8,"39 km S of Tolsona, Alaska",53,-146.171,61.732,12.6,"aka2026utctzh"],
  [2.7,"13 km SW of Manley Hot Springs, Alaska",64,-150.859,64.922,2.4,"aka2026utcjzj"],
  [4.3,"248 km SW of Tambolaka, Indonesia",168,117.885,-11.233,10,"us6000u3gm"],
  [5.7,"203 km WNW of Port-Olry, Vanuatu",189,165.497,-14.027,10,"us6000u3ge"],
  [5.7,"198 km NW of Port-Olry, Vanuatu",192,165.551,-14.037,10,"us6000u3ga"],
  [4.8,"88 km WNW of Hihifo, Tonga",217,-174.57,-15.673,156.8,"us6000u3g6"],
  [2.7,"16 km SSW of Jal, New Mexico",220,-103.29,31.987,6.6,"tx2026upoxoa"],
  [2.8,"17 km SW of Jal, New Mexico",233,-103.299,31.981,7.7,"tx2026upolzm"],
  [5.1,"South Sandwich Islands region",259,-27.085,-56.354,101.5,"us6000u3ft"],
  [3.3,"23 km SSW of Lovington, New Mexico",279,-103.472,32.759,6.5,"us6000u3fl"],
  [4.4,"147 km ENE of Lospalos, Timor Leste",283,128.213,-7.964,41.5,"us6000u3fm"],
  [4.2,"Rat Islands, Aleutian Islands, Alaska",337,178.369,51.518,52.2,"us6000u3de"],
  [4.6,"south of the Fiji Islands",351,179.871,-23.55,536.1,"us6000u3db"],
  [4.9,"77 km WSW of Murghob, Tajikistan",389,73.184,37.838,10,"us6000u3d2"],
  [4.6,"5 km E of San José El Ídolo, Guatemala",437,-91.373,14.454,109.7,"us6000u3cu"],
  [5.3,"116 km WNW of Höfn, Iceland",440,-17.514,64.577,10,"us6000u3ct"],
  [2.6,"17 km ESE of Pearsall, Texas",489,-98.934,28.824,7.9,"tx2026upfzqc"],
  [4.8,"56 km N of Ruteng, Indonesia",598,120.378,-8.104,10,"us6000u3ch"],
  [4.8,"212 km WNW of Port-Olry, Vanuatu",612,165.419,-13.993,10,"us6000u3ce"],
  [3.6,"115 km SSW of Nikolski, Alaska",620,-169.632,52.009,23,"aka2026usjwdz"],
  [4.1,"192 km NE of Lospalos, Timor Leste",654,128.382,-7.454,152.7,"us6000u3ca"],
  [5,"31 km NW of Jiangyou, China",667,104.458,31.948,10,"us6000u3c7"],
  [5.4,"196 km NW of Port-Olry, Vanuatu",684,165.569,-14.038,10,"us6000u3c6"],
  [4.7,"53 km NNE of Labuan Bajo, Indonesia",713,120.145,-8.087,10,"us6000u3c5"],
  [2.5,"16 km ESE of Pearsall, Texas",732,-98.95,28.818,7.3,"tx2026uoxyjy"],
  [4.9,"54 km NE of Labuan Bajo, Indonesia",738,120.187,-8.106,10,"us6000u3c1"],
  [4.9,"115 km NNW of Sola, Vanuatu",759,167.046,-12.953,10,"us6000u3bz"],
  [4.7,"163 km WNW of Tobelo, Indonesia",784,126.717,2.434,49,"us6000u3bv"],
  [4.9,"202 km NW of Port-Olry, Vanuatu",790,165.556,-13.956,10,"us6000u3bu"],
  [4.5,"2 km W of Lunca Jariștei, Romania",792,26.217,45.481,124.8,"us6000u3bs"],
  [5.2,"211 km WNW of Port-Olry, Vanuatu",823,165.334,-14.155,10,"us6000u3bk"],
  [5.4,"184 km WNW of Port-Olry, Vanuatu",832,165.638,-14.139,10,"us6000u3bi"],
  [3.5,"52 km E of Pedro Bay, Alaska",841,-153.177,59.821,125.8,"aka2026uscmes"],
  [5.3,"188 km NW of Port-Olry, Vanuatu",849,165.7,-13.982,10,"us6000u3be"],
  [6,"186 km NW of Port-Olry, Vanuatu",855,165.676,-14.053,10,"us6000u3bc"],
  [4.9,"203 km WNW of Port-Olry, Vanuatu",884,165.487,-14.042,10,"us6000u3b8"],
  [4.9,"218 km WNW of Port-Olry, Vanuatu",904,165.384,-13.952,10,"us6000u3b4"],
  [2.5,"5 km WSW of Burning Man Earth, Nevada",939,-119.289,40.748,1.5,"nn00925943"],
  [4.5,"Banda Sea",949,129.929,-6.337,157.8,"us6000u3ar"],
  [4.9,"68 km WSW of San Juan del Sur, Nicaragua",1006,-86.481,11.123,44,"us6000u3a8"],
  [4,"161 km S of Nikolski, Alaska",1016,-168.422,51.515,10,"us6000u3a4"],
  [2.9,"25 km WNW of Puerto Real, Puerto Rico",1026,-67.411,18.155,5.9,"pr71537203"],
  [2.7,"120 km SE of Ugashik, Alaska",1033,-156.187,56.656,13.1,"aka2026urwcep"],
  [2.6,"18 km SW of Jal, New Mexico",1102,-103.306,31.981,6.3,"tx2026uolqqc"],
  [2.9,"13 km SSW of Waikoloa, Hawaii",1215,-155.829,19.824,12.8,"hv75060646"],
  [2.7,"17 km SW of Jal, New Mexico",1227,-103.301,31.987,7.3,"tx2026uohnpt"],
  [3,"53 km SW of Adak, Alaska",1265,-177.205,51.553,18.3,"av94456048"],
  [2.6,"18 km SW of Jal, New Mexico",1270,-103.309,31.978,6.1,"tx2026uogdiy"],
  [2.7,"18 km SW of Jal, New Mexico",1272,-103.307,31.979,6.1,"tx2026uogbla"],
  [4.4,"33 km SE of Sơn La, Vietnam",1325,104.157,21.12,10,"us6000u38y"],
  [4.4,"Kermadec Islands region",1354,-179.925,-28.36,444.2,"us6000u38u"],
  [4.5,"Fiji region",1410,-178.659,-20.927,551.9,"us6000u38i"],
  [5.1,"129 km SSE of Kokopo, Papua New Guinea",1413,152.616,-5.457,10,"us6000u38g"],
  [2.5,"15 km NE of Milford, Utah",1436,-112.909,38.511,4,"uu80160806"],
  [4.7,"147 km SSW of Kokopo, Papua New Guinea",1438,151.841,-5.605,10,"us6000u38b"],
];

export const stubQuakes = () =>
  QUAKES.map(([mag, place, ago, lon, lat, depth, id]) => ({
    id, mag, place, lon, lat, depth,
    time: Date.now() - ago * 60e3,
    url: `https://earthquake.usgs.gov/earthquakes/eventpage/${id}`,
  }));

export const stubTle = () => [
  {
    "name": "ISS (ZARYA)",
    "line1": "1 25544U 98067A   26292.43498098  .00007189  00000+0  13878-3 0  9990",
    "line2": "2 25544  51.6326  45.2419 0006754 282.9887  77.0347 15.48939196591015"
  },
  {
    "name": "CSS (TIANHE)",
    "line1": "1 48274U 21035A   26292.40308027  .00021983  00000+0  25812-3 0  9994",
    "line2": "2 48274  41.4691 287.4881 0001600 180.3769 179.7069 15.60942210312567"
  }
];

export const stubWhoami = () => ({
  country: "PT", region: "Lisbon", city: "Lisbon",
  latitude: 38.72, longitude: -9.14, timezone: "Europe/Lisbon",
});
