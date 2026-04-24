import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useT, translateAction, translateLocation } from '../lib/i18n.jsx';

const DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const GRID_SCALE = 0.0022; // ~220m per grid unit

const AGENT_COLORS = [
  '#7c6aff', '#22d3ee', '#fb7185', '#fbbf24',
  '#34d399', '#f472b6', '#a78bfa', '#38bdf8',
  '#e879f9', '#4ade80',
];

// Below this zoom level, agent markers + lines are hidden.
// Location pins stay visible always (with count badge showing density).
const AGENT_VISIBILITY_ZOOM = 14;

function gridToGeo(gridPos, gridSize, center) {
  const [gx, gy] = gridPos;
  const [w, h] = gridSize;
  return [
    center[0] + ((h / 2) - gy) * GRID_SCALE,
    center[1] + (gx - (w / 2)) * GRID_SCALE,
  ];
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export default function MapView({ state, selectedAgent, onSelectAgent, mapCenter, realLocations }) {
  const { t, lang } = useT();
  const [currentZoom, setCurrentZoom] = useState(14);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const locationMarkersRef = useRef({});
  const locationIconStateRef = useRef({});
  const agentMarkersRef = useRef({});
  const agentIconStateRef = useRef({});
  const agentPositionsRef = useRef({});
  const agentLinesRef = useRef({});
  const agentLayerRef = useRef(null);
  const agentLocationRef = useRef({});
  const connectionLinesRef = useRef([]);
  const animFrameRef = useRef(null);
  const locationGeoRef = useRef({});

  // Initialize map once (does not depend on mapCenter)
  useEffect(() => {
    if (!containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: [-23.5505, -46.6333],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true,
    });

    L.tileLayer(DARK_TILES, { maxZoom: 19, opacity: 0.85 }).addTo(map);
    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Dedicated layer for agents + their connecting lines.
    // Toggled together based on zoom level.
    const agentLayer = L.layerGroup();
    agentLayerRef.current = agentLayer;
    if (map.getZoom() >= AGENT_VISIBILITY_ZOOM) agentLayer.addTo(map);

    map.on('zoomend', () => {
      const z = map.getZoom();
      setCurrentZoom(z);
      if (z >= AGENT_VISIBILITY_ZOOM) {
        if (!map.hasLayer(agentLayer)) agentLayer.addTo(map);
      } else {
        if (map.hasLayer(agentLayer)) map.removeLayer(agentLayer);
      }
    });
    setCurrentZoom(map.getZoom());

    mapRef.current = map;

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // When mapCenter changes: reset fit flag, clear stale agent positions, re-pan
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !Array.isArray(mapCenter) || mapCenter.length !== 2) return;
    const [lat, lng] = mapCenter;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    map._fitted = false;
    agentPositionsRef.current = {};
    map.setView([lat, lng], 14, { animate: true });
  }, [mapCenter]);

  // Update location markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !state?.environment) return;

    const env = state.environment;
    const gridSize = [env.width || 20, env.height || 20];
    const center = mapCenter || [-23.5505, -46.6333];
    const newGeo = {};

    // Create/update location markers
    Object.entries(env.locations || {}).forEach(([name, loc]) => {
      const real = realLocations?.[name];
      const geo = real?.coords || gridToGeo(loc.position, gridSize, center);
      const osmName = real?.osmName;
      const typeLabel = t(`locType.${loc.type}`);
      const displayName = translateLocation(name, t);
      newGeo[name] = geo;

      const iconKey = `${displayName}|${loc.occupant_count || 0}|${osmName || ''}|${typeLabel}|${loc.type}`;

      if (locationMarkersRef.current[name]) {
        locationMarkersRef.current[name].setLatLng(geo);
        if (locationIconStateRef.current[name] !== iconKey) {
          locationMarkersRef.current[name].setIcon(buildLocationIcon(displayName, loc, osmName, typeLabel));
          locationIconStateRef.current[name] = iconKey;
        }
      } else {
        const marker = L.marker(geo, {
          icon: buildLocationIcon(displayName, loc, osmName, typeLabel),
          interactive: true,
          zIndexOffset: 200,
          riseOnHover: true,
        });
        marker.addTo(map);
        locationMarkersRef.current[name] = marker;
        locationIconStateRef.current[name] = iconKey;
      }
    });

    locationGeoRef.current = newGeo;

    // Draw subtle connection lines between nearby locations
    connectionLinesRef.current.forEach(l => map.removeLayer(l));
    connectionLinesRef.current = [];
    const locs = Object.entries(newGeo);
    for (let i = 0; i < locs.length; i++) {
      for (let j = i + 1; j < locs.length; j++) {
        const d = Math.hypot(locs[i][1][0] - locs[j][1][0], locs[i][1][1] - locs[j][1][1]);
        if (d < GRID_SCALE * 12) {
          const line = L.polyline([locs[i][1], locs[j][1]], {
            color: 'rgba(124, 106, 255, 0.08)',
            weight: 1,
            dashArray: '6 8',
          });
          line.addTo(map);
          connectionLinesRef.current.push(line);
        }
      }
    }

    // Fit bounds on first load, after location change, or when real POIs arrive
    if (Object.keys(newGeo).length > 1 && !mapRef.current._fitted) {
      const bounds = L.latLngBounds(Object.values(newGeo));
      map.fitBounds(bounds.pad(0.3), { animate: true, maxZoom: 16, duration: 0.8 });
      mapRef.current._fitted = true;
    }
  }, [state?.environment, mapCenter, realLocations, lang]);

  // When realLocations arrives, reset fit flag so map re-frames on real POIs
  useEffect(() => {
    if (mapRef.current && realLocations && Object.keys(realLocations).length > 0) {
      mapRef.current._fitted = false;
      agentPositionsRef.current = {};
    }
  }, [realLocations]);

  // Update agent markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !state?.agents) return;

    const agents = state.agents;
    const agentIds = Object.keys(agents);
    const locGeo = locationGeoRef.current;

    // Group agents by location for orbital positioning
    const byLocation = {};
    agentIds.forEach(id => {
      const loc = agents[id].state?.location || agents[id].location;
      if (!byLocation[loc]) byLocation[loc] = [];
      byLocation[loc].push(id);
    });

    agentIds.forEach((id, globalIdx) => {
      const agent = agents[id];
      const locName = agent.state?.location || agent.location;
      const locCenter = locGeo[locName];
      if (!locCenter) return;

      const locGroup = byLocation[locName] || [id];
      const idxInGroup = locGroup.indexOf(id);
      const total = locGroup.length;

      // Fan agents BELOW the pin (south-facing arc) — never above.
      // Constant pixel distance via zoom-adaptive radius.
      const zoomScale = Math.pow(2, 15 - currentZoom);
      const orbitRadius = (0.0009 + total * 0.00025) * zoomScale;
      const arcWidth = Math.PI * 2 / 3; // 120° arc below
      const startAngle = -Math.PI / 2 - arcWidth / 2;
      const step = total > 1 ? arcWidth / (total - 1) : 0;
      const angle = total === 1 ? -Math.PI / 2 : startAngle + step * idxInGroup;
      // Note: `sin(angle)` is the LAT offset (negative = south).
      // We negate so negative sin → lower lat → visually south (below).
      const targetGeo = [
        locCenter[0] + orbitRadius * Math.sin(angle),
        locCenter[1] + orbitRadius * Math.cos(angle),
      ];

      const color = AGENT_COLORS[globalIdx % AGENT_COLORS.length];
      const name = agent.name || agent.persona?.name || 'Agent';
      const isSelected = id === selectedAgent;
      const rawAction = agent.state?.current_action || '';
      const action = translateAction(rawAction, t, (n) => translateLocation(n, t));

      const layer = agentLayerRef.current || map;
      // Create or update the thin line connecting avatar → location pin
      if (agentLinesRef.current[id]) {
        agentLinesRef.current[id].setLatLngs([targetGeo, locCenter]);
        agentLinesRef.current[id].setStyle({
          color: isSelected ? color : 'rgba(255,255,255,0.35)',
          weight: isSelected ? 1.5 : 1,
          opacity: isSelected ? 0.9 : 0.6,
        });
      } else {
        const line = L.polyline([targetGeo, locCenter], {
          color: isSelected ? color : 'rgba(255,255,255,0.35)',
          weight: isSelected ? 1.5 : 1,
          opacity: isSelected ? 0.9 : 0.6,
          dashArray: '3 4',
          interactive: false,
        });
        line.addTo(layer);
        agentLinesRef.current[id] = line;
      }

      const prevLocation = agentLocationRef.current[id];
      const locationChanged = prevLocation !== undefined && prevLocation !== locName;
      agentLocationRef.current[id] = locName;

      if (agentMarkersRef.current[id]) {
        if (locationChanged) {
          // Agent moved to a different location — animate smoothly
          const prev = agentPositionsRef.current[id] || targetGeo;
          const startTime = Date.now();
          const duration = 1200;
          const animateStep = () => {
            const elapsed = Date.now() - startTime;
            const tt = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - tt, 3);
            const lat = lerp(prev[0], targetGeo[0], eased);
            const lng = lerp(prev[1], targetGeo[1], eased);
            agentMarkersRef.current[id]?.setLatLng([lat, lng]);
            agentLinesRef.current[id]?.setLatLngs([[lat, lng], locCenter]);
            if (tt < 1) requestAnimationFrame(animateStep);
            else agentPositionsRef.current[id] = targetGeo;
          };
          animateStep();
        } else {
          // Same location (zoom change or no movement) — snap without animation
          agentMarkersRef.current[id].setLatLng(targetGeo);
          agentLinesRef.current[id]?.setLatLngs([targetGeo, locCenter]);
          agentPositionsRef.current[id] = targetGeo;
        }

        const iconKey = `${name}|${color}|${isSelected ? '1' : '0'}|${action}`;
        if (agentIconStateRef.current[id] !== iconKey) {
          agentMarkersRef.current[id].setIcon(createAgentIcon(name, color, isSelected, action));
          agentIconStateRef.current[id] = iconKey;
        }
      } else {
        const icon = createAgentIcon(name, color, isSelected, action);
        const marker = L.marker(targetGeo, { icon, zIndexOffset: isSelected ? 1000 : 100 });
        marker.on('click', () => onSelectAgent?.(id));
        marker.addTo(layer);
        agentMarkersRef.current[id] = marker;
        agentPositionsRef.current[id] = targetGeo;
        agentIconStateRef.current[id] = `${name}|${color}|${isSelected ? '1' : '0'}|${action}`;
      }

      if (agentMarkersRef.current[id]) {
        agentMarkersRef.current[id].setZIndexOffset(isSelected ? 1000 : 100);
      }
    });

    // Remove stale markers + their lines
    Object.keys(agentMarkersRef.current).forEach(id => {
      if (!agents[id]) {
        map.removeLayer(agentMarkersRef.current[id]);
        if (agentLinesRef.current[id]) {
          map.removeLayer(agentLinesRef.current[id]);
          delete agentLinesRef.current[id];
        }
        delete agentMarkersRef.current[id];
        delete agentIconStateRef.current[id];
        delete agentPositionsRef.current[id];
        delete agentLocationRef.current[id];
      }
    });
  }, [state?.agents, selectedAgent, onSelectAgent, currentZoom, t]);

  return <div ref={containerRef} style={styles.container} />;
}

