import { useMemo, useState, useEffect } from 'react';
import { useT } from '../lib/i18n.jsx';

const AGENT_COLORS = [
  '#7c6aff', '#22d3ee', '#fb7185', '#fbbf24',
  '#34d399', '#f472b6', '#a78bfa', '#38bdf8',
  '#e879f9', '#4ade80',
];

const KEY_MOMENT_TYPES = new Set([
  'interaction',
  'scheduled_event',
  'injected_event',
  'agent_speak',
  'reflection',
]);

export default function PostMortem({ state, events, firstState, onClose, onReplay }) {
  const { t } = useT();
  const [fetchedEvents, setFetchedEvents] = useState(null);

  // If live events array is sparse (e.g. user refreshed after sim ended),
  // fetch the full log from the backend.
  useEffect(() => {
    if (events && events.length >= 10) return;
    fetch('/api/events?last_n=500')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setFetchedEvents(data);
      })
      .catch(() => {});
  }, [events]);

  const allEvents = useMemo(() => {
    const live = events || [];
    const fetched = fetchedEvents || [];
    return live.length >= fetched.length ? live : fetched;
  }, [events, fetchedEvents]);

  const agentArcs = useMemo(() => {
    if (!state?.agents) return [];
    return Object.entries(state.agents).map(([id, agent], idx) => {
      const initial = firstState?.agents?.[id];
      const initMood = initial?.state?.mood ?? 0;
      const finalMood = agent.state?.mood ?? 0;
      const moodDelta = finalMood - initMood;
      const name = agent.name || agent.persona?.name || 'Agent';
      const relationships = agent.relationships || {};
      return {
        id,
        name,
        color: AGENT_COLORS[idx % AGENT_COLORS.length],
        initMood,
        finalMood,
        moodDelta,
        finalEnergy: agent.state?.energy ?? 0,
        relationshipCount: Object.keys(relationships).length,
        relationships,
        lastAction: agent.state?.current_action || '',
      };
    });
  }, [state, firstState]);

  const keyMoments = useMemo(() => {
    if (!allEvents) return [];
    return allEvents
      .filter((e) => KEY_MOMENT_TYPES.has(e.type))
      .slice(-8)
      .reverse();
  }, [allEvents]);

  const stats = useMemo(() => {
    const actionEvents = allEvents?.filter((e) =>
      ['agent_speak', 'agent_move', 'agent_action', 'interaction'].includes(e.type)
    ) || [];
    const interactions = allEvents?.filter((e) => e.type === 'interaction').length || 0;
    const llmStats = state?.llm_stats || {};
    return {
      totalActions: actionEvents.length,
      interactions,
      llmCalls: llmStats.total_calls || 0,
      cacheRate: Math.round((llmStats.cache_hit_rate || 0) * 100),
    };
  }, [allEvents, state]);

  const totalTicks = state?.clock?.max_ticks || state?.clock?.tick || 0;

  // Collect all unique relationship pairs across agents
  const relationshipPairs = useMemo(() => {
    const pairs = [];
    const seen = new Set();
    agentArcs.forEach((a) => {
      Object.entries(a.relationships).forEach(([name, desc]) => {
        const key = [a.name, name].sort().join(' ↔ ');
        if (seen.has(key)) return;
        seen.add(key);
        pairs.push({ key, a: a.name, b: name, desc, color: a.color });
      });
    });
    return pairs.slice(0, 6);
  }, [agentArcs]);

  return (
    <div style={styles.overlay}>
      <div style={styles.panel}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>{t('postmortem.title')}</div>
            <div style={styles.subtitle}>{t('postmortem.subtitle', { ticks: totalTicks })}</div>
          </div>
          <button onClick={onClose} style={styles.closeBtn} title={t('postmortem.close')}>×</button>
        </div>

        <div style={styles.content}>
          {/* Agent arcs */}
          <section style={styles.section}>
            <div style={styles.sectionTitle}>{t('postmortem.arcs')}</div>
            <div style={styles.arcsGrid}>
              {agentArcs.map((arc) => (
                <div key={arc.id} style={styles.arcCard}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ ...styles.arcAvatar, background: `linear-gradient(135deg, ${arc.color}, ${arc.color}aa)`, boxShadow: `0 0 12px ${arc.color}40` }}>
                      {arc.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-0)' }}>{arc.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-2)' }}>{arc.lastAction}</div>
                    </div>
                  </div>
                  <div style={styles.arcMetrics}>
                    <MoodDelta
                      label={t('postmortem.arcs.moodChange')}
                      from={arc.initMood}
                      to={arc.finalMood}
                      delta={arc.moodDelta}
                    />
                    <div style={styles.arcMetric}>
                      <span style={styles.arcMetricLabel}>{t('postmortem.arcs.energyFinal')}</span>
                      <span style={styles.arcMetricValue}>{(arc.finalEnergy * 100).toFixed(0)}%</span>
                    </div>
                    <div style={styles.arcMetric}>
                      <span style={styles.arcMetricLabel}>{t('inspector.relationships')}</span>
                      <span style={styles.arcMetricValue}>{arc.relationshipCount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Relationships */}
          <section style={styles.section}>
            <div style={styles.sectionTitle}>{t('postmortem.relationships')}</div>
            {relationshipPairs.length === 0 ? (
              <div style={styles.empty}>{t('postmortem.noRelationships')}</div>
            ) : (
              <div style={styles.relList}>
                {relationshipPairs.map((p) => (
                  <div key={p.key} style={styles.relRow}>
                    <div style={styles.relNames}>
                      <span style={{ color: p.color, fontWeight: 700 }}>{p.a}</span>
                      <span style={{ color: 'var(--text-3)', margin: '0 6px' }}>↔</span>
                      <span style={{ color: 'var(--text-0)', fontWeight: 600 }}>{p.b}</span>
                    </div>
                    <div style={styles.relDesc}>{p.desc}</div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Key moments */}
          <section style={styles.section}>
            <div style={styles.sectionTitle}>{t('postmortem.keyMoments')}</div>
            {keyMoments.length === 0 ? (
              <div style={styles.empty}>{t('postmortem.noMoments')}</div>
            ) : (
              <div style={styles.momentList}>
                {keyMoments.map((e, i) => (
                  <div key={`${e.tick}-${i}`} style={styles.moment}>
                    <div style={styles.momentTick}>t{e.tick}</div>
                    <div style={styles.momentBody}>
                      {e.source && <span style={{ color: 'var(--text-0)', fontWeight: 600, marginRight: 6 }}>{e.source}</span>}
                      <span style={{ color: 'var(--text-1)' }}>
                        {e.data?.action || e.data?.description || e.data?.result || e.data?.summary || e.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Stats */}
          <section style={styles.section}>
            <div style={styles.sectionTitle}>{t('postmortem.stats')}</div>
            <div style={styles.statsGrid}>
              <StatTile label={t('postmortem.stats.totalActions')} value={stats.totalActions} />
              <StatTile label={t('postmortem.stats.interactions')} value={stats.interactions} />
              <StatTile label={t('postmortem.stats.llmCalls')} value={stats.llmCalls} />
              <StatTile label={t('postmortem.stats.cacheRate')} value={`${stats.cacheRate}%`} />
            </div>
          </section>
        </div>

        <div style={styles.footer}>
          <button onClick={onClose} style={styles.btnGhost}>{t('postmortem.close')}</button>
          {onReplay && <button onClick={onReplay} style={styles.btnPrimary}>{t('postmortem.replay')}</button>}
        </div>
      </div>
    </div>
  );
}

function MoodDelta({ label, delta }) {
  const positive = delta > 0.01;
  const negative = delta < -0.01;
  const color = positive ? '#34d399' : negative ? '#fb7185' : 'var(--text-2)';
  const arrow = positive ? '↑' : negative ? '↓' : '→';
  return (
    <div style={styles.arcMetric}>
      <span style={styles.arcMetricLabel}>{label}</span>
      <span style={{ ...styles.arcMetricValue, color }}>
        {arrow} {Math.abs(delta).toFixed(2)}
      </span>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div style={styles.statTile}>
      <div style={styles.statTileLabel}>{label}</div>
      <div style={styles.statTileValue}>{value}</div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(5, 5, 7, 0.85)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    zIndex: 300,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    animation: 'fadeIn 300ms ease',
  },
  panel: {
    width: '100%',
    maxWidth: 880,
    maxHeight: '90vh',
    background: 'rgba(12, 12, 16, 0.95)',
    border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-xl)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 30px 80px rgba(0,0,0,0.7), 0 0 60px rgba(124,106,255,0.15)',
    overflow: 'hidden',
  },
  header: {
    padding: '24px 28px',
    borderBottom: '1px solid var(--border-subtle)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: 'var(--text-0)',
    letterSpacing: -0.5,
    background: 'linear-gradient(90deg, #7c6aff, #22d3ee)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    fontSize: 13,
    color: 'var(--text-2)',
    marginTop: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: 'transparent',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-2)',
    fontSize: 20,
    cursor: 'pointer',
    lineHeight: 1,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '20px 28px',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'var(--text-3)',
    marginBottom: 14,
  },
  empty: {
    fontSize: 12,
    color: 'var(--text-3)',
    fontStyle: 'italic',
  },
  arcsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 12,
  },
  arcCard: {
    padding: 14,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
  },
  arcAvatar: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    color: '#fff',
  },
  arcMetrics: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  arcMetric: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 11,
  },
  arcMetricLabel: {
    color: 'var(--text-2)',
  },
  arcMetricValue: {
    fontFamily: 'var(--font-mono)',
    fontWeight: 700,
    color: 'var(--text-0)',
  },
  relList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  relRow: {
    padding: 10,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
  },
  relNames: {
    fontSize: 12,
  },
  relDesc: {
    fontSize: 11,
    color: 'var(--text-2)',
    marginTop: 4,
    lineHeight: 1.4,
  },
  momentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  moment: {
    display: 'flex',
    gap: 12,
    padding: '6px 0',
    fontSize: 12,
    lineHeight: 1.5,
  },
  momentTick: {
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--text-3)',
    minWidth: 32,
  },
  momentBody: {
    flex: 1,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 10,
  },
  statTile: {
    padding: 14,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    textAlign: 'center',
  },
  statTileLabel: {
    fontSize: 10,
    color: 'var(--text-3)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statTileValue: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--text-0)',
    fontFamily: 'var(--font-mono)',
  },
  footer: {
    padding: '16px 28px',
    borderTop: '1px solid var(--border-subtle)',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
  },
  btnGhost: {
    background: 'transparent',
    border: '1px solid var(--border-default)',
    color: 'var(--text-1)',
    padding: '8px 20px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, #7c6aff, #22d3ee)',
    border: 'none',
    color: '#fff',
    padding: '8px 20px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 0 16px rgba(124,106,255,0.3)',
  },
};
