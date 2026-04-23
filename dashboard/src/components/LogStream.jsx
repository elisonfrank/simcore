import { useRef, useEffect } from 'react';

const TYPE_COLORS = {
  agent_speak: '#7c5cfc',
  agent_move: '#44aaff',
  agent_action: '#00d4aa',
  interaction: '#ffaa22',
  scheduled_event: '#ff6b8a',
  injected_event: '#ff44aa',
  reflection: '#aa44ff',
  tick_start: '#2a2a3e',
  tick_end: '#2a2a3e',
};

export default function LogStream({ events }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  const visibleEvents = events.filter(
    e => !['tick_start', 'tick_end', 'simulation_start'].includes(e.type)
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.title}>Event Log</span>
        <span style={styles.count}>{visibleEvents.length}</span>
      </div>
      <div style={styles.list}>
        {visibleEvents.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: '#555568', fontSize: 12 }}>
            Waiting for events...
          </div>
        )}
        {visibleEvents.map((event, i) => (
          <div key={i} style={styles.entry}>
            <span style={{ ...styles.tick }}>t{event.tick}</span>
            <span style={{
              ...styles.type,
              color: TYPE_COLORS[event.type] || '#8888a0',
            }}>
              {event.source || event.type}
            </span>
            <span style={styles.text}>
              {event.data?.action || event.data?.description || event.data?.summary || event.type}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#0a0a0f',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderBottom: '1px solid #1a1a2e',
  },
  title: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#555568',
  },
  count: {
    fontSize: 10,
    color: '#00d4aa',
    background: '#00d4aa22',
    padding: '1px 6px',
    borderRadius: 8,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0',
  },
  entry: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '3px 12px',
    fontSize: 11,
    lineHeight: 1.4,
    borderBottom: '1px solid #0f0f18',
  },
  tick: {
    color: '#555568',
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    minWidth: 28,
    flexShrink: 0,
  },
  type: {
    fontWeight: 600,
    fontSize: 10,
    minWidth: 60,
    flexShrink: 0,
  },
  text: {
    color: '#8888a0',
    flex: 1,
    wordBreak: 'break-word',
  },
};
