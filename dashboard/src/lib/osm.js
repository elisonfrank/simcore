const OVERPASS_MIRRORS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
];

const FETCH_TIMEOUT_MS = 15000;

// Cross-type fallbacks when a type has no candidates
const TYPE_FALLBACKS = {
  commercial: ['administrative', 'social'],
  leisure: ['recreation', 'agricultural'],
  recreation: ['leisure'],
  residential: ['commercial', 'administrative'],
  government: ['administrative', 'education'],
  administrative: ['government', 'education'],
  education: ['social', 'administrative'],
  healthcare: ['administrative', 'social'],
  social: ['education', 'administrative'],
  agricultural: ['leisure', 'residential'],
};

const TYPE_MATCHERS = {
  commercial: [
    (t) => t.shop,
    (t) => t.amenity === 'marketplace',
    (t) => t.amenity === 'cafe',
    (t) => t.amenity === 'restaurant',
    (t) => t.amenity === 'bar',
    (t) => t.amenity === 'pub',
    (t) => t.amenity === 'fast_food',
    (t) => t.amenity === 'bank',
    (t) => t.amenity === 'pharmacy',
    (t) => t.tourism === 'hotel',
    (t) => t.building === 'commercial',
    (t) => t.building === 'retail',
    (t) => t.landuse === 'commercial',
    (t) => t.landuse === 'retail',
  ],
  residential: [
    (t) => t.building === 'apartments',
    (t) => t.building === 'residential',
    (t) => t.building === 'house',
    (t) => t.landuse === 'residential',
    (t) => t.place === 'neighbourhood' || t.place === 'suburb' || t.place === 'quarter',
  ],
  leisure: [
    (t) => t.leisure === 'park',
    (t) => t.leisure === 'garden',
    (t) => t.leisure === 'playground',
    (t) => t.tourism === 'attraction',
    (t) => t.tourism === 'viewpoint',
  ],
  government: [
    (t) => t.amenity === 'townhall',
    (t) => t.office === 'government',
  ],
  administrative: [
    (t) => t.amenity === 'townhall',
    (t) => t.office === 'government',
  ],
  education: [
    (t) => t.amenity === 'school',
    (t) => t.amenity === 'university',
    (t) => t.amenity === 'college',
    (t) => t.amenity === 'library',
  ],
  healthcare: [
    (t) => t.amenity === 'hospital',
    (t) => t.amenity === 'clinic',
    (t) => t.healthcare,
  ],
  social: [
    (t) => t.amenity === 'place_of_worship',
    (t) => t.amenity === 'community_centre',
    (t) => t.amenity === 'social_centre',
  ],
  agricultural: [
    (t) => t.landuse === 'farmland',
    (t) => t.landuse === 'farm',
    (t) => t.landuse === 'orchard',
  ],
  recreation: [
    (t) => t.leisure === 'sports_centre',
    (t) => t.leisure === 'pitch',
    (t) => t.leisure === 'stadium',
    (t) => t.leisure === 'fitness_centre',
  ],
};

function buildQuery(lat, lon, radius) {
  // Permissive query — matching to scenario types happens client-side.
  // `place=city|town|village` nodes are critical: they mark urban centers.
  const filters = [
    `node["place"~"city|town|village"](around:${radius},${lat},${lon});`,
    `nwr["amenity"](around:${radius},${lat},${lon});`,
    `nwr["shop"](around:${radius},${lat},${lon});`,
    `nwr["leisure"](around:${radius},${lat},${lon});`,
    `nwr["tourism"](around:${radius},${lat},${lon});`,
    `nwr["healthcare"](around:${radius},${lat},${lon});`,
    `nwr["office"](around:${radius},${lat},${lon});`,
    `way["landuse"~"residential|commercial|retail|farmland|farm|orchard"](around:${radius},${lat},${lon});`,
    `way["building"~"apartments|residential|house|commercial|retail"](around:${radius},${lat},${lon});`,
    `node["place"~"neighbourhood|suburb|quarter|hamlet"](around:${radius},${lat},${lon});`,
  ];
  return `[out:json][timeout:30];(${filters.join('')});out center tags 500;`;
}

