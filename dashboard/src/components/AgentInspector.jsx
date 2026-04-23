const AGENT_COLORS = [
  '#00d4aa', '#7c5cfc', '#ff6b8a', '#ffaa22', '#44aaff',
  '#ff44aa', '#44ffaa', '#aa44ff', '#ffdd44', '#44ddff',
];

function MoodBar({ value, label }) {
  const pct = ((value + 1) / 2) * 100;
  const color = value > 0.2 ? '#00d4aa' : value < -0.2 ? '#ff4466' : '#ffaa22';
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8888a0', marginBottom: 2 }}>
        <span>{label}</span>
        <span>{value.toFixed(2)}</span>
      </div>
      <div style={{ height: 4, background: '#1a1a2e', borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function TraitBar({ name, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
      <span style={{ fontSize: 11, color: '#8888a0', width: 85, textTransform: 'capitalize' }}>{name}</span>
      <div style={{ flex: 1, height: 3, background: '#1a1a2e', borderRadius: 2 }}>
        <div style={{ width: `${value * 100}%`, height: '100%', background: '#7c5cfc', borderRadius: 2 }} />
      </div>
      <span style={{ fontSize: 10, color: '#555568', width: 30, textAlign: 'right' }}>{(value * 100).toFixed(0)}%</span>
    </div>
  );
}

export default function AgentInspector({ agent, agentIndex, events }) {
  if (!agent) {
    return (
      <div style={styles.empty}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>&#x1f50d;</div>
        <div style={{ color: '#555568' }}>Click an agent on the grid</div>
      </div>
    );
  }

  const color = AGENT_COLORS[(agentIndex || 0) % AGENT_COLORS.length];
  const agentEvents = events
    .filter(e => e.source === agent.name)
    .slice(-10)
    .reverse();

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={{ ...styles.header, borderLeftColor: color }}>
        <div style={{ fontSize: 16, fontWeight: 600, color }}>{agent.name}</div>
        <div style={{ fontSize: 12, color: '#8888a0' }}>{agent.location}</div>
      </div>

      {/* Current Action */}
      {agent.current_action && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Current Action</div>
          <div style={{ fontSize: 13, color: '#e0e0e8', fontStyle: 'italic' }}>
            {agent.current_action}
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={styles.section}>
        <MoodBar value={agent.mood || 0} label="Mood" />
        <MoodBar value={(agent.energy || 0) * 2 - 1} label="Energy" />
      </div>

      {/* Personality */}
      {agent.personality && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Personality</div>
          {Object.entries(agent.personality).map(([name, value]) => (
            <TraitBar key={name} name={name} value={value} />
          ))}
        </div>
      )}

      {/* Resources */}
      {agent.resources && Object.keys(agent.resources).length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Resources</div>
          {Object.entries(agent.resources).map(([key, val]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
              <span style={{ color: '#8888a0', textTransform: 'capitalize' }}>{key}</span>
              <span style={{ color: '#e0e0e8', fontFamily: 'var(--font-mono)' }}>{typeof val === 'number' ? val.toLocaleString() : val}</span>
            </div>
          ))}
        </div>
      )}

      {/* Recent Actions */}
      {agentEvents.length > 0 && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Recent Activity</div>
          <div style={{ maxHeight: 150, overflowY: 'auto' }}>
            {agentEvents.map((e, i) => (
              <div key={i} style={{
                fontSize: 11,
                color: '#8888a0',
                padding: '3px 0',
                borderBottom: '1px solid #1a1a2e',
              }}>
                <span style={{ color: '#555568', marginRight: 6 }}>t{e.tick}</span>
                {e.data?.action || e.type}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Memory Summary */}
      {agent.memory_summary && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Memory</div>
          <pre style={{
            fontSize: 10,
            color: '#8888a0',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 200,
            overflowY: 'auto',
            lineHeight: 1.4,
          }}>
            {agent.memory_summary}
          </pre>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    height: '100%',
    overflowY: 'auto',
    padding: 12,
  },
  empty: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    padding: '8px 12px',
    borderLeft: '3px solid',
    marginBottom: 12,
    background: '#1a1a2e',
    borderRadius: '0 6px 6px 0',
  },
  section: {
    marginBottom: 12,
    padding: 10,
    background: '#12121a',
    borderRadius: 6,
    border: '1px solid #1a1a2e',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#555568',
    marginBottom: 8,
  },
};
