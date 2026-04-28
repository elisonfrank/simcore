import { useState, useEffect, useRef, useCallback } from 'react';

// In dev mode (Vite), use direct backend URL. In production, use relative.
const isDev = import.meta.env.DEV;
const API_BASE = isDev ? 'http://localhost:8420' : '';
const WS_URL = isDev ? 'ws://localhost:8420/ws' : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`;

const SIGNIFICANT_TYPES = new Set(['scheduled_event', 'injected_event', 'interaction']);

export function useSimulation() {
  const [state, setState] = useState(null);
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const [lastSignificantEvent, setLastSignificantEvent] = useState(null);
  const wsRef = useRef(null);
  const eventsRef = useRef([]);

  useEffect(() => {
    // Fetch initial state
    fetch(`${API_BASE}/api/state`)
      .then(r => r.json())
      .then(setState)
      .catch(() => {});

    // Connect WebSocket
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // Reconnect after 2s
      setTimeout(() => {
        if (wsRef.current === ws) {
          wsRef.current = new WebSocket(WS_URL);
        }
      }, 2000);
    };

    ws.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data);

        // Update state on tick_end
        if (event.type === 'tick_end') {
          setState(event.data);
        }

        // Append to events log
        eventsRef.current = [...eventsRef.current.slice(-200), event];
        setEvents([...eventsRef.current]);

        if (SIGNIFICANT_TYPES.has(event.type)) {
          setLastSignificantEvent({ ...event, _ts: Date.now() });
        }
      } catch (e) {
        console.warn('Failed to parse event:', e);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const injectEvent = useCallback(async (description, location = '') => {
    try {
      await fetch(`${API_BASE}/api/inject`, {
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
      await fetch(`${API_BASE}/api/control/${action}`, { method: 'POST' });
    } catch (e) {
      console.error('Failed to send control:', e);
    }
  }, []);

  return { state, events, connected, injectEvent, control, lastSignificantEvent };
}