function getCoords(el) {
  if (typeof el.lat === 'number' && typeof el.lon === 'number') return [el.lat, el.lon];
  if (el.center) return [el.center.lat, el.center.lon];
  return null;
}

function matchesType(tags, type) {
  const matchers = TYPE_MATCHERS[type] || [];
  return matchers.some((fn) => fn(tags || {}));
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchPOIs(center, radius) {
  const [lat, lon] = center;
  const query = buildQuery(lat, lon, radius);
  let lastErr;
  for (const url of OVERPASS_MIRRORS) {
    try {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
      }, FETCH_TIMEOUT_MS);
      if (!res.ok) {
        lastErr = new Error(`${url} → ${res.status}`);
        continue;
      }
      const data = await res.json();
      console.log(`[SimCore] ${url} returned ${data.elements?.length || 0} elements`);
      return data.elements || [];
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('All Overpass mirrors failed');
}

// Find the real urban center for a given city name via Overpass place nodes.
// Much more reliable than Nominatim forward-geocode (which can return admin centroids).
export async function findUrbanCenterByName(seedCenter, cityName, stateName) {
  if (!cityName) return null;
  const [lat, lon] = seedCenter;
  const normalize = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const target = normalize(cityName);
  const targetState = stateName ? normalize(stateName) : null;

  // Query a large radius; OSM has a place node for virtually every town/city.
  const query = `[out:json][timeout:25];
    node["place"~"city|town|village"](around:80000,${lat},${lon});
    out tags;`;

  let elements = [];
  for (const url of OVERPASS_MIRRORS) {
    try {
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
      }, FETCH_TIMEOUT_MS);
      if (!res.ok) continue;
      const data = await res.json();
      elements = data.elements || [];
      if (elements.length > 0) break;
    } catch {}
  }
  if (elements.length === 0) return null;

  const PLACE_RANK = { city: 3, town: 2, village: 1 };
  let best = null;
  for (const el of elements) {
    const name = el.tags?.name ? normalize(el.tags.name) : '';
    if (!name) continue;
    const exactMatch = name === target;
    const includes = name.includes(target) || target.includes(name);
    if (!exactMatch && !includes) continue;

    const stateOk = !targetState || !el.tags['is_in:state'] ||
      normalize(el.tags['is_in:state']).includes(targetState);
    if (!stateOk) continue;

    const rank = PLACE_RANK[el.tags.place] || 1;
    const distDeg = Math.hypot(el.lat - lat, el.lon - lon);
    // Score: prefer exact name match, higher rank, closer distance
    const score = (exactMatch ? 1000 : 0) + rank * 100 - distDeg * 10;
    if (!best || score > best.score) {
      best = { coords: [el.lat, el.lon], name: el.tags.name, score, rank };
    }
  }
  if (best) {
    console.log(`[SimCore] Urban center resolved: "${best.name}" (place=${best.rank === 3 ? 'city' : best.rank === 2 ? 'town' : 'village'})`, best.coords);
    return best.coords;
  }
  return null;
}