const LOC_TYPE_COLORS = {
  commercial: '#fbbf24',
  residential: '#7c6aff',
  leisure: '#34d399',
  government: '#f472b6',
  administrative: '#f472b6',
  education: '#22d3ee',
  healthcare: '#fb7185',
  social: '#a78bfa',
  agricultural: '#84cc16',
  recreation: '#34d399',
  default: '#7c6aff',
};

function buildLocationIcon(name, loc, osmName, typeLabel) {
  const safeOsm = osmName ? osmName.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
  const osmLine = safeOsm ? `<span class="loc-osm">${safeOsm}</span>` : '';
  const color = LOC_TYPE_COLORS[loc.type] || LOC_TYPE_COLORS.default;
  const count = loc.occupant_count || 0;
  const countBadge = count > 0 ? `<span class="loc-count-badge">${count}</span>` : '';
  const safeId = 'p' + name.replace(/[^a-zA-Z0-9]/g, '') + '_' + loc.type;

  // Pin always visible (= location). Hover reveals just the info card.
  return L.divIcon({
    className: '',
    html: `
      <div class="loc-marker">
        <svg class="loc-pin" width="24" height="32" viewBox="0 0 36 48" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <radialGradient id="g-${safeId}" cx="40%" cy="35%" r="60%">
              <stop offset="0%" stop-color="${color}" stop-opacity="1"/>
              <stop offset="60%" stop-color="${color}" stop-opacity="0.95"/>
              <stop offset="100%" stop-color="${color}" stop-opacity="0.5"/>
            </radialGradient>
            <filter id="s-${safeId}" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.5"/>
            </filter>
          </defs>
          <ellipse cx="18" cy="45" rx="6" ry="1.5" fill="rgba(0,0,0,0.5)" filter="url(#s-${safeId})"/>
          <path d="M18 2 C9 2 2 9 2 18 C2 28 18 44 18 44 C18 44 34 28 34 18 C34 9 27 2 18 2 Z"
                fill="url(#g-${safeId})"
                stroke="rgba(255,255,255,0.25)" stroke-width="1"/>
          <circle cx="18" cy="17" r="5" fill="rgba(255,255,255,0.9)"/>
          <circle cx="18" cy="17" r="3" fill="${color}"/>
        </svg>
        ${countBadge}
        <div class="loc-card">
          <span class="loc-name">${name}</span>
          ${osmLine}
          <span class="loc-meta">${typeLabel || loc.type}</span>
        </div>
      </div>
    `,
    iconSize: [24, 32],
    iconAnchor: [12, 32],
  });
}

