export default function Timeline({ clock, connected, onControl }) {
  if (!clock) return null;

  const progress = (clock.progress || 0) * 100;

  return (
    <div style={styles.container}>
      <div style={styles.left}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: connected ? '#00d4aa' : '#ff4466',
          boxShadow: connected ? '0 0 8px #00d4aa' : '0 0 8px #ff4466',
        }} />
        <span style={styles.time}>{clock.time || '00:00'}</span>
        <span style={styles.tick}>tick {clock.tick}/{clock.max_ticks}</span>
      </div>

      <div style={styles.center}>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressBar, width: `${progress}%` }} />
        </div>
      </div>

      <div style={styles.right}>
        <button onClick={() => onControl('pause')} style={styles.btn} title="Pause">
          &#x23F8;
        </button>
        <button onClick={() => onControl('resume')} style={styles.btn} title="Resume">
          &#x25B6;
        </button>
        <button onClick={() => onControl('stop')} style={{ ...styles.btn, color: '#ff4466' }} title="Stop">
          &#x23F9;
        </button>
        <span style={styles.pct}>{progress.toFixed(0)}%</span>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '8px 16px',
    background: '#12121a',
    borderBottom: '1px solid #1a1a2e',
    height: 44,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 180,
  },
  time: {
    fontFamily: 'var(--font-mono)',
    fontSize: 14,
    fontWeight: 600,
    color: '#e0e0e8',
  },
  tick: {
    fontSize: 11,
    color: '#555568',
  },
  center: {
    flex: 1,
  },
  progressTrack: {
    height: 4,
    background: '#1a1a2e',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #00d4aa, #7c5cfc)',
    borderRadius: 2,
    transition: 'width 0.5s ease',
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 140,
    justifyContent: 'flex-end',
  },
  btn: {
    background: '#1a1a2e',
    border: '1px solid #2a2a3e',
    color: '#e0e0e8',
    borderRadius: 4,
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: 14,
    lineHeight: 1,
  },
  pct: {
    fontFamily: 'var(--font-mono)',
    fontSize: 12,
    color: '#8888a0',
    minWidth: 35,
    textAlign: 'right',
  },
};