export async function resolveScenarioLocations(scenarioLocations, center) {
  let pois = [];
  // Start at 10km — guarantees we capture the urban area even if the initial
  // center fell in a rural part of the municipality. Expand up to 25km.
  for (const radius of [10000, 15000, 25000]) {
    try {
      pois = await fetchPOIs(center, radius);
      if (pois.length >= 30) break;
    } catch (e) {
      console.warn(`[SimCore] Overpass ${radius}m failed:`, e.message);
    }
  }
  if (pois.length === 0) return null;
  console.log(`[SimCore] Found ${pois.length} POIs near`, center);

  // Strategy 1 (best): find explicit place=city|town|village nodes from OSM.
  // These mark the urban center tagged by cartographers. Pick by rank and distance.
  const PLACE_RANK = { city: 3, town: 2, village: 1 };
  const placeNodes = pois
    .filter((el) => el.type === 'node' && PLACE_RANK[el.tags?.place])
    .map((el) => ({
      coords: [el.lat, el.lon],
      rank: PLACE_RANK[el.tags.place],
      name: el.tags.name,
      dist: Math.hypot(el.lat - center[0], el.lon - center[1]),
    }));

  let urbanCenter = center;
  let urbanSource = 'initial';

  if (placeNodes.length > 0) {
    // Prefer highest rank (city > town > village); among equals, pick closest
    placeNodes.sort((a, b) => b.rank - a.rank || a.dist - b.dist);
    const pick = placeNodes[0];
    urbanCenter = pick.coords;
    urbanSource = `place=${pick.rank === 3 ? 'city' : pick.rank === 2 ? 'town' : 'village'} "${pick.name}"`;
    console.log(`[SimCore] Urban center via ${urbanSource}`, urbanCenter);
  } else {
    // Strategy 2 (fallback): densest 1km cell of POIs
    const CELL = 0.01; // ~1km
    const cells = new Map();
    for (const el of pois) {
      const c = getCoords(el);
      if (!c) continue;
      const key = `${Math.round(c[0] / CELL)}:${Math.round(c[1] / CELL)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(c);
    }
    let densest = [];
    for (const cell of cells.values()) if (cell.length > densest.length) densest = cell;
    if (densest.length >= 5) {
      const cLat = densest.reduce((s, c) => s + c[0], 0) / densest.length;
      const cLon = densest.reduce((s, c) => s + c[1], 0) / densest.length;
      urbanCenter = [cLat, cLon];
      urbanSource = `densest cluster (${densest.length} POIs)`;
      console.log(`[SimCore] Urban center via ${urbanSource}`, urbanCenter);
    }
  }

  // Group POIs by matching scenario type. Filter to POIs within ~3km of
  // the urban center so scenarios feel compact and in-town.
  const MAX_DIST_FROM_URBAN = 0.03; // ~3km
  const byType = {};
  for (const el of pois) {
    const coords = getCoords(el);
    if (!coords) continue;
    const dist = Math.hypot(coords[0] - urbanCenter[0], coords[1] - urbanCenter[1]);
    if (dist > MAX_DIST_FROM_URBAN) continue;
    for (const type in TYPE_MATCHERS) {
      if (matchesType(el.tags, type)) {
        if (!byType[type]) byType[type] = [];
        byType[type].push({ id: `${el.type}/${el.id}`, coords, tags: el.tags, distFromUrban: dist });
      }
    }
  }

  const result = {};
  const used = new Set();
  const placed = [];

  // Sort locations so types with fewer candidates get picked first (scarcity priority)
  const sortedLocs = Object.entries(scenarioLocations).sort((a, b) => {
    const countA = (byType[a[1].type] || []).length;
    const countB = (byType[b[1].type] || []).length;
    return countA - countB;
  });

  for (const [name, loc] of sortedLocs) {
    // Try primary type first, then cross-type fallbacks
    const typesToTry = [loc.type, ...(TYPE_FALLBACKS[loc.type] || [])];
    let candidates = [];
    for (const type of typesToTry) {
      candidates = (byType[type] || []).filter((c) => !used.has(c.id));
      if (candidates.length > 0) break;
    }
    if (candidates.length === 0) continue;

    // Pick the candidate that maximizes minimum distance to already-placed points (spread)
    let best = null;
    let bestScore = -Infinity;
    for (const cand of candidates) {
      let minDist = Infinity;
      for (const p of placed) {
        const d = Math.hypot(cand.coords[0] - p[0], cand.coords[1] - p[1]);
        if (d < minDist) minDist = d;
      }
      if (placed.length === 0) {
        // Prefer candidates closer to urban center for the first pick
        minDist = -Math.hypot(cand.coords[0] - urbanCenter[0], cand.coords[1] - urbanCenter[1]);
      } else {
        // For subsequent picks: maximize spread but penalize distance from urban center
        const urbanPenalty = Math.hypot(cand.coords[0] - urbanCenter[0], cand.coords[1] - urbanCenter[1]) * 0.5;
        minDist = minDist - urbanPenalty;
      }
      if (minDist > bestScore) {
        bestScore = minDist;
        best = cand;
      }
    }

    if (best) {
      result[name] = { coords: best.coords, osmName: best.tags?.name || null, osmTags: best.tags };
      used.add(best.id);
      placed.push(best.coords);
    }
  }

  return { locations: result, urbanCenter };
}
