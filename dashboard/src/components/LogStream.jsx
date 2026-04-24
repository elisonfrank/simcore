import { useRef, useEffect } from 'react';
import { useT, translateAction, translateLocation } from '../lib/i18n.jsx';

const TYPE_COLORS = {
  agent_speak: '#22d3ee',
  agent_move: '#a78bfa',
  agent_action: '#7c6aff',
  interaction: '#fb7185',
  scheduled_event: '#fbbf24',
  injected_event: '#fb7185',
  reflection: '#34d399',
};

const TYPE_LABELS = {
  agent_speak: 'SAID',
  agent_move: 'MOVE',
  agent_action: 'ACT',
  interaction: 'INTER',
  scheduled_event: 'EVENT',
  injected_event: 'INJECT',
  reflection: 'REFLECT',
};

const HIDDEN = new Set(['tick_start', 'tick_end', 'simulation_start', 'simulation_end']);

export default function LogStream({ events }) {
  const { t } = useT();
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [events]);

  const filtered = (events || []).filter(e => !HIDDEN.has(e.type));

  return (
    <div style={styles.root}>
      {filtered.length === 0 ? (
        <div style={styles.empty}>{t('panel.waitingActivity')}</div>
      ) : (
        filtered.slice(-50).map((e, i) => (
          <div key={`${e.tick}-${i}`} style={styles.row}>
            <span style={styles.tick}>t{e.tick}</span>
            <span style={{ ...styles.type, color: TYPE_COLORS[e.type] || 'var(--text-2)' }}>
              {TYPE_LABELS[e.type] || e.type.replace('_', ' ').toUpperCase()}
            </span>
            {e.source && <span style={styles.source}>{e.source}</span>}
            <span style={styles.content}>
              {translateAction(
                e.data?.action || e.data?.description || e.data?.result || e.data?.summary || '',
                t,
                (name) => translateLocation(name, t)
              )}
            </span>
          </div>
        ))
      )}
      <div ref={endRef} />
    </div>
  );
}

const styles = {
  root: {
    padding: '0 16px 12px',
    fontFamily: 'var(--font-sans)',
  },
  empty: {
    padding: '20px',
    textAlign: 'center',
    color: 'var(--text-3)',
    fontSize: 11,
    fontStyle: 'italic',
  },
  row: {
    display: 'flex',
    alignItems: 'baseline',
    gap: 10,
    padding: '4px 0',
    fontSize: 11,
    lineHeight: 1.4,
    animation: 'slideIn 200ms ease',
  },
  tick: {
    color: 'var(--text-3)',
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    fontWeight: 600,
    minWidth: 28,
  },
  type: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 1,
    minWidth: 52,
    fontFamily: 'var(--font-mono)',
  },
  source: {
    color: 'var(--text-0)',
    fontWeight: 600,
    minWidth: 64,
  },
  content: {
    color: 'var(--text-1)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};
