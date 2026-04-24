import { useState } from 'react';
import { useT } from '../lib/i18n.jsx';

export default function Timeline({ clock, connected, onControl }) {
  const { t } = useT();
  const [paused, setPaused] = useState(false);

  if (!clock) {
    return (
      <div style={styles.root}>
        <div style={styles.empty}>—</div>
      </div>
    );
  }

  const progress = (clock.progress || 0) * 100;
  const canControl = connected && onControl;

  const togglePause = () => {
    if (!canControl) return;
    const next = !paused;
    setPaused(next);
    onControl(next ? 'pause' : 'resume');
  };

  return (
    <div style={styles.root}>
      <div style={styles.controls}>
        <button
          style={{ ...styles.btn, ...styles.btnPrimary }}
          onClick={togglePause}
          disabled={!canControl}
          title={paused ? t('timeline.resume') : t('timeline.pause')}
        >
          {paused ? (
            <svg width="11" height="11" viewBox="0 0 10 10"><polygon points="2,1 8,5 2,9" fill="currentColor"/></svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 10 10"><rect x="2" y="1" width="2" height="8" fill="currentColor"/><rect x="6" y="1" width="2" height="8" fill="currentColor"/></svg>
          )}
        </button>
        <button
          style={styles.btn}
          onClick={() => canControl && onControl('stop')}
          disabled={!canControl}
          title={t('timeline.stop')}
        >
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="1.5" y="1.5" width="7" height="7" fill="currentColor"/></svg>
        </button>
      </div>

      <div style={styles.bar}>
        <div style={styles.barTrack}>
          <div style={{ ...styles.barFill, width: `${progress}%` }} />
        </div>
        <div style={styles.barLabels}>
          <span style={styles.tickLabel}>{clock.tick}</span>
          <span style={styles.pctLabel}>{progress.toFixed(0)}%</span>
          <span style={styles.tickLabel}>{clock.max_ticks}</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    width: '100%',
    maxWidth: 480,
  },
  empty: {
    color: 'var(--text-3)',
    fontSize: 12,
  },
  controls: {
    display: 'flex',
    gap: 4,
  },
  btn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-1)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all var(--transition)',
    padding: 0,
  },
  btnPrimary: {
    background: 'rgba(124, 106, 255, 0.15)',
    borderColor: 'rgba(124, 106, 255, 0.3)',
    color: '#fff',
  },
  bar: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  barTrack: {
    height: 3,
    background: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #7c6aff, #22d3ee)',
    borderRadius: 2,
    boxShadow: '0 0 8px rgba(124,106,255,0.4)',
    transition: 'width 600ms ease',
  },
  barLabels: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: 9,
    color: 'var(--text-3)',
    fontFamily: 'var(--font-mono)',
    fontWeight: 600,
  },
  tickLabel: {
    minWidth: 10,
  },
  pctLabel: {
    color: 'var(--text-1)',
  },
};
