import { LEVELS, FLUENT, transcriptStats } from '../lib/ghost.js';

export default function StatsCard({ lines, level, compare }) {
  const s = transcriptStats(lines, level, compare);
  const fluent = level === FLUENT;
  const caught = fluent ? s.total - s.missedAtCompare : s.caught;
  const missed = s.total - caught;
  const pct = s.total ? Math.round((caught / s.total) * 100) : 0;

  return (
    <section className="card stats" aria-label="This conversation">
      <h2>This conversation</h2>
      <div className="stats-grid">
        <div><strong>{s.total}</strong><span>words spoken</span></div>
        <div><strong>{caught}</strong><span>you caught</span></div>
        <div><strong>{missed}</strong><span>{fluent ? `missed at ${LEVELS[compare].label}` : 'you missed'}</span></div>
      </div>
      <div className="stats-bar" role="img" aria-label={`${pct}% of words caught`}>
        <div style={{ width: `${pct}%` }} />
      </div>
    </section>
  );
}
