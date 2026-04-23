import { useState, useMemo } from 'react';
import { useSimulation } from './hooks/useSimulation';
import SimulationGrid from './components/SimulationGrid';
import AgentInspector from './components/AgentInspector';
import Timeline from './components/Timeline';
import StatsBar from './components/StatsBar';
import LogStream from './components/LogStream';
import EventInjector from './components/EventInjector';
import MatrixRain from './components/MatrixRain';

function App() {
  const { state, events, connected, injectEvent, control } = useSimulation();
  const [selectedAgentId, setSelectedAgentId] = useState(null);

  const selectedAgent = state?.agents?.[selectedAgentId] || null;
  const agentIndex = state?.agents
    ? Object.keys(state.agents).indexOf(selectedAgentId)
    : 0;

  const locationNames = useMemo(() => {
    if (!state?.environment?.locations) return [];
    return Object.keys(state.environment.locations);
  }, [state?.environment?.locations]);

  return (
    <div style={styles.layout}>
      <MatrixRain />

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>
          <span style={{ color: '#00d4aa', fontWeight: 700, fontSize: 20 }}>Sim</span>
          <span style={{ color: '#7c5cfc', fontWeight: 700, fontSize: 20 }}>Core</span>
          <span style={{ color: '#333348', fontSize: 11, marginLeft: 8 }}>v0.1.0</span>
        </div>
        <div style={styles.simName}>
          {state?.clock ? state.clock.time : 'Connecting...'}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: connected ? '#00d4aa' : '#ff4466' }}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: connected ? '#00d4aa' : '#ff4466',
            boxShadow: connected ? '0 0 8px #00d4aa' : '0 0 8px #ff4466',
            animation: connected ? 'pulse 2s ease-in-out infinite' : 'none',
          }} />
        </div>
      </div>

      {/* Timeline */}
      <Timeline
        clock={state?.clock}
        connected={connected}
        onControl={control}
      />

      {/* Stats */}
      <StatsBar state={state} />

      {/* Main content */}
      <div style={styles.main}>
        {/* Left: Grid */}
        <div style={styles.gridPanel}>
          {state ? (
            <SimulationGrid
              state={state}
              selectedAgent={selectedAgentId}
              onSelectAgent={setSelectedAgentId}
            />
          ) : (
            <div style={styles.loading}>
              <div style={styles.spinner} />
              <div style={{ color: '#555568', marginTop: 16, fontSize: 14 }}>
                Waiting for simulation...
              </div>
              <div style={{ color: '#333348', fontSize: 12, marginTop: 4, fontFamily: 'var(--font-mono)' }}>
                simcore run config.yaml --dashboard --demo
              </div>
            </div>
          )}
        </div>

        {/* Center: Log */}
        <div style={styles.logPanel}>
          <LogStream events={events} />
        </div>

        {/* Right: Inspector */}
        <div style={styles.inspectorPanel}>
          <AgentInspector
            agent={selectedAgent}
            agentIndex={agentIndex}
            events={events}
          />
          <EventInjector
            onInject={injectEvent}
            locations={locationNames}
          />
        </div>
      </div>
    </div>
  );
}

const styles = {
  layout: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    background: '#0a0a0f',
    position: 'relative',
    zIndex: 1,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    background: 'rgba(10, 10, 15, 0.9)',
    backdropFilter: 'blur(10px)',
    borderBottom: '1px solid #1a1a2e',
    height: 44,
    zIndex: 2,
  },
  logo: {
    letterSpacing: -0.5,
    fontFamily: 'var(--font-mono)',
    display: 'flex',
    alignItems: 'baseline',
  },
  simName: {
    fontSize: 14,
    color: '#8888a0',
    fontFamily: 'var(--font-mono)',
    fontWeight: 600,
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
    zIndex: 2,
  },
  gridPanel: {
    flex: 1,
    minWidth: 0,
    padding: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logPanel: {
    width: 340,
    borderLeft: '1px solid #1a1a2e',
    borderRight: '1px solid #1a1a2e',
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(10, 10, 15, 0.85)',
    backdropFilter: 'blur(5px)',
  },
  inspectorPanel: {
    width: 290,
    display: 'flex',
    flexDirection: 'column',
    background: 'rgba(10, 10, 15, 0.9)',
    backdropFilter: 'blur(5px)',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  spinner: {
    width: 32,
    height: 32,
    border: '3px solid #1a1a2e',
    borderTopColor: '#00d4aa',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
};

export default App;
