import { useCallback, useEffect, useRef, useState } from 'react';
import GhostLogo, { MicIcon, PlayIcon, ScreenIcon } from '../components/GhostLogo.jsx';
import CaptionLine from '../components/CaptionLine.jsx';
import FluencySlider from '../components/FluencySlider.jsx';
import StatsCard from '../components/StatsCard.jsx';
import { useSession } from '../lib/useSession.js';
import { useSpeech } from '../lib/useSpeech.js';
import { playDemo } from '../lib/demo.js';
import { LEVELS, FLUENT, transcriptStats } from '../lib/ghost.js';

const LANGUAGES = [
  ['en-US', 'English (US)'],
  ['en-GB', 'English (UK)'],
  ['fi-FI', 'Finnish'],
  ['sv-SE', 'Swedish'],
  ['de-DE', 'German'],
  ['es-ES', 'Spanish'],
  ['fr-FR', 'French'],
];

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter++).toString(36)}`;

export default function Controller({ room }) {
  const { state, status, send } = useSession(room, 'controller');
  const [speaker, setSpeaker] = useState('A');
  const [lang, setLang] = useState('en-US');
  const [demoOn, setDemoOn] = useState(false);
  const utteranceRef = useRef(null);
  const stopDemoRef = useRef(null);
  const scrollRef = useRef(null);

  const sendInterim = useCallback((text, who = speaker) => {
    if (!utteranceRef.current) utteranceRef.current = newId();
    send({ type: 'interim', id: utteranceRef.current, speaker: who, text });
  }, [send, speaker]);

  const sendFinal = useCallback((text, who = speaker) => {
    const id = utteranceRef.current || newId();
    utteranceRef.current = null;
    send({ type: 'final', id, speaker: who, text });
  }, [send, speaker]);

  const speech = useSpeech({ lang, onInterim: sendInterim, onFinal: sendFinal });

  const stopDemo = useCallback(() => {
    stopDemoRef.current?.();
    stopDemoRef.current = null;
    setDemoOn(false);
  }, []);

  function toggleListen() {
    if (speech.listening) speech.stop();
    else {
      stopDemo();
      speech.start();
    }
  }

  function toggleDemo() {
    if (demoOn) return stopDemo();
    speech.stop();
    send({ type: 'reset' });
    utteranceRef.current = null;
    setDemoOn(true);
    stopDemoRef.current = playDemo({
      onInterim: (t, who) => sendInterim(t, who),
      onFinal: (t, who) => sendFinal(t, who),
      onDone: () => setDemoOn(false),
    });
  }

  function reset() {
    stopDemo();
    utteranceRef.current = null;
    send({ type: 'reset' });
  }

  useEffect(() => () => stopDemoRef.current?.(), []);

  // Keep the newest caption in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.lines.length, state.interim?.text, state.level]);

  // Keyboard: Space toggles A/B speaker while focus is not in a control.
  useEffect(() => {
    function onKey(e) {
      const tag = e.target.tagName;
      if (e.code === 'Space' && !['INPUT', 'SELECT', 'BUTTON', 'TEXTAREA', 'A'].includes(tag)) {
        e.preventDefault();
        setSpeaker((s) => (s === 'A' ? 'B' : 'A'));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { level, compare } = state;
  const fluent = level === FLUENT;
  const active = speech.listening || demoOn;
  const empty = state.lines.length === 0 && !state.interim;
  const missedNow = fluent ? transcriptStats(state.lines, level, compare).missedAtCompare : 0;

  let statusText = 'Ready';
  if (status !== 'online') statusText = status === 'connecting' ? 'Connecting…' : 'Server offline';
  else if (speech.listening) statusText = 'Listening';
  else if (demoOn) statusText = 'Playing demo';
  const statusClass = status !== 'online' ? 'dot-off' : active ? 'dot-live' : 'dot-idle';

  return (
    <div className="page">
      <div className="container">
        <header className="topbar">
          <div className="brand">
            <GhostLogo color="#262C78" />
            <div>
              <span className="brand-name">Ghost subtitles</span>
              <span className="brand-sub">Live speech-to-text, heard like a beginner</span>
            </div>
          </div>
          <div className="actions">
            <span className="pill" role="status">
              <span className={`dot ${statusClass}`} />
              {statusText}
            </span>
            <button type="button" className="btn btn-primary" onClick={toggleListen} disabled={status !== 'online'}>
              <MicIcon />
              {speech.listening ? 'Stop listening' : 'Start listening'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={toggleDemo} disabled={status !== 'online'}>
              <PlayIcon />
              {demoOn ? 'Stop demo' : 'Demo'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={reset}>Reset</button>
            <a className="btn btn-ghost" href={`/display?room=${room}`} target="_blank" rel="noreferrer">
              <ScreenIcon />
              Second screen
              {state.displays > 0 && <span className="badge">{state.displays}</span>}
            </a>
          </div>
        </header>

        <div className="hero">
          <h1>Feel a conversation the way a beginner in a new language hears it.</h1>
          <p>Catch only fragments of a live conversation, then slide to “Fluent” and see everything you missed.</p>
        </div>

        {speech.error && <p className="alert" role="alert">{speech.error}</p>}
        {!speech.supported && !speech.error && (
          <p className="alert" role="note">
            Speech recognition needs Chrome, Edge or Safari. You can still run the demo conversation.
          </p>
        )}

        <div className="layout">
          <section className="captions-panel" aria-label="Live captions">
            <div className="panel-head">
              <span className="eyebrow">{fluent ? 'What was said' : 'What you catch'}</span>
              <span className="chip">
                {fluent ? 'Fluent · 100% of words' : `${LEVELS[level].label === 'Lost' ? 'Lost · 50%' : LEVELS[level].label} of words`}
              </span>
            </div>

            <div className="captions-scroll" ref={scrollRef} aria-live="polite">
              {empty ? (
                <div className="empty">
                  <p className="empty-title">Press Start listening and let two people talk.</p>
                  <p>Captions appear here as they speak, with words dropped to match the fluency level.</p>
                </div>
              ) : (
                <>
                  {state.lines.map((line) => (
                    <CaptionLine key={line.id} line={line} level={level} compare={compare} />
                  ))}
                  {state.interim && (
                    <CaptionLine line={state.interim} level={level} compare={compare} typing className="caption-interim" />
                  )}
                </>
              )}
            </div>

            {fluent && !empty && (
              <div className="reveal">
                <span className="swatch" />
                <span>{missedNow} highlighted words are the ones you missed at {LEVELS[compare].label}.</span>
              </div>
            )}

            <div className="panel-foot">
              <div className="seg" role="group" aria-label="Who is speaking">
                <span className="seg-label">Speaker</span>
                {['A', 'B'].map((s) => (
                  <button key={s} type="button" className={`seg-btn ${speaker === s ? 'seg-on' : ''}`}
                    aria-pressed={speaker === s} onClick={() => setSpeaker(s)}>
                    {s}
                  </button>
                ))}
              </div>
              <label className="field">
                <span>Language</span>
                <select value={lang} onChange={(e) => setLang(e.target.value)}>
                  {LANGUAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            </div>
          </section>

          <aside className="side">
            <FluencySlider level={level} onChange={(lv) => send({ type: 'fluency', level: lv })} />
            <StatsCard lines={state.lines} level={level} compare={compare} />
            <p className="room-note">
              Room <code>{room}</code> · {state.displays} second screen{state.displays === 1 ? '' : 's'} connected
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
