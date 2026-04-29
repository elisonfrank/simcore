import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../lib/i18n.jsx';

function CustomSelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const btnRef = useRef(null);

  // options can be string[] or {value, label}[]
  const normalize = (opt) => typeof opt === 'string' ? { value: opt, label: opt } : opt;
  const normalized = options.map(normalize);
  const current = normalized.find(o => o.value === value) || { value, label: value };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!btnRef.current?.contains(e.target) && !document.getElementById('cs-portal')?.contains(e.target))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleOpen = () => {
    const rect = btnRef.current.getBoundingClientRect();
    setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setOpen(o => !o);
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <button ref={btnRef} type="button" style={styles.selectBtn} onClick={handleOpen}>
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{current.label}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0, opacity: 0.5, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 150ms' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && createPortal(
        <div id="cs-portal" style={{ ...styles.selectDropdown, top: dropPos.top, left: dropPos.left, width: dropPos.width, position: 'fixed' }}>
          {normalized.map(opt => (
            <div
              key={opt.value}
              style={{ ...styles.selectOption, ...(opt.value === value ? styles.selectOptionActive : {}) }}
              onMouseDown={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label}
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

const LOCATION_TYPES = [
  { value: 'administrative', label: 'Administrativo' },
  { value: 'government', label: 'Governo' },
  { value: 'social', label: 'Social' },
  { value: 'commercial', label: 'Comercial' },
  { value: 'residential', label: 'Residencial' },
  { value: 'education', label: 'Educação' },
  { value: 'healthcare', label: 'Saúde' },
  { value: 'agricultural', label: 'Agrícola' },
  { value: 'leisure', label: 'Lazer' },
  { value: 'generic', label: 'Genérico' },
  { value: 'virtual', label: 'Virtual (sem pin no mapa)' },
];
const LLM_MODELS = ['ollama/qwen2.5:7b', 'ollama/llama3.2:3b', 'gpt-4o-mini', 'anthropic/claude-haiku-4-5-20251001', 'anthropic/claude-sonnet-4-6', 'demo'];
const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
];

const DEFAULT_FORM = {
  simulation: {
    name: '',
    description: '',
    language: 'en',
    duration: '2 days',
    time_step: '1 hour',
    seed: 42,
  },
  llm: { model: 'ollama/qwen2.5:7b', temperature: 0.8, cache: true },
  environment: {
    type: 'grid',
    size: [20, 20],
    locations: [],
    global_state: {},
  },
  agents: [],
  events: { scheduled: [], injectable: true },
};

const DEFAULT_LOCATION = () => ({ name: '', type: 'commercial', capacity: 20, city: '', position: [10, 10], properties: {} });
const DEFAULT_AGENT = () => ({
  name: '',
  age: 30,
  profession: '',
  personality: { openness: 0.5, conscientiousness: 0.5, extraversion: 0.5, agreeableness: 0.5, neuroticism: 0.5 },
  goals: [''],
  starting_location: '',
  backstory: '',
  resources: {},
});
const DEFAULT_EVENT = () => ({ tick: 12, type: 'event', description: '', effects: {} });

const STEPS = ['wizard.step.info', 'wizard.step.locations', 'wizard.step.agents', 'wizard.step.events'];

export default function ScenarioWizard({ visible, onClose, onSaved, editScenario }) {
  const { t } = useT();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => editScenario?.data || DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  // Sync form when editScenario changes (library re-opens with different scenario)
  useEffect(() => {
    setForm(editScenario?.data || DEFAULT_FORM);
    setStep(0);
  }, [editScenario]);

  if (!visible) return null;

  const isEditing = !!editScenario;

  const update = (path, value) => {
    setForm(prev => {
      const next = deepClone(prev);
      setPath(next, path, value);
      return next;
    });
  };

  const handleSave = async () => {
    if (!form.simulation.name.trim()) return;
    setSaving(true);
    try {
      const url = isEditing ? `/api/scenarios/${encodeURIComponent(editScenario.id)}` : '/api/scenarios';
      const method = isEditing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!data.error) {
        setForm(DEFAULT_FORM);
        setStep(0);
        onSaved?.();
      }
    } catch {}
    setSaving(false);
  };

  const handleClose = () => {
    setForm(DEFAULT_FORM);
    setStep(0);
    onClose?.();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <span style={styles.title}>{isEditing ? t('wizard.titleEdit') : t('wizard.title')}</span>
          <button style={styles.closeBtn} onClick={handleClose}>✕</button>
        </div>

        {/* Step tabs */}
        <div style={styles.tabs}>
          {STEPS.map((key, i) => (
            <button
              key={i}
              style={{ ...styles.tab, ...(i === step ? styles.tabActive : {}) }}
              onClick={() => i < step + 1 || form.simulation.name ? setStep(i) : null}
            >
              <span style={styles.stepNum}>{i + 1}</span>
              {t(key)}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={styles.body}>
          {step === 0 && <StepInfo form={form} update={update} t={t} />}
          {step === 1 && <StepLocations form={form} setForm={setForm} t={t} />}
          {step === 2 && <StepAgents form={form} setForm={setForm} t={t} />}
          {step === 3 && <StepEvents form={form} setForm={setForm} t={t} />}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <button style={styles.backBtn} onClick={() => step > 0 ? setStep(s => s - 1) : handleClose()}>
            {step === 0 ? t('wizard.cancel') : t('wizard.back')}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {step < STEPS.length - 1 ? (
              <button
                style={styles.nextBtn}
                onClick={() => setStep(s => s + 1)}
                disabled={step === 0 && !form.simulation.name.trim()}
              >
                {t('wizard.next')} →
              </button>
            ) : (
              <button
                style={{ ...styles.nextBtn, background: 'rgba(52, 211, 153, 0.15)', borderColor: 'rgba(52, 211, 153, 0.35)', color: '#34d399' }}
                onClick={handleSave}
                disabled={saving || !form.simulation.name.trim()}
              >
                {saving ? '...' : isEditing ? t('wizard.save') : t('wizard.create')}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Info
// ---------------------------------------------------------------------------
function StepInfo({ form, update, t }) {
  const sim = form.simulation;
  return (
    <div style={styles.stepGrid}>
      <Field label={t('wizard.field.name')} required>
        <input
          style={styles.input}
          value={sim.name}
          onChange={e => update(['simulation', 'name'], e.target.value)}
          placeholder="Epidemic in the valley..."
        />
      </Field>
      <Field label={t('wizard.field.description')}>
        <textarea
          style={{ ...styles.input, height: 64, resize: 'vertical' }}
          value={sim.description}
          onChange={e => update(['simulation', 'description'], e.target.value)}
          placeholder="Short description of the scenario..."
        />
      </Field>
      <Row>
        <Field label={t('wizard.field.language')}>
          <div style={styles.chipGroup}>
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                style={{ ...styles.chip, ...(sim.language === l.code ? styles.chipActive : {}) }}
                onClick={() => update(['simulation', 'language'], l.code)}
                type="button"
              >
                {l.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t('wizard.field.duration')}>
          <input style={styles.input} value={sim.duration} onChange={e => update(['simulation', 'duration'], e.target.value)} placeholder="2 days" />
        </Field>
        <Field label={t('wizard.field.seed')}>
          <input style={styles.input} type="number" value={sim.seed} onChange={e => update(['simulation', 'seed'], Number(e.target.value))} />
        </Field>
      </Row>
      <Row>
        <Field label="LLM model">
          <CustomSelect value={form.llm.model} options={LLM_MODELS} onChange={v => update(['llm', 'model'], v)} />
        </Field>
        <Field label={t('wizard.field.temperature')}>
          <input
            style={styles.input}
            type="number"
            min="0" max="2" step="0.1"
            value={form.llm.temperature}
            onChange={e => update(['llm', 'temperature'], parseFloat(e.target.value))}
          />
        </Field>
      </Row>
      <Field label="Contexto global (JSON)">
        <textarea
          style={{ ...styles.input, height: 120, resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }}
          value={(() => { try { return JSON.stringify(form.environment.global_state, null, 2); } catch { return '{}'; } })()}
          onChange={e => {
            try {
              const parsed = JSON.parse(e.target.value);
              update(['environment', 'global_state'], parsed);
            } catch {}
          }}
          placeholder={'{\n  "contexto": "...",\n  "aliancas": {}\n}'}
          spellCheck={false}
        />
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Locations
// ---------------------------------------------------------------------------
function StepLocations({ form, setForm, t }) {
  const locs = form.environment.locations;

  const add = () => setForm(prev => ({
    ...prev,
    environment: { ...prev.environment, locations: [...prev.environment.locations, DEFAULT_LOCATION()] }
  }));

  const remove = (i) => setForm(prev => ({
    ...prev,
    environment: { ...prev.environment, locations: prev.environment.locations.filter((_, idx) => idx !== i) }
  }));

  const updateLoc = (i, field, value) => setForm(prev => {
    const next = { ...prev, environment: { ...prev.environment, locations: [...prev.environment.locations] } };
    next.environment.locations[i] = { ...next.environment.locations[i], [field]: value };
    return next;
  });

  return (
    <div>
      {locs.length === 0 && (
        <div style={styles.emptyHint}>{t('wizard.hint.locations')}</div>
      )}
      {locs.map((loc, i) => (
        <div key={i} style={styles.listItem}>
          <div style={styles.listItemHeader}>
            <span style={styles.listNum}>{i + 1}</span>
            <span style={{ color: 'var(--text-1)', fontWeight: 600, fontSize: 13 }}>{loc.name || t('wizard.location.unnamed')}</span>
            <button style={styles.removeBtn} onClick={() => remove(i)}>✕</button>
          </div>
          <div style={styles.stepGrid}>
            <Row>
              <Field label={t('wizard.field.name')} required>
                <input style={styles.input} value={loc.name} onChange={e => updateLoc(i, 'name', e.target.value)} placeholder="Town Square" />
              </Field>
              <Field label="Type">
                <CustomSelect value={loc.type} options={LOCATION_TYPES} onChange={v => updateLoc(i, 'type', v)} />
              </Field>
              <Field label="Capacidade">
                <input style={styles.input} type="number" value={loc.capacity} onChange={e => updateLoc(i, 'capacity', Number(e.target.value))} />
              </Field>
            </Row>
            <Row>
              <Field label="Cidade / Região">
                <input style={styles.input} value={loc.city || ''} onChange={e => updateLoc(i, 'city', e.target.value)} placeholder="ex: Brasília, DF — deixe vazio para usar sua cidade" />
              </Field>
            </Row>
            <Row>
              <Field label="Descrição">
                <input style={styles.input} value={loc.properties?.description || ''} onChange={e => updateLoc(i, 'properties', { ...loc.properties, description: e.target.value })} placeholder="Descreva este local para os agentes..." />
              </Field>
            </Row>
          </div>
        </div>
      ))}
      <button style={styles.addBtn} onClick={add}>+ {t('wizard.addLocation')}</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Agents
// ---------------------------------------------------------------------------
function StepAgents({ form, setForm, t }) {
  const agents = form.agents;
  const locationNames = form.environment.locations.map(l => l.name).filter(Boolean);
  const TRAITS = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];

  const add = () => setForm(prev => ({ ...prev, agents: [...prev.agents, DEFAULT_AGENT()] }));
  const remove = (i) => setForm(prev => ({ ...prev, agents: prev.agents.filter((_, idx) => idx !== i) }));

  const updateAgent = (i, field, value) => setForm(prev => {
    const next = { ...prev, agents: [...prev.agents] };
    next.agents[i] = { ...next.agents[i], [field]: value };
    return next;
  });

  const updateTrait = (i, trait, value) => setForm(prev => {
    const next = { ...prev, agents: [...prev.agents] };
    next.agents[i] = { ...next.agents[i], personality: { ...next.agents[i].personality, [trait]: value } };
    return next;
  });

  const updateGoal = (agentIdx, goalIdx, value) => setForm(prev => {
    const next = { ...prev, agents: [...prev.agents] };
    const goals = [...next.agents[agentIdx].goals];
    goals[goalIdx] = value;
    next.agents[agentIdx] = { ...next.agents[agentIdx], goals };
    return next;
  });

  return (
    <div>
      {agents.length === 0 && (
        <div style={styles.emptyHint}>{t('wizard.hint.agents')}</div>
      )}
      {agents.map((agent, i) => (
        <div key={i} style={styles.listItem}>
          <div style={styles.listItemHeader}>
            <span style={styles.listNum}>{i + 1}</span>
            <span style={{ color: 'var(--text-1)', fontWeight: 600, fontSize: 13 }}>{agent.name || t('wizard.agent.unnamed')}</span>
            <button style={styles.removeBtn} onClick={() => remove(i)}>✕</button>
          </div>
          <div style={styles.stepGrid}>
            <Row>
              <Field label={t('wizard.field.name')} required>
                <input style={styles.input} value={agent.name} onChange={e => updateAgent(i, 'name', e.target.value)} placeholder="Dr. Amara" />
              </Field>
              <Field label={t('wizard.field.age')}>
                <input style={styles.input} type="number" value={agent.age} onChange={e => updateAgent(i, 'age', Number(e.target.value))} />
              </Field>
              <Field label={t('wizard.field.profession')}>
                <input style={styles.input} value={agent.profession} onChange={e => updateAgent(i, 'profession', e.target.value)} placeholder="doctor" />
              </Field>
            </Row>
            <Row>
              <Field label={t('wizard.field.startLocation')}>
                {locationNames.length > 0 ? (
                  <CustomSelect value={agent.starting_location || '—'} options={['—', ...locationNames]} onChange={v => updateAgent(i, 'starting_location', v === '—' ? '' : v)} />
                ) : (
                  <input style={styles.input} value={agent.starting_location} onChange={e => updateAgent(i, 'starting_location', e.target.value)} placeholder="Add locations first" />
                )}
              </Field>
            </Row>
            <Field label={t('wizard.field.backstory')}>
              <textarea
                style={{ ...styles.input, height: 52, resize: 'vertical' }}
                value={agent.backstory}
                onChange={e => updateAgent(i, 'backstory', e.target.value)}
                placeholder="Brief background..."
              />
            </Field>
            <Field label={t('wizard.field.goals')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {agent.goals.map((goal, gi) => (
                  <div key={gi} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input
                      style={{ ...styles.input, flex: 1 }}
                      value={goal}
                      onChange={e => updateGoal(i, gi, e.target.value)}
                      placeholder={`Goal ${gi + 1}...`}
                    />
                    {agent.goals.length > 1 && (
                      <button style={styles.removeBtn} onClick={() => updateAgent(i, 'goals', agent.goals.filter((_, gj) => gj !== gi))}>✕</button>
                    )}
                  </div>
                ))}
                <button style={{ ...styles.addBtn, marginTop: 2 }} onClick={() => updateAgent(i, 'goals', [...agent.goals, ''])}>
                  + {t('wizard.addGoal')}
                </button>
              </div>
            </Field>
            <Field label={t('wizard.field.personality')}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {TRAITS.map(trait => (
                  <div key={trait} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10, color: 'var(--text-3)', width: 120, fontFamily: 'var(--font-mono)', textTransform: 'capitalize' }}>{trait}</span>
                    <input
                      type="range" min="0" max="1" step="0.01"
                      value={agent.personality[trait]}
                      onChange={e => updateTrait(i, trait, parseFloat(e.target.value))}
                      style={{ flex: 1, accentColor: '#7c6aff' }}
                    />
                    <span style={{ fontSize: 11, color: 'var(--text-1)', fontFamily: 'var(--font-mono)', width: 28, textAlign: 'right' }}>
                      {agent.personality[trait].toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </Field>
          </div>
        </div>
      ))}
      <button style={styles.addBtn} onClick={add}>+ {t('wizard.addAgent')}</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Events
// ---------------------------------------------------------------------------
function StepEvents({ form, setForm, t }) {
  const events = form.events.scheduled;

  const add = () => setForm(prev => ({
    ...prev,
    events: { ...prev.events, scheduled: [...prev.events.scheduled, DEFAULT_EVENT()] }
  }));

  const remove = (i) => setForm(prev => ({
    ...prev,
    events: { ...prev.events, scheduled: prev.events.scheduled.filter((_, idx) => idx !== i) }
  }));

  const updateEvent = (i, field, value) => setForm(prev => {
    const next = { ...prev, events: { ...prev.events, scheduled: [...prev.events.scheduled] } };
    next.events.scheduled[i] = { ...next.events.scheduled[i], [field]: value };
    return next;
  });

  return (
    <div>
      <div style={styles.emptyHint}>{t('wizard.hint.events')}</div>
      {events.map((ev, i) => (
        <div key={i} style={styles.listItem}>
          <div style={styles.listItemHeader}>
            <span style={styles.listNum}>{t('wizard.field.tick')} {ev.tick}</span>
            <span style={{ color: 'var(--text-2)', fontSize: 11 }}>{ev.type}</span>
            <button style={styles.removeBtn} onClick={() => remove(i)}>✕</button>
          </div>
          <div style={styles.stepGrid}>
            <Row>
              <Field label={t('wizard.field.tick')}>
                <input style={styles.input} type="number" min="1" value={ev.tick} onChange={e => updateEvent(i, 'tick', Number(e.target.value))} />
              </Field>
              <Field label="Type">
                <input style={styles.input} value={ev.type} onChange={e => updateEvent(i, 'type', e.target.value)} placeholder="crisis" />
              </Field>
            </Row>
            <Field label="Description" required>
              <textarea
                style={{ ...styles.input, height: 60, resize: 'vertical' }}
                value={ev.description}
                onChange={e => updateEvent(i, 'description', e.target.value)}
                placeholder="Describe what happens at this tick..."
              />
            </Field>
          </div>
        </div>
      ))}
      <button style={styles.addBtn} onClick={add}>+ {t('wizard.addEvent')}</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function Field({ label, required, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
      <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', letterSpacing: 0.5, textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>
        {label}{required && <span style={{ color: '#fb7185' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function Row({ children }) {
  return <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{children}</div>;
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function setPath(obj, path, value) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    cur = cur[path[i]];
  }
  cur[path[path.length - 1]] = value;
}

const styles = {
  overlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 250,
    background: 'rgba(5, 5, 7, 0.85)',
  },
  container: {
    width: 'min(720px, calc(100vw - 40px))',
    maxHeight: 'calc(100vh - 40px)',
    background: 'rgba(12, 12, 16, 0.96)',
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.08)',
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
    padding: '20px 24px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-0)',
    fontFamily: 'var(--font-sans)',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-3)',
    cursor: 'pointer',
    fontSize: 14,
    padding: 4,
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
    padding: '0 16px',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    padding: '10px 14px',
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'var(--text-3)',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    letterSpacing: 0.3,
    transition: 'all 150ms',
  },
  tabActive: {
    color: '#7c6aff',
    borderBottomColor: '#7c6aff',
  },
  stepNum: {
    width: 18,
    height: 18,
    borderRadius: '50%',
    background: 'rgba(124, 106, 255, 0.2)',
    color: '#a78bfa',
    fontSize: 9,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: 'var(--font-mono)',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 24px',
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 24px',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
  backBtn: {
    padding: '8px 16px',
    background: 'none',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 7,
    color: 'var(--text-2)',
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  nextBtn: {
    padding: '8px 20px',
    background: 'rgba(124, 106, 255, 0.15)',
    border: '1px solid rgba(124, 106, 255, 0.35)',
    borderRadius: 7,
    color: '#c8bfff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  stepGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  input: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 7,
    color: 'var(--text-0)',
    padding: '7px 11px',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  select: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 7,
    color: 'var(--text-0)',
    padding: '7px 11px',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    cursor: 'pointer',
  },
  selectBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '7px 11px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 7,
    color: 'var(--text-0)',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    textAlign: 'left',
    boxSizing: 'border-box',
  },
  selectDropdown: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    left: 0,
    right: 0,
    zIndex: 999,
    background: '#16161e',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 8,
    overflow: 'hidden',
    overflowY: 'auto',
    maxHeight: 240,
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
  },
  selectOption: {
    padding: '8px 12px',
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    color: 'var(--text-1)',
    cursor: 'pointer',
    transition: 'background 100ms',
  },
  selectOptionActive: {
    background: 'rgba(124,106,255,0.18)',
    color: '#c8bfff',
  },
  chipGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    padding: '5px 11px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.04)',
    color: 'var(--text-2)',
    transition: 'all 120ms',
  },
  chipActive: {
    background: 'rgba(124,106,255,0.18)',
    border: '1px solid rgba(124,106,255,0.45)',
    color: '#c8bfff',
  },
  listItem: {
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 10,
    padding: '14px 16px',
    marginBottom: 12,
  },
  listItemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  listNum: {
    fontSize: 10,
    fontWeight: 700,
    color: '#7c6aff',
    background: 'rgba(124,106,255,0.12)',
    padding: '2px 7px',
    borderRadius: 5,
    fontFamily: 'var(--font-mono)',
  },
  removeBtn: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    color: 'var(--text-3)',
    cursor: 'pointer',
    fontSize: 12,
    padding: '2px 6px',
    borderRadius: 4,
  },
  addBtn: {
    padding: '8px 14px',
    background: 'rgba(124, 106, 255, 0.08)',
    border: '1px dashed rgba(124, 106, 255, 0.3)',
    borderRadius: 8,
    color: '#a78bfa',
    fontSize: 11,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    width: '100%',
    textAlign: 'center',
    marginTop: 4,
  },
  emptyHint: {
    fontSize: 11,
    color: 'var(--text-3)',
    fontStyle: 'italic',
    marginBottom: 16,
    lineHeight: 1.5,
  },
};