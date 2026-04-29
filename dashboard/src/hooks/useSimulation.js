import { useState, useEffect, useRef, useCallback } from 'react';

// Always use the current host so Vite's proxy forwards correctly in dev.
// In dev: localhost:5173/api → proxy → localhost:8420/api
// In prod: same host serves both frontend and backend.
const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

const SIGNIFICANT_TYPES = new Set(['scheduled_event', 'injected_event', 'interaction']);

export function useSimulation() {
  const [state, setState] = useState(null);
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [lastSignificantEvent, setLastSignificantEvent] = useState(null);
  const wsRef = useRef(null);
  const eventsRef = useRef([]);
  const unmountedRef = useRef(false);

  useEffect(() => {
    unmountedRef.current = false;

    fetch('/api/state')
      .then(r => r.json())
      .then(d => { if (!unmountedRef.current) setState(d?.error ? null : d); })
      .catch(() => {});

    function connect() {
      if (unmountedRef.current) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => { if (!unmountedRef.current) setConnected(true); };

      ws.onclose = () => {
        if (unmountedRef.current) return;
        setConnected(false);
        setTimeout(connect, 2000);
      };

      ws.onmessage = (msg) => {
        if (unmountedRef.current) return;
        try {
          const event = JSON.parse(msg.data);
          if (event.type === 'tick_end') {
            setState(event.data);
          }
          eventsRef.current = [...eventsRef.current.slice(-200), event];
          setEvents([...eventsRef.current]);
          if (SIGNIFICANT_TYPES.has(event.type)) {
            setLastSignificantEvent({ ...event, _ts: Date.now() });
          }
        } catch (e) {
          console.warn('Failed to parse event:', e);
        }
      };
    }

    connect();

    return () => {
      unmountedRef.current = true;
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const injectEvent = useCallback(async (description, location = '') => {
    try {
      await fetch('/api/inject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, location }),
      });
    } catch (e) {
      console.error('Failed to inject event:', e);
    }
  }, []);

  const control = useCallback(async (action) => {
    try {
      await fetch(`/api/control/${action}`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to send control:', e);
    }
  }, []);

  return { state, events, connected, injectEvent, control, lastSignificantEvent };
}
