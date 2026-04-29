import { useState, useMemo, useEffect, useRef } from 'react';
import { useSimulation } from './hooks/useSimulation';
import MapView from './components/MapView';
import AgentInspector from './components/AgentInspector';
import Timeline from './components/Timeline';
import LogStream from './components/LogStream';
import EventInjector from './components/EventInjector';
import PostMortem from './components/PostMortem';
import BreakingBanner from './components/BreakingBanner';
import ScenarioLibrary from './components/ScenarioLibrary';
import ScenarioWizard from './components/ScenarioWizard';
import { resolveScenarioLocations, findUrbanCenterByName, geocodeLocation } from './lib/osm';
import { useT, translateLocation } from './lib/i18n.jsx';

const AGENT_COLORS = [
  '#7c6aff', '#22d3ee', '#fb7185', '#fbbf24',
  '#34d399', '#f472b6', '#a78bfa', '#38bdf8',
  '#e879f9', '#4ade80',
];

function App() {
  const { t, lang, setLang } = useT();
  const { state, events, connected, injectEvent, control, lastSignificantEvent } = useSimulation();
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [locationLabel, setLocationLabel] = useState('');
  const [showActivity, setShowActivity] = useState(true);
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [realLocations, setRealLocations] = useState(null);
  const [resolvingLocations, setResolvingLocations] = useState(false);
  const [firstState, setFirstState] = useState(null);
  const [showPostMortem, setShowPostMortem] = useState(false);
  const [dismissedPostMortem, setDismissedPostMortem] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [editScenario, setEditScenario] = useState(null);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const inflightResolveRef = useRef(null);

  const selectedAgent = state?.agents?.[selectedAgentId] || null;
  const agentIndex = state?.agents
    ? Object.keys(state.agents).indexOf(selectedAgentId)
    : 0;

  const locationNames = useMemo(() => {
    if (!state?.environment?.locations) return [];
    return Object.keys(state.environment.locations);
  }, [state?.environment?.locations]);

  const agentList = useMemo(() => {
    if (!state?.agents) return [];
    return Object.entries(state.agents).map(([id, agent], idx) => ({
      id,
      name: agent.name || agent.persona?.name || 'Agent',
      location: agent.state?.location || agent.location || '?',
      action: agent.state?.current_action || '',
      mood: agent.state?.mood ?? 0,
      energy: agent.state?.energy ?? 1,
      color: AGENT_COLORS[idx % AGENT_COLORS.length],
    }));
  }, [state?.agents]);

  // Geolocation: saved → browser GPS → IP fallback → default
  useEffect(() => {
    // Prefer last-known location from localStorage — avoids flaky IP geolocation
    // on refresh and respects the user's manual choice.
    try {
      const saved = localStorage.getItem('simcore:location');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.center?.length === 2 && parsed?.label) {
          setMapCenter(parsed.center);
          setLocationLabel(parsed.label);
          return;
        }
      }
    } catch {}

    let done = false;
    const apply = (lat, lng, label) => {
      if (done) return;
      done = true;
      setMapCenter([lat, lng]);
      setLocationLabel(label);
      try {
        localStorage.setItem('simcore:location', JSON.stringify({ center: [lat, lng], label }));
      } catch {}
    };

    const tryIp = () => {
      fetch('https://ipapi.co/json/')
        .then(r => r.json())
        .then(d => {
          if (d.latitude && d.longitude) {
            // Use IP coords as starting point, but route through resolveCity
            // so we land on the urban center, not the ISP's rural coordinates.
            resolveCity(d.latitude, d.longitude, `${d.city || ''}, ${d.country_code || ''}`.trim().replace(/^,\s*/, ''));
          } else {
            apply(-23.5505, -46.6333, 'São Paulo, BR');
          }
        })
        .catch(() => apply(-23.5505, -46.6333, 'São Paulo, BR'));
    };

    const pickUrbanCenter = (results) => {
      // Prefer place=city/town/village nodes — these mark the urban center,
      // not the municipality polygon centroid (which can be rural).
      const placePriority = ['city', 'town', 'village', 'suburb', 'neighbourhood', 'hamlet'];
      for (const type of placePriority) {
        const hit = results.find((r) => r.class === 'place' && r.type === type);
        if (hit) return [parseFloat(hit.lat), parseFloat(hit.lon)];
      }
      return results[0] ? [parseFloat(results[0].lat), parseFloat(results[0].lon)] : null;
    };

    const resolveCity = (lat, lon, fallbackLabel) => {
      fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`)
        .then(r => r.json())
        .then(async (d) => {
          const a = d.address || {};
          const city = a.city || a.town || a.municipality || a.county || a.village || a.hamlet || '';
          const state = a.state || '';
          const country = a.country_code?.toUpperCase() || '';
          const label = [city, country].filter(Boolean).join(', ') || fallbackLabel;
          if (!city) {
            apply(lat, lon, label);
            return;
          }
          // Strategy 1: Overpass place node lookup by name (most reliable)
          try {
            const urban = await findUrbanCenterByName([lat, lon], city, state);
            if (urban) {
              apply(urban[0], urban[1], label);
              return;
            }
          } catch {}
          // Strategy 2: Nominatim forward geocode + pickUrbanCenter
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=10&addressdetails=1&q=${encodeURIComponent(`${city}, ${country}`)}`);
            const arr = await res.json();
            const center = pickUrbanCenter(arr);
            if (center) {
              apply(center[0], center[1], label);
              return;
            }
          } catch {}
          // Strategy 3: give up and use raw coords
          apply(lat, lon, label);
        })
        .catch(() => apply(lat, lon, fallbackLabel));
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolveCity(pos.coords.latitude, pos.coords.longitude, 'Your location'),
        () => tryIp(),
        { timeout: 4000 }
      );
    } else {
      tryIp();
    }
  }, []);

  // Show library when there's truly no simulation (never had state, or sim ended and post-mortem was dismissed)
  useEffect(() => {
    if (!state && !showPostMortem) setShowLibrary(true);
  }, [state]);

  // Capture initial state snapshot for post-mortem comparison
  useEffect(() => {
    if (state && !firstState) setFirstState(state);
  }, [state, firstState]);

  // Detect simulation end → auto-show post-mortem once
  useEffect(() => {
    if (!state?.clock) return;
    const finished = state.clock.tick >= state.clock.max_ticks || state.clock.progress >= 1;
    if (finished && !dismissedPostMortem) setShowPostMortem(true);
  }, [state?.clock?.tick, state?.clock?.max_ticks, state?.clock?.progress, dismissedPostMortem]);

  // Stable key derived from scenario location names — avoids re-running the
  // effect every tick just because the backend sends a new state object.
  const scenarioLocKeys = useMemo(() => {
    if (!state?.environment?.locations) return '';
    return Object.keys(state.environment.locations).sort().join('|');
  }, [state?.environment?.locations]);

  // Resolve scenario locations to real OSM POIs when city or scenario changes
  useEffect(() => {
    if (!mapCenter || !scenarioLocKeys || !locationLabel) return;
    const locs = state?.environment?.locations;
    if (!locs) return;
    const citiesKey = Object.values(locs).map(l => l.city || '').join('|');
    const cacheKey = `simcore:osm:v10:${locationLabel}:${scenarioLocKeys}:${citiesKey}`;

    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed.locations) {
          setRealLocations(parsed.locations);
          return;
        }
      } catch {}
    }

    // Guard: if a resolution for this exact cacheKey is already inflight, skip.
    if (inflightResolveRef.current === cacheKey) return;
    inflightResolveRef.current = cacheKey;

    setResolvingLocations(true);

    const locsArray = Object.entries(locs);
    const withCity = locsArray.filter(([, loc]) => loc.city?.trim());
    const withoutCity = locsArray.filter(([, loc]) => !loc.city?.trim());

    const cityResolutions = withCity.map(async ([name, loc]) => {
      const coords = await geocodeLocation(name, loc.city);
      return coords ? [name, { coords, osmName: loc.city }] : null;
    });

    const locsForOsm = withoutCity.length > 0
      ? Object.fromEntries(withoutCity)
      : null;

    Promise.all([
      Promise.all(cityResolutions),
      locsForOsm ? resolveScenarioLocations(locsForOsm, mapCenter) : Promise.resolve(null),
    ]).then(([cityResults, osmResult]) => {
        if (inflightResolveRef.current !== cacheKey) return; // stale response
        const resolved = { ...(osmResult?.locations || {}) };
        cityResults.forEach(r => { if (r) resolved[r[0]] = r[1]; });
        const urbanCenter = osmResult?.urbanCenter;
        if (resolved && Object.keys(resolved).length > 0) {
          const payload = { locations: resolved, urbanCenter };
          localStorage.setItem(cacheKey, JSON.stringify(payload));
          setRealLocations(resolved);

          // Only re-center when there are NO city-geocoded locations.
          // When city locations exist, MapView's fitBounds handles navigation.
          if (urbanCenter && withCity.length === 0) {
            const distKm = Math.hypot(
              (urbanCenter[0] - mapCenter[0]) * 111,
              (urbanCenter[1] - mapCenter[1]) * 111 * Math.cos(urbanCenter[0] * Math.PI / 180)
            );
            if (distKm > 2) {
              setMapCenter(urbanCenter);
              try {
                localStorage.setItem('simcore:location', JSON.stringify({ center: urbanCenter, label: locationLabel }));
              } catch {}
            }
          }
        } else {
          setRealLocations(null);
        }
      })
      .catch(() => {
        if (inflightResolveRef.current === cacheKey) setRealLocations(null);
      })
      .finally(() => {
        if (inflightResolveRef.current === cacheKey) inflightResolveRef.current = null;
        setResolvingLocations(false);
      });
  }, [mapCenter, locationLabel, scenarioLocKeys]);

  const handleManualLocation = async (query) => {
    if (!query.trim()) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=10&addressdetails=1&q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.length === 0) return;
      // Prefer place=city/town/village nodes (urban centers) over admin polygons (centroids)
      const placePriority = ['city', 'town', 'village', 'suburb', 'neighbourhood', 'hamlet'];
      let hit = null;
      for (const type of placePriority) {
        hit = data.find((r) => r.class === 'place' && r.type === type);
        if (hit) break;
      }
      if (!hit) hit = data[0];
      const center = [parseFloat(hit.lat), parseFloat(hit.lon)];
      const label = hit.display_name.split(',').slice(0, 2).join(',').trim();
      setMapCenter(center);
      setLocationLabel(label);
      setShowLocationInput(false);
      try {
        localStorage.setItem('simcore:location', JSON.stringify({ center, label }));
      } catch {}
    } catch {}
  };

  return (
    <div style={styles.root}>
      {/* Full-screen map */}
      <MapView
        state={state}
        selectedAgent={selectedAgentId}
        onSelectAgent={setSelectedAgentId}
        mapCenter={mapCenter}
        realLocations={realLocations}
      />

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>
            <span style={{ color: '#7c6aff', fontWeight: 800 }}>Sim</span>
            <span style={{ color: '#22d3ee', fontWeight: 800 }}>Core</span>
          </div>
          <div style={styles.simTitle}>
            {state?.clock
              ? (state.clock.time || '').replace(/^Day\b/, t('clock.day'))
              : t('header.locating')}
          </div>
          <button
            style={styles.locationBadge}
            onClick={() => setShowLocationInput(!showLocationInput)}
            title={t('header.changeLocation')}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7z"/>
              <circle cx="12" cy="9" r="2.5"/>
            </svg>
            <span>{locationLabel || t('header.locating')}</span>
            {resolvingLocations && (
              <span style={{ fontSize: 9, color: 'var(--text-3)', marginLeft: 4, fontStyle: 'italic' }}>
                {t('header.mapping')}
              </span>
            )}
          </button>
          {showLocationInput && (
            <div style={styles.locationPopover}>
              <input
                type="text"
                placeholder={t('location.placeholder')}
                style={styles.locationInput}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleManualLocation(e.target.value);
                  if (e.key === 'Escape') setShowLocationInput(false);
                }}
              />
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 6 }}>
                {t('location.hint')}
              </div>
            </div>
          )}
        </div>
        <div style={styles.headerCenter}>
          <Timeline clock={state?.clock} connected={connected} onControl={control} />
        </div>
        <div style={styles.headerRight}>
          <div style={styles.statsRow}>
            <StatChip label={t('header.agents')} value={agentList.length} />
            <StatChip label={t('header.llm')} value={state?.llm_stats?.total_calls || 0} />
            <StatChip label={t('header.cache')} value={`${Math.round((state?.llm_stats?.cache_hit_rate || 0) * 100)}%`} />
          </div>
          {state?.clock && (state.clock.progress >= 1 || state.clock.tick >= state.clock.max_ticks) && (
            <button
              onClick={() => { setShowPostMortem(true); setDismissedPostMortem(false); }}
              style={styles.reportBtn}
              title={t('postmortem.title')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </button>
          )}
          <button
            onClick={() => setShowLibrary(true)}
            style={styles.scenariosBtn}
            title={t('scenario.browse')}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="5" rx="1"/><rect x="2" y="10" width="20" height="5" rx="1"/><rect x="2" y="17" width="20" height="5" rx="1"/>
            </svg>
            {t('scenario.browse')}
          </button>
          <button
            onClick={() => setLang(lang === 'en' ? 'pt' : 'en')}
            style={styles.langToggle}
            title="Language / Idioma"
          >
            {lang.toUpperCase()}
          </button>
          <div style={styles.statusDot(connected)} />
          <span style={{ fontSize: 10, color: connected ? '#34d399' : '#fb7185', fontWeight: 600, letterSpacing: 1 }}>
            {connected ? t('header.live') : t('header.offline')}
          </span>
        </div>
      </header>

      {/* Left panel: Agent list */}
      <div style={styles.leftPanel}>
        <div style={styles.panelHeader}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: 'var(--text-2)' }}>
            {t('panel.agents')}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{agentList.length}</span>
        </div>
        <div style={styles.agentList}>
          {agentList.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgentId(agent.id === selectedAgentId ? null : agent.id)}
              style={{
                ...styles.agentItem,
                ...(agent.id === selectedAgentId ? styles.agentItemSelected : {}),
                borderLeftColor: agent.color,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={styles.agentAvatar(agent.color)}>
                  {agent.name.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)' }}>{agent.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 1 }}>{translateLocation(agent.location, t)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <MiniBar value={agent.mood} color="#7c6aff" title="mood" />
                <MiniBar value={agent.energy} color="#22d3ee" title="energy" />
              </div>
            </button>
          ))}
        </div>

        {/* Event Injector */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', padding: 12 }}>
          <EventInjector onInject={injectEvent} locations={locationNames} />
        </div>
      </div>

      {/* Right panel: Inspector (when agent selected) */}
      {selectedAgent && (
        <div style={styles.rightPanel}>
          <AgentInspector
            agent={selectedAgent}
            agentIndex={agentIndex}
            events={events}
            onClose={() => setSelectedAgentId(null)}
          />
        </div>
      )}

      {/* Bottom panel: Activity feed */}
      <div style={styles.bottomPanel}>
        <button
          onClick={() => setShowActivity(!showActivity)}
          style={styles.activityToggle}
        >
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-2)' }}>
            {t('panel.activity')}
          </span>
          <span style={{ fontSize: 10, color: 'var(--text-3)', transform: showActivity ? 'rotate(180deg)' : 'none', transition: 'transform 200ms' }}>
            ▲
          </span>
        </button>
        {showActivity && (
          <div style={{ maxHeight: 180, overflow: 'auto' }}>
            <LogStream events={events} />
          </div>
        )}
      </div>

      <BreakingBanner event={lastSignificantEvent} />

      {/* Post-mortem overlay */}
      {showPostMortem && (
        <PostMortem
          state={state}
          events={events}
          firstState={firstState}
          onClose={() => {
            setShowPostMortem(false);
            setDismissedPostMortem(true);
            setShowLibrary(true);
          }}
        />
      )}

      {/* Scenario wizard (on top of library) */}
      <ScenarioWizard
        visible={showWizard}
        editScenario={editScenario}
        onClose={() => { setShowWizard(false); setEditScenario(null); }}
        onSaved={() => { setShowWizard(false); setEditScenario(null); setLibraryRefreshKey(k => k + 1); }}
      />

      {/* Scenario library overlay */}
      <ScenarioLibrary
        key={libraryRefreshKey}
        visible={showLibrary && !showWizard}
        dismissible={!!state}
        onClose={() => setShowLibrary(false)}
        onNew={() => { setEditScenario(null); setShowWizard(true); }}
        onRun={() => setShowLibrary(false)}
        onEdit={(scenario) => { setEditScenario(scenario); setShowWizard(true); }}
      />
    </div>
  );
}

