export default function StatsBar({ state }) {
  if (!state) return null;

  const agents = state.agents ? Object.values(state.agents) : [];
  const avgMood = agents.length
    ? agents.reduce((s, a) => s + (a.mood || 0), 0) / agents.length
    : 0;
  const avgEnergy = agents.length
    ? agents.reduce((s, a) => s + (a.energy || 0), 0) / agents.length
    : 0;
  const llm = state.llm_stats || {};

  return (
    <div style={styles.container}>
      <Stat label="Agents" value={agents.length} color="#00d4aa" />
      <Stat label="Avg Mood" value={avgMood.toFixed(2)} color={avgMood > 0 ? '#00d4aa' : '#ff4466'} />
      <Stat label="Avg Energy" value={`${(avgEnergy * 100).toFixed(0)}%`} color="#ffaa22" />
      <Stat label="LLM Calls" value={llm.total_calls || 0} color="#7c5cfc" />
      <Stat label="Cache Hits" value={llm.cache_hits || 0} color="#44aaff" />
      <Stat
        label="Cache Rate"
        value={`${((llm.cache_hit_rate || 0) * 100).toFixed(0)}%`}
        color="#44aaff"
      />
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={styles.stat}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 1, color: '#555568' }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'var(--font-mono)', color }}>
        {value}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    gap: 1,
    background: '#1a1a2e',
    borderBottom: '1px solid #1a1a2e',
  },
  stat: {
    flex: 1,
    padding: '8px 12px',
    background: '#12121a',
    textAlign: 'center',
  },
};
