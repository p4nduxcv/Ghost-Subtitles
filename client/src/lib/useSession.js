import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

const initial = { lines: [], interim: null, level: 1, compare: 1, controllers: 0, displays: 0 };

function reducer(state, msg) {
  switch (msg.type) {
    case 'state':
      return { ...state, lines: msg.lines, interim: msg.interim, level: msg.level, compare: msg.compare };
    case 'line': {
      const lines = state.lines.some((l) => l.id === msg.line.id)
        ? state.lines.map((l) => (l.id === msg.line.id ? msg.line : l))
        : [...state.lines, msg.line];
      const interim = state.interim?.id === msg.line.id ? null : state.interim;
      return { ...state, lines, interim };
    }
    case 'interim':
      return { ...state, interim: msg.interim };
    case 'fluency':
      return { ...state, level: msg.level, compare: msg.compare };
    case 'reset':
      return { ...state, lines: [], interim: null };
    case 'presence':
      return { ...state, controllers: msg.controllers, displays: msg.displays };
    default:
      return state;
  }
}

/**
 * Live session over a WebSocket, with automatic reconnect.
 * role: 'controller' (sends captions and fluency) or 'display' (watches).
 */
export function useSession(room, role) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [status, setStatus] = useState('connecting');
  const wsRef = useRef(null);

  useEffect(() => {
    let stopped = false;
    let retry = 0;
    let timer;

    function open() {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${proto}://${location.host}/ws?room=${encodeURIComponent(room)}&role=${role}`);
      wsRef.current = ws;
      setStatus(retry ? 'reconnecting' : 'connecting');

      ws.onopen = () => {
        retry = 0;
        setStatus('online');
      };
      ws.onmessage = (e) => {
        try {
          dispatch(JSON.parse(e.data));
        } catch {
          /* ignore malformed */
        }
      };
      ws.onclose = () => {
        if (stopped) return;
        setStatus('offline');
        retry += 1;
        timer = setTimeout(open, Math.min(8000, 500 * 2 ** retry));
      };
    }

    open();
    return () => {
      stopped = true;
      clearTimeout(timer);
      wsRef.current?.close();
    };
  }, [room, role]);

  const send = useCallback((msg) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  return { state, status, send };
}

export function roomFromUrl() {
  const r = new URLSearchParams(location.search).get('room');
  return r && /^[a-z0-9-]{1,32}$/i.test(r) ? r.toLowerCase() : 'main';
}
