import { useState } from 'react';
import { useT } from '../lib/i18n.jsx';

export default function EventInjector({ onInject, locations }) {
  const { t } = useT();
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [sending, setSending] = useState(false);

  async function handleInject() {
    if (!description.trim()) return;
    setSending(true);
    try {
      await onInject(description, location);
      setDescription('');
      setLocation('');
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={styles.root}>
      <div style={styles.label}>{t('injector.title')}</div>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder={t('injector.placeholder')}
        rows={2}
        style={styles.textarea}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleInject();
        }}
      />
      <div style={styles.bottomRow}>
        <select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          style={styles.select}
        >
          <option value="">{t('injector.everywhere')}</option>
          {locations.map((loc) => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
        <button
          onClick={handleInject}
          disabled={!description.trim() || sending}
          style={{
            ...styles.btn,
            opacity: !description.trim() || sending ? 0.4 : 1,
          }}
        >
          {sending ? '...' : t('injector.button')}
        </button>
      </div>
    </div>
  );
}

const styles = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  label: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'var(--text-3)',
  },
  textarea: {
    width: '100%',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 6,
    color: 'var(--text-0)',
    padding: '8px 10px',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    resize: 'none',
    outline: 'none',
    transition: 'border-color var(--transition)',
  },
  bottomRow: {
    display: 'flex',
    gap: 6,
  },
  select: {
    flex: 1,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 6,
    color: 'var(--text-1)',
    padding: '6px 8px',
    fontSize: 11,
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    cursor: 'pointer',
  },
  btn: {
    background: 'linear-gradient(135deg, #7c6aff, #22d3ee)',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    padding: '6px 16px',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.5,
    cursor: 'pointer',
    transition: 'all var(--transition)',
    boxShadow: '0 0 12px rgba(124,106,255,0.3)',
  },
};
