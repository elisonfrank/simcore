import { useMemo } from 'react';
import { useT, translateAction, translateLocation } from '../lib/i18n.jsx';

const AGENT_COLORS = [
  '#7c6aff', '#22d3ee', '#fb7185', '#fbbf24',
  '#34d399', '#f472b6', '#a78bfa', '#38bdf8',
  '#e879f9', '#4ade80',
];

export default function AgentInspector({ agent, agentIndex, events, onClose }) {
  const { t } = useT();
  const color = AGENT_COLORS[agentIndex % AGENT_COLORS.length];

  const agentEvents = useMemo(() => {
    if (!agent || !events) return [];
    const name = agent.name || agent.persona?.name;
    return events
      .filter(e => e.source === name)
      .slice(-8)
      .reverse();
  }, [agent, events]);

  if (!agent) return null;

  const name = agent.name || agent.persona?.name || 'Agent';
  const age = agent.age || agent.persona?.age;
  const profession = agent.profession || agent.persona?.profession || '';
  const personality = agent.personality || agent.persona?.personality || {};
  const state = agent.state || {};
  const mood = state.mood ?? 0;
  const energy = state.energy ?? 1;
  const location = state.location || agent.location || '?';
  const action = state.current_action || 'idle';
  const resources = state.resources || {};
  const relationships = agent.relationships || {};
  const goals = agent.goals || agent.persona?.goals || [];

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={styles.avatar(color)}>
            {name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={styles.name}>{name}</div>
            <div style={styles.subtitle}>
              {age && <span>{age}</span>}
              {age && profession && <span style={{ margin: '0 6px', color: 'var(--text-3)' }}>·</span>}
              {profession && <span>{profession}</span>}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={styles.closeBtn} title={t('panel.close')}>×</button>
      </div>

      <div style={styles.content}>
        <Section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Dot color={color} />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-0)' }}>{translateLocation(location, t)}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-1)', lineHeight: 1.5 }}>{translateAction(action, t, (n) => translateLocation(n, t))}</div>
        </Section>

        <Section title={t('inspector.vitals')}>
          <Bar label={t('inspector.mood')} value={(mood + 1) / 2} color="#7c6aff" display={mood.toFixed(2)} />
          <Bar label={t('inspector.energy')} value={energy} color="#22d3ee" display={energy.toFixed(2)} />
        </Section>

        {Object.keys(personality).length > 0 && (
          <Section title={t('inspector.personality')}>
            <Bar label={t('inspector.personality.openness')} value={personality.openness ?? 0.5} color="#fbbf24" />
            <Bar label={t('inspector.personality.conscientiousness')} value={personality.conscientiousness ?? 0.5} color="#34d399" />
            <Bar label={t('inspector.personality.extraversion')} value={personality.extraversion ?? 0.5} color="#fb7185" />
            <Bar label={t('inspector.personality.agreeableness')} value={personality.agreeableness ?? 0.5} color="#a78bfa" />
            <Bar label={t('inspector.personality.neuroticism')} value={personality.neuroticism ?? 0.5} color="#38bdf8" />
          </Section>
        )}

        {goals.length > 0 && (
          <Section title={t('inspector.goals')}>
            {goals.slice(0, 3).map((goal, i) => (
              <div key={i} style={styles.goal}>
                <span style={{ color: 'var(--text-3)', marginRight: 8 }}>→</span>
                {goal}
              </div>
            ))}
          </Section>
        )}

        {Object.keys(resources).length > 0 && (
          <Section title={t('inspector.resources')}>
            <div style={styles.resourceGrid}>
              {Object.entries(resources).map(([key, value]) => (
                <div key={key} style={styles.resource}>
                  <div style={styles.resourceLabel}>{key}</div>
                  <div style={styles.resourceValue}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {Object.keys(relationships).length > 0 && (
          <Section title={t('inspector.relationships')}>
            {Object.entries(relationships).slice(0, 4).map(([name, desc]) => (
              <div key={name} style={styles.relationship}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-0)' }}>{name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2, lineHeight: 1.4 }}>{desc}</div>
              </div>
            ))}
          </Section>
        )}

        {agentEvents.length > 0 && (
          <Section title={t('inspector.activity')}>
            {agentEvents.map((e, i) => (
              <div key={i} style={styles.activityItem}>
                <div style={styles.activityTick}>t{e.tick}</div>
                <div style={styles.activityText}>
                  {translateAction(e.data?.action || e.data?.description || e.type, t, (n) => translateLocation(n, t))}
                </div>
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={styles.section}>
      {title && <div style={styles.sectionTitle}>{title}</div>}
      {children}
    </div>
  );
}

function Bar({ label, value, color, display }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--text-1)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {display || pct.toFixed(0)}
        </span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: `linear-gradient(90deg, ${color}aa, ${color})`,
          borderRadius: 2,
          boxShadow: `0 0 8px ${color}60`,
          transition: 'width 500ms ease',
        }} />
      </div>
    </div>
  );
}

function Dot({ color }) {
  return (
    <div style={{
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: color,
      boxShadow: `0 0 8px ${color}`,
    }} />
  );
}

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    maxHeight: '100%',
    height: '100%',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  avatar: (color) => ({
    width: 44,
    height: 44,
    borderRadius: '50%',
    background: `linear-gradient(135deg, ${color}, ${color}bb)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    fontWeight: 700,
    color: '#fff',
    boxShadow: `0 0 16px ${color}50`,
    flexShrink: 0,
  }),
  name: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text-0)',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    color: 'var(--text-2)',
    marginTop: 2,
  },
  closeBtn: {
    width: 28,
    height: 28,
    borderRadius: '50%',
    background: 'transparent',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-2)',
    fontSize: 16,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all var(--transition)',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '4px 0',
  },
  section: {
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'var(--text-3)',
    marginBottom: 10,
  },
  goal: {
    fontSize: 12,
    color: 'var(--text-1)',
    lineHeight: 1.5,
    marginBottom: 4,
  },
  resourceGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  resource: {
    padding: '8px 10px',
    background: 'rgba(255,255,255,0.02)',
    borderRadius: 6,
    border: '1px solid var(--border-subtle)',
  },
  resourceLabel: {
    fontSize: 9,
    color: 'var(--text-3)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  resourceValue: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text-0)',
    fontFamily: 'var(--font-mono)',
  },
  relationship: {
    padding: '8px 0',
    borderBottom: '1px solid var(--border-subtle)',
  },
  activityItem: {
    display: 'flex',
    gap: 10,
    padding: '6px 0',
    fontSize: 11,
    color: 'var(--text-1)',
    lineHeight: 1.4,
  },
  activityTick: {
    fontSize: 10,
    color: 'var(--text-3)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 600,
    minWidth: 32,
  },
  activityText: {
    flex: 1,
  },
};
