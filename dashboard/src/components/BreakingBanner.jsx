import { useState, useEffect, useRef } from 'react';
import { useT } from '../lib/i18n.jsx';

const TYPE_META = {
  scheduled_event: { icon: '📅', labelKey: 'banner.scheduledEvent' },
  injected_event:  { icon: '⚡', labelKey: 'banner.injectedEvent' },
  interaction:     { icon: '💬', labelKey: 'banner.interaction' },
};

const DISPLAY_MS = 5000;

export default function BreakingBanner({ event }) {
  const { t } = useT();
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!event) return;
    clearTimeout(timerRef.current);
    setExiting(false);
    setVisible(true);
    timerRef.current = setTimeout(() => {
      setExiting(true);
      timerRef.current = setTimeout(() => setVisible(false), 350);
    }, DISPLAY_MS);
    return () => clearTimeout(timerRef.current);
  }, [event?._ts]);

  if (!visible || !event) return null;

  const meta = TYPE_META[event.type] || { icon: '🔔', labelKey: 'banner.event' };
  const description =
    event.data?.description ||
    event.data?.summary ||
    event.data?.content ||
    event.data?.result ||
    event.data?.action ||
    '';
  const source = event.source || '';

  return (
    <div style={{ ...styles.banner, ...(exiting ? styles.bannerExit : styles.bannerEnter) }}>
      <span style={styles.icon}>{meta.icon}</span>
      <div style={styles.body}>
        <span style={styles.label}>{t(meta.labelKey)}</span>
        {source && <span style={styles.source}>{source}</span>}
        {description && <span style={styles.desc}>{description}</span>}
      </div>
    </div>
  );
}

const styles = {
  banner: {
    position: 'fixed',
    top: 64,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 500,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '12px 20px',
    maxWidth: 480,
    width: 'max-content',
    background: 'rgba(12, 12, 18, 0.92)',
    border: '1px solid rgba(124,106,255,0.35)',
    borderRadius: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 24px rgba(124,106,255,0.15)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    transition: 'opacity 350ms ease, transform 350ms ease',
    pointerEvents: 'none',
  },
  bannerEnter: {
    opacity: 1,
    transform: 'translateX(-50%) translateY(0)',
  },
  bannerExit: {
    opacity: 0,
    transform: 'translateX(-50%) translateY(-8px)',
  },
  icon: {
    fontSize: 20,
    lineHeight: 1,
    marginTop: 1,
    flexShrink: 0,
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: '#7c6aff',
  },
  source: {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text-0)',
  },
  desc: {
    fontSize: 12,
    color: 'var(--text-1)',
    lineHeight: 1.4,
  },
};