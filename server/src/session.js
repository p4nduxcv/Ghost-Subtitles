// Pure session state for one room. No I/O here, so it is easy to test.
// The server keeps the transcript and the shared fluency level; every
// client renders ghost captions from that state on its own.

export const MAX_LINES = 60;
export const MAX_TEXT = 500;
export const LEVEL_COUNT = 6; // Lost, 80%, 90%, 95%, 98%, Fluent
export const FLUENT = LEVEL_COUNT - 1;
const SPEAKERS = new Set(['A', 'B']);
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

export function createSession() {
  return { lines: [], interim: null, level: 1, compare: 1 };
}

export function snapshot(session) {
  return {
    type: 'state',
    lines: session.lines,
    interim: session.interim,
    level: session.level,
    compare: session.compare,
  };
}

function cleanText(text) {
  if (typeof text !== 'string') return null;
  const t = text.replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);
  return t.length ? t : null;
}

function cleanSpeaker(s) {
  return SPEAKERS.has(s) ? s : 'A';
}

/**
 * Apply one client message to the session.
 * Returns the message to broadcast to the room, or null to ignore it.
 */
export function applyMessage(session, msg) {
  if (!msg || typeof msg !== 'object') return null;

  switch (msg.type) {
    case 'interim': {
      if (!ID_RE.test(msg.id ?? '')) return null;
      const text = cleanText(msg.text);
      if (!text) return null;
      session.interim = { id: msg.id, speaker: cleanSpeaker(msg.speaker), text };
      return { type: 'interim', interim: session.interim };
    }

    case 'final': {
      if (!ID_RE.test(msg.id ?? '')) return null;
      const text = cleanText(msg.text);
      if (session.interim?.id === msg.id) session.interim = null;
      if (!text) return { type: 'interim', interim: session.interim };
      const line = { id: msg.id, speaker: cleanSpeaker(msg.speaker), text, ts: Date.now() };
      const i = session.lines.findIndex((l) => l.id === line.id);
      if (i >= 0) session.lines[i] = line;
      else session.lines.push(line);
      if (session.lines.length > MAX_LINES) session.lines.splice(0, session.lines.length - MAX_LINES);
      return { type: 'line', line };
    }

    case 'fluency': {
      const level = Number(msg.level);
      if (!Number.isInteger(level) || level < 0 || level >= LEVEL_COUNT) return null;
      session.level = level;
      // Remember the last non-fluent level so "Fluent" can highlight what was missed there.
      if (level !== FLUENT) session.compare = level;
      return { type: 'fluency', level: session.level, compare: session.compare };
    }

    case 'reset': {
      session.lines = [];
      session.interim = null;
      return { type: 'reset' };
    }

    default:
      return null;
  }
}
