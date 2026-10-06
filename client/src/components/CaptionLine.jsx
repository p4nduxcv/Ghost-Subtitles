import { memo } from 'react';
import { ghostLine } from '../lib/ghost.js';

/** One speaker line rendered through the ghost filter. */
function CaptionLine({ line, level, compare, gapStyle, typing = false, className = '' }) {
  const { tokens } = ghostLine(line, level, compare, gapStyle);
  return (
    <div className={`caption ${className}`}>
      <span className={`who who-${line.speaker.toLowerCase()}`} aria-label={`Speaker ${line.speaker}`}>
        {line.speaker}
      </span>
      <p className="caption-text">
        {tokens.map((t, i) => (
          <span key={i} className={`tok tok-${t.kind}`} aria-hidden={t.kind === 'ghost' ? true : undefined}>
            {t.text}
          </span>
        ))}
        {typing && <span className="cursor" aria-hidden="true" />}
      </p>
    </div>
  );
}

export default memo(CaptionLine);
