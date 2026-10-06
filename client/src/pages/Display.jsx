import { useEffect, useState } from 'react';
import GhostLogo from '../components/GhostLogo.jsx';
import CaptionLine from '../components/CaptionLine.jsx';
import { useSession } from '../lib/useSession.js';
import { LEVELS, FLUENT } from '../lib/ghost.js';

const VISIBLE_LINES = 3;

/** The audience screen: big ghost captions that follow the controller's slider. */
export default function Display({ room }) {
  const { state, status } = useSession(room, 'display');
  const [gapStyle] = useState(() => new URLSearchParams(location.search).get('gaps') === 'ghost' ? 'ghost' : 'ellipsis');
  const { level, compare } = state;
  const fluent = level === FLUENT;

  const recent = state.lines.slice(-(state.interim ? VISIBLE_LINES - 1 : VISIBLE_LINES));

  useEffect(() => {
    document.title = 'Ghost subtitles · second screen';
  }, []);

  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  }

  return (
    <div className="display">
      <header className="display-top">
        <div className="brand">
          <GhostLogo color="#FFFFFF" />
          <span className="brand-name">Ghost subtitles</span>
        </div>
        <div className="display-status">
          <span className={`dot ${status === 'online' ? 'dot-live' : 'dot-off'}`} />
          <span>{status === 'online' ? (fluent ? 'Live · what was said' : 'Live · what a beginner catches') : 'Reconnecting…'}</span>
          <button type="button" className="btn btn-dark" onClick={fullscreen}>Full screen</button>
        </div>
      </header>

      <main className="display-captions" aria-live="polite">
        {recent.length === 0 && !state.interim ? (
          <p className="display-wait">Waiting for the conversation to start…</p>
        ) : (
          <>
            {recent.map((line, i) => (
              <CaptionLine
                key={line.id}
                line={line}
                level={level}
                compare={compare}
                gapStyle={gapStyle}
                className={!state.interim && i === recent.length - 1 ? 'caption-current' : 'caption-past'}
              />
            ))}
            {state.interim && (
              <CaptionLine line={state.interim} level={level} compare={compare} gapStyle={gapStyle} typing className="caption-current" />
            )}
          </>
        )}
      </main>

      <footer className="display-bar">
        <span className="display-bar-label">Fluency</span>
        <div className="display-track-wrap">
          <div className="display-track" aria-hidden="true">
            <div className="display-fill" style={{ width: `${(level / FLUENT) * 100}%` }} />
            <div className="display-knob" style={{ left: `${(level / FLUENT) * 100}%` }} />
          </div>
          <div className="display-ticks">
            {LEVELS.map((lv, i) => (
              <span key={lv.label} className={i === level ? 'tick-on' : ''}>{lv.label}</span>
            ))}
          </div>
        </div>
        {fluent && <span className="display-legend"><span className="swatch" />missed at {LEVELS[compare].label}</span>}
      </footer>
    </div>
  );
}
