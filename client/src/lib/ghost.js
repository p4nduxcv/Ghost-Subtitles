// The word-dropping filter. Pure and deterministic: every screen that
// renders the same line at the same level drops the same words, so the
// controller and the second screen always agree without extra messages.

export const LEVELS = [
  { label: 'Lost', keep: 0.5, unit: '50% of words kept', note: 'Half the words land. You follow tone and names, not the plan.' },
  { label: '80%', keep: 0.8, unit: 'of words kept', note: 'You get the topic, but who does what, and when, slips away.' },
  { label: '90%', keep: 0.9, unit: 'of words kept', note: 'You can follow along, but every sentence takes effort.' },
  { label: '95%', keep: 0.95, unit: 'of words kept', note: 'Around the threshold where listening starts to feel adequate.' },
  { label: '98%', keep: 0.98, unit: 'of words kept', note: 'Comfortable listening. Only the rare word slips past.' },
  { label: 'Fluent', keep: 1, unit: 'every word', note: 'Every word, in real time. This is what the fluent speakers in the room heard.' },
];
export const FLUENT = LEVELS.length - 1;

// High-frequency English words. Beginners learn these first, so they are
// the words most likely to be "caught".
const COMMON = new Set(
  `a about after all also am an and any are as at back be because been but by can come could day did do does don't
  even first for from get give go going good great had has have he her here him his how i i'll i'm if in into is it
  it's its just know last let's like look make me more most my new no not now of on one only or other our out over
  people really right said say see she should so some sure take than thank thanks that that's the their them then
  there these they thing think this time to two up us very want was way we we'll well were what when where which who
  why will with would yeah yes you you're your okay ok still need idea meet tell`
    .split(/\s+/)
    .filter(Boolean),
);
// How much more likely a common word is to be caught than the level alone.
const COMMON_BOOST = 0.6;

export function normalise(word) {
  return word.toLowerCase().replace(/[‘’]/g, "'").replace(/[^\p{L}\p{N}']/gu, '');
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Final avalanche so neighbouring indexes don't correlate.
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

export function isCommon(word) {
  return COMMON.has(normalise(word));
}

/**
 * Keep-thresholds for common and rarer words, calibrated to the line's own
 * share of common words so the expected share kept equals `keep`.
 * Both thresholds rise with `keep`, so a higher level keeps a superset.
 */
export function thresholds(keep, commonShare) {
  if (keep >= 1) return { common: 1, rare: 1 };
  const p = Math.min(1, Math.max(0, commonShare));
  let common = keep + (1 - keep) * COMMON_BOOST;
  if (p > 0) common = Math.min(common, keep / p);
  const rare = p < 1 ? Math.max(0, (keep - p * common) / (1 - p)) : 0;
  return { common: Math.min(1, common), rare: Math.min(1, rare) };
}

function wordScore(lineId, index, key) {
  return fnv1a(`${lineId}:${index}:${key}`);
}

/** Whether word `index` of a line is caught at a given keep share. */
export function isKept(lineId, index, word, keep, commonShare = 0.5) {
  if (keep >= 1) return true;
  const key = normalise(word);
  if (!key) return true; // punctuation only
  const t = thresholds(keep, commonShare);
  return wordScore(lineId, index, key) < (COMMON.has(key) ? t.common : t.rare);
}

function commonShareOf(words) {
  const real = words.filter((w) => normalise(w));
  return real.length ? real.filter(isCommon).length / real.length : 0.5;
}

/**
 * Turn one caption line into render tokens.
 * kinds: 'word' (caught), 'gap' (collapsed "…"), 'ghost' (hidden word that
 * keeps its width), 'missed' (shown at Fluent, missed at the compare level).
 */
export function ghostLine(line, level, compare, gapStyle = 'ghost') {
  const words = line.text.split(/\s+/).filter(Boolean);
  const keep = LEVELS[level].keep;
  const compareKeep = LEVELS[compare].keep;
  const fluent = keep >= 1;
  const share = commonShareOf(words);
  const tokens = [];
  let caught = 0;
  let missedAtCompare = 0;

  words.forEach((w, i) => {
    const kept = isKept(line.id, i, w, keep, share);
    const keptBefore = isKept(line.id, i, w, compareKeep, share);
    if (kept) caught += 1;
    if (!keptBefore) missedAtCompare += 1;

    if (fluent) tokens.push({ text: w, kind: keptBefore ? 'word' : 'missed' });
    else if (kept) tokens.push({ text: w, kind: 'word' });
    else if (gapStyle === 'ghost') tokens.push({ text: w, kind: 'ghost' });
    else if (tokens.at(-1)?.kind !== 'gap') tokens.push({ text: '…', kind: 'gap' });
  });

  return { tokens, total: words.length, caught, missedAtCompare };
}

/** Totals across a transcript, for the stats card. */
export function transcriptStats(lines, level, compare) {
  let total = 0;
  let caught = 0;
  let missedAtCompare = 0;
  for (const line of lines) {
    const r = ghostLine(line, level, compare);
    total += r.total;
    caught += r.caught;
    missedAtCompare += r.missedAtCompare;
  }
  return { total, caught, missedAtCompare };
}
