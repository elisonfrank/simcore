import { useState, useEffect } from 'react';
import { useT } from '../lib/i18n.jsx';

function translateDuration(duration, t) {
  if (!duration) return '';
  return duration
    .replace(/\bdays\b/gi, t('duration.days'))
    .replace(/\bday\b/gi, t('duration.day'))
    .replace(/\bhours\b/gi, t('duration.hours'))
    .replace(/\bhour\b/gi, t('duration.hour'))
    .toUpperCase();
}

export default function ScenarioLibrary({ visible, dismissible, onClose, onNew, onRun, onEdit }) {
  const { t } = useT();
  const [scenarios, setScenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState(null);

  const refresh = () => {
    setLoading(true);
    fetch('/api/scenarios')
      .then(r => r.json())
      .then(d => { setScenarios(d.scenarios || []); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (visible) refresh();
  }, [visible]);

  if (!visible) return null;

  const handleRun = (scenarioId, demo, speed = 1.0) => {
    setRunningId(scenarioId);
    fetch(`/api/scenarios/${encodeURIComponent(scenarioId)}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demo, speed }),
    })
      .then(r => r.json())
      .then(() => onRun?.())
      .catch(() => setRunningId(null));
  };

  const handleDelete = (scenarioId) => {
    fetch(`/api/scenarios/${encodeURIComponent(scenarioId)}`, { method: 'DELETE' })
      .then(() => setScenarios(prev => prev.filter(s => s.id !== scenarioId)));
  };

  const handleEdit = (scenarioId) => {
    fetch(`/api/scenarios/${encodeURIComponent(scenarioId)}`)
      .then(r => r.json())
      .then(scenario => onEdit?.(scenario));
  };

  const builtins = scenarios.filter(s => s.builtin);
  const user = scenarios.filter(s => !s.builtin);

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.logo}>
              <span style={{ color: '#7c6aff' }}>Sim</span>
              <span style={{ color: '#22d3ee' }}>Core</span>
            </div>
            <div style={styles.subtitle}>{t('scenario.subtitle')}</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button style={styles.newBtn} onClick={onNew}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              {t('scenario.new')}
            </button>
            {dismissible && (
              <button style={styles.closeBtn} onClick={onClose} title="Close">✕</button>
            )}
          </div>
        </div>

        <div style={styles.body}>
          {loading ? (
            <div style={styles.empty}>{t('loading.waiting')}</div>
          ) : scenarios.length === 0 ? (
            <div style={styles.empty}>{t('scenario.empty')}</div>
          ) : (
            <>
              {builtins.length > 0 && (
                <section>
                  <div style={styles.sectionLabel}>{t('scenario.builtin')}</div>
                  <div style={styles.grid}>
                    {builtins.map(s => (
                      <ScenarioCard
                        key={s.id}
                        scenario={s}
                        running={runningId === s.id}
                        onRunDemo={() => handleRun(s.id, true)}
                        onRunLLM={() => handleRun(s.id, false)}
                        onDelete={null}
                        t={t}
                      />
                    ))}
                  </div>
                </section>
              )}
              {user.length > 0 && (
                <section style={{ marginTop: 28 }}>
                  <div style={styles.sectionLabel}>{t('scenario.mine')}</div>
                  <div style={styles.grid}>
                    {user.map(s => (
                      <ScenarioCard
                        key={s.id}
                        scenario={s}
                        running={runningId === s.id}
                        onRunDemo={() => handleRun(s.id, true)}
                        onRunLLM={() => handleRun(s.id, false)}
                        onEdit={() => handleEdit(s.id)}
                        onDelete={() => handleDelete(s.id)}
                        t={t}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ScenarioCard({ scenario, running, onRunDemo, onRunLLM, onEdit, onDelete, t }) {
  const { meta } = scenario;
  const canEdit = !!onEdit;

  const nameKey = `scenario.${scenario.id}.name`;
  const descKey = `scenario.${scenario.id}.description`;
  const displayName = t(nameKey) !== nameKey ? t(nameKey) : (meta?.name || scenario.id);
  const displayDesc = t(descKey) !== descKey ? t(descKey) : (meta?.description || '');

  return (
    <div style={{ ...styles.card, ...(canEdit ? { cursor: 'pointer' } : {}) }} onClick={canEdit ? onEdit : undefined}>
      <div style={styles.cardTop}>
        {meta?.duration && (
          <div style={{ marginBottom: 8 }}>
            <span style={{ ...styles.badge }}>
              {translateDuration(meta.duration, t)}
            </span>
          </div>
        )}
        <div style={styles.cardName}>{displayName}</div>
        <div style={styles.cardDesc}>{displayDesc}</div>
      </div>
      <div style={styles.cardMeta}>
        <span style={styles.metaChip}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
          {meta?.agents || 0} {t('scenario.agents')}
        </span>
        <span style={styles.metaChip}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"/>
          </svg>
          {meta?.locations || 0} {t('scenario.locations')}
        </span>
      </div>
      <div style={styles.cardActions} onClick={e => e.stopPropagation()}>
        <button
          style={{ ...styles.runBtn, ...styles.demoBtn }}
          onClick={onRunDemo}
          disabled={running}
          title="Run without LLM API key"
        >
          {running ? '⟳' : '▶'} {t('scenario.runDemo')}
        </button>
        <button
          style={{ ...styles.runBtn, ...styles.llmBtn }}
          onClick={onRunLLM}
          disabled={running}
          title="Run with LLM"
        >
          {t('scenario.runLLM')}
        </button>
        {onDelete && (
          <button style={styles.deleteBtn} onClick={onDelete} title={t('scenario.delete')}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

const glass = {
  background: 'rgba(12, 12, 16, 0.92)',
  backdropFilter: 'blur(24px)',
  WebkitBackdropFilter: 'blur(24px)',
  border: '1px solid rgba(255,255,255,0.08)',
};

const styles = {
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    background: 'rgba(5, 5, 7, 0.88)',
    overflowY: 'auto',
    padding: '20px 0',
  },
  container: {
    width: 'min(900px, calc(100vw - 40px))',
    maxHeight: 'calc(100vh - 40px)',
    ...glass,
    borderRadius: 16,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 28px 20px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  logo: {
    fontSize: 22,
    fontFamily: 'var(--font-mono)',
    fontWeight: 800,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: 'var(--text-3)',
    marginTop: 3,
    fontFamily: 'var(--font-sans)',
  },
  newBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '8px 16px',
    background: 'rgba(124, 106, 255, 0.15)',
    border: '1px solid rgba(124, 106, 255, 0.35)',
    borderRadius: 8,
    color: '#c8bfff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    transition: 'all 150ms',
  },
  closeBtn: {
    width: 30,
    height: 30,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 7,
    color: 'var(--text-3)',
    cursor: 'pointer',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 28px 28px',
  },
  empty: {
    textAlign: 'center',
    color: 'var(--text-3)',
    fontSize: 13,
    padding: '60px 0',
    fontStyle: 'italic',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: 'var(--text-3)',
    marginBottom: 14,
    fontFamily: 'var(--font-mono)',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: 14,
  },
  card: {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: '16px 18px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    transition: 'border-color 150ms',
    cursor: 'default',
  },
  cardTop: { flex: 1 },
  cardName: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text-0)',
    marginBottom: 6,
    lineHeight: 1.3,
    fontFamily: 'var(--font-sans)',
  },
  cardDesc: {
    fontSize: 11,
    color: 'var(--text-3)',
    lineHeight: 1.5,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  cardMeta: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaChip: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 10,
    color: 'var(--text-3)',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 5,
    padding: '3px 7px',
    fontFamily: 'var(--font-mono)',
  },
  badge: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.8,
    padding: '2px 6px',
    borderRadius: 4,
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--text-3)',
    border: '1px solid rgba(255,255,255,0.08)',
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
  },
  cardActions: {
    display: 'flex',
    gap: 7,
    alignItems: 'center',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    paddingTop: 12,
  },
  runBtn: {
    flex: 1,
    padding: '7px 10px',
    borderRadius: 7,
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    transition: 'all 150ms',
    border: 'none',
    textAlign: 'center',
  },
  demoBtn: {
    background: 'rgba(34, 211, 238, 0.12)',
    color: '#22d3ee',
    border: '1px solid rgba(34, 211, 238, 0.25)',
  },
  llmBtn: {
    background: 'rgba(124, 106, 255, 0.12)',
    color: '#a78bfa',
    border: '1px solid rgba(124, 106, 255, 0.25)',
  },
  editBtn: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(34, 211, 238, 0.08)',
    border: '1px solid rgba(34, 211, 238, 0.18)',
    borderRadius: 6,
    color: '#22d3ee',
    cursor: 'pointer',
    flexShrink: 0,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(251, 113, 133, 0.08)',
    border: '1px solid rgba(251, 113, 133, 0.18)',
    borderRadius: 6,
    color: '#fb7185',
    cursor: 'pointer',
    flexShrink: 0,
  },
};