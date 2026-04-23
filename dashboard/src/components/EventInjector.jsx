import { useState } from 'react';

export default function EventInjector({ onInject, locations }) {
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim()) return;
    onInject(description.trim(), location);
    setDescription('');
  };

  return (
    <form onSubmit={handleSubmit} style={styles.container}>
      <div style={styles.title}>Inject Event</div>
      <input
        type="text"
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder="A surprise thunderstorm hits the area..."
        style={styles.input}
      />
      <div style={styles.row}>
        <select
          value={location}
          onChange={e => setLocation(e.target.value)}
          style={styles.select}
        >
          <option value="">All locations</option>
          {(locations || []).map(loc => (
            <option key={loc} value={loc}>{loc}</option>
          ))}
        </select>
        <button type="submit" style={styles.btn} disabled={!description.trim()}>
          Inject
        </button>
      </div>
    </form>
  );
}

const styles = {
  container: {
    padding: 12,
    background: '#12121a',
    borderTop: '1px solid #1a1a2e',
  },
  title: {
    fontSize: 10,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#555568',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    padding: '8px 10px',
    background: '#0a0a0f',
    border: '1px solid #2a2a3e',
    borderRadius: 4,
    color: '#e0e0e8',
    fontSize: 12,
    outline: 'none',
    marginBottom: 6,
  },
  row: {
    display: 'flex',
    gap: 6,
  },
  select: {
    flex: 1,
    padding: '6px 8px',
    background: '#0a0a0f',
    border: '1px solid #2a2a3e',
    borderRadius: 4,
    color: '#8888a0',
    fontSize: 11,
    outline: 'none',
  },
  btn: {
    padding: '6px 16px',
    background: '#00d4aa22',
    border: '1px solid #00d4aa44',
    borderRadius: 4,
    color: '#00d4aa',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