function StatChip({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--font-mono)' }}>{value}</span>
    </div>
  );
}

function MiniBar({ value, color, title }) {
  const normalized = Math.max(0, Math.min(1, (value + 1) / 2)); // mood: -1 to 1 → 0 to 1
  const pct = title === 'energy' ? Math.max(0, Math.min(1, value)) * 100 : normalized * 100;
  return (
    <div title={title} style={{ width: 3, height: 18, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column-reverse' }}>
      <div style={{ width: '100%', height: `${pct}%`, background: color, borderRadius: 2, transition: 'height 500ms ease' }} />
    </div>
  );
}

const glass = {
  background: 'rgba(12, 12, 16, 0.82)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid var(--border-subtle)',
};

const styles = {
  root: {
    width: '100vw',
    height: '100vh',
    position: 'relative',
    overflow: 'hidden',
    background: '#050507',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 52,
    ...glass,
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    borderRadius: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    zIndex: 100,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
    minWidth: 200
  },
  headerCenter: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    maxWidth: 500,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    minWidth: 200,
    justifyContent: 'flex-end',
  },
  logo: {
    fontSize: 18,
    fontFamily: 'var(--font-mono)',
    letterSpacing: -0.5,
    userSelect: 'none',
  },
  simTitle: {
    fontSize: 13,
    color: 'var(--text-2)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 500,
  },
  locationBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 999,
    color: 'var(--text-1)',
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all var(--transition)',
    fontFamily: 'var(--font-sans)',
    maxWidth: 200,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  locationPopover: {
    position: 'absolute',
    top: 52,
    left: 220,
    padding: 12,
    background: 'rgba(12, 12, 16, 0.95)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 150,
    width: 280,
    animation: 'fadeIn 200ms ease',
  },
  locationInput: {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-default)',
    borderRadius: 6,
    color: 'var(--text-0)',
    padding: '8px 12px',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    outline: 'none',
  },
  statsRow: {
    display: 'flex',
    gap: 16,
    alignItems: 'center',
  },
  reportBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    background: 'rgba(124, 106, 255, 0.15)',
    border: '1px solid rgba(124, 106, 255, 0.3)',
    color: '#c8bfff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all var(--transition)',
    padding: 0,
  },
  scenariosBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 6,
    color: 'var(--text-2)',
    fontSize: 10,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all var(--transition)',
    fontFamily: 'var(--font-sans)',
    letterSpacing: 0.3,
  },
  langToggle: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 6,
    color: 'var(--text-1)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1,
    padding: '4px 8px',
    cursor: 'pointer',
    transition: 'all var(--transition)',
    fontFamily: 'var(--font-mono)',
  },
  statusDot: (connected) => ({
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: connected ? '#34d399' : '#fb7185',
    boxShadow: `0 0 8px ${connected ? '#34d399' : '#fb7185'}`,
  }),
  leftPanel: {
    position: 'absolute',
    top: 68,
    left: 16,
    width: 250,
    bottom: 80,
    ...glass,
    borderRadius: 'var(--radius-lg)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 50,
    overflow: 'hidden',
    boxShadow: 'var(--shadow-lg)',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px 10px',
  },
  agentList: {
    flex: 1,
    overflow: 'auto',
    padding: '0 8px 8px',
  },
  agentItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    marginBottom: 2,
    background: 'transparent',
    border: 'none',
    borderLeft: '3px solid transparent',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    transition: 'all var(--transition)',
    outline: 'none',
    textAlign: 'left',
    color: 'inherit',
  },
  agentItemSelected: {
    background: 'rgba(124, 106, 255, 0.08)',
  },
  agentAvatar: (color) => ({
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${color}, ${color}aa)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 11,
    fontWeight: 700,
    color: '#fff',
    flexShrink: 0,
    boxShadow: `0 0 10px ${color}30`,
  }),
  rightPanel: {
    position: 'absolute',
    top: 68,
    right: 16,
    width: 340,
    maxHeight: 'calc(100vh - 84px)',
    ...glass,
    borderRadius: 'var(--radius-lg)',
    zIndex: 50,
    overflow: 'hidden',
    boxShadow: 'var(--shadow-lg)',
    animation: 'fadeIn 200ms ease',
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'min(1080px, calc(100vw - 640px))',
    ...glass,
    borderRadius: 'var(--radius-lg)',
    zIndex: 50,
    overflow: 'hidden',
    boxShadow: 'var(--shadow-lg)',
  },
  activityToggle: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 16px',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: 'inherit',
  },
  loadingOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    background: 'rgba(5, 5, 7, 0.9)',
  },
  loadingCard: {
    ...glass,
    borderRadius: 'var(--radius-xl)',
    padding: '48px 64px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    boxShadow: 'var(--shadow-glow)',
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid var(--border-default)',
    borderTopColor: '#7c6aff',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};