function createAgentIcon(name, color, isSelected, action) {
  const initials = name.substring(0, 2).toUpperCase();
  const size = isSelected ? 30 : 26;
  const glowSize = isSelected ? 18 : 8;
  const borderColor = isSelected ? '#fff' : 'rgba(255,255,255,0.3)';
  const borderWidth = isSelected ? 2 : 1.5;

  return L.divIcon({
    className: '',
    html: `
      <div style="
        position: relative;
        transition: transform 300ms ease;
        cursor: pointer;
        filter: drop-shadow(0 2px 6px rgba(0,0,0,0.5));
      ">
        ${isSelected ? `<div style="
          position:absolute; inset:-6px;
          border-radius:50%;
          border:2px solid ${color};
          opacity:0.4;
          animation: pulse-ring 2s ease-out infinite;
        "></div>` : ''}
        <div style="
          width:${size}px; height:${size}px;
          border-radius:50%;
          background: linear-gradient(135deg, ${color}, ${color}cc);
          display:flex; align-items:center; justify-content:center;
          font-size:${isSelected ? 11 : 10}px; font-weight:700; color:#fff;
          border:${borderWidth}px solid ${borderColor};
          box-shadow: 0 0 ${glowSize}px ${color}50;
          font-family: 'Inter', -apple-system, sans-serif;
          letter-spacing: 0.3px;
        ">${initials}</div>
        ${action ? `<div title="${action}" style="display:none;"></div>` : ''}
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const styles = {
  container: {
    position: 'absolute',
    inset: 0,
    zIndex: 0,
  },
};
