import { LEVELS, FLUENT } from '../lib/ghost.js';

/** The fluency control: a stepped range input plus tappable step labels. */
export default function FluencySlider({ level, onChange, compact = false }) {
  const L = LEVELS[level];
  const pct = (level / FLUENT) * 100;

  return (
    <section className={`card fluency ${compact ? 'fluency-compact' : ''}`} aria-label="Fluency">
      <div className="fluency-head">
        <div>
          <h2>Fluency</h2>
          {compact && <span className="fluency-unit">{L.unit}</span>}
        </div>
        <span className="fluency-value">{L.label}</span>
      </div>
      {!compact && <p className="fluency-unit fluency-unit-right">{L.unit}</p>}

      <div className="range-wrap">
        <input
          className="range"
          type="range"
          min="0"
          max={FLUENT}
          step="1"
          value={level}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Fluency"
          aria-valuetext={`${L.label}, ${L.unit}`}
          style={{ '--pct': `${pct}%` }}
        />
      </div>

      <div className="steps" role="group" aria-label="Fluency steps">
        {LEVELS.map((lv, i) => (
          <button
            key={lv.label}
            type="button"
            className={`step ${i === level ? 'step-on' : ''}`}
            aria-pressed={i === level}
            onClick={() => onChange(i)}
          >
            {lv.label}
          </button>
        ))}
      </div>

      <p className="fluency-note">{L.note}</p>
      {!compact && (
        <p className="fluency-cite">
          Share of words kept. Steps follow lexical coverage research: 95–98% known words allows comfortable
          listening (van Zeeland and Schmitt, 2013).
        </p>
      )}
    </section>
  );
}