// Add spin keyframe
if (typeof document !== 'undefined' && !document.getElementById('simcore-keyframes')) {
  const style = document.createElement('style');
  style.id = 'simcore-keyframes';
  style.textContent = `
    @keyframes spin { to { transform: rotate(360deg); } }
    .loc-marker {
      position: relative;
      width: 24px;
      height: 32px;
      pointer-events: auto;
      cursor: help;
    }
    .loc-pin {
      display: block;
      filter: drop-shadow(0 3px 5px rgba(0,0,0,0.5));
      transition: transform 150ms ease;
    }
    .loc-marker:hover .loc-pin {
      transform: scale(1.15) translateY(-2px);
    }
    .loc-count-badge {
      position: absolute;
      top: -4px;
      right: -6px;
      background: #fb7185;
      color: #fff;
      border-radius: 999px;
      min-width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 700;
      padding: 0 4px;
      border: 2px solid rgba(12,12,16,1);
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
      font-family: 'Inter', -apple-system, sans-serif;
      pointer-events: none;
    }
    .loc-card {
      position: absolute;
      left: 50%;
      top: calc(100% + 4px);
      transform: translate(-50%, 4px);
      display: flex;
      flex-direction: column;
      align-items: center;
      opacity: 0;
      pointer-events: none;
      transition: opacity 180ms ease, transform 180ms ease;
      z-index: 500;
      background: rgba(12, 12, 16, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 8px 14px;
      text-align: center;
      white-space: nowrap;
      box-shadow: 0 8px 20px rgba(0,0,0,0.4);
    }
    .loc-marker:hover .loc-card {
      opacity: 1;
      transform: translate(-50%, 0);
    }
    .loc-name {
      display: block;
      font-size: 12px;
      font-weight: 600;
      color: #f5f5f7;
      font-family: 'Inter', -apple-system, sans-serif;
    }
    .loc-osm {
      display: block;
      font-size: 10px;
      color: #22d3ee;
      margin-top: 2px;
      font-family: 'Inter', -apple-system, sans-serif;
      font-style: italic;
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .loc-meta {
      display: block;
      font-size: 10px;
      color: #8888a0;
      margin-top: 2px;
      font-family: 'Inter', -apple-system, sans-serif;
    }
  `;
  document.head.appendChild(style);
}

export default App;
