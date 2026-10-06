// A scripted two-person conversation, fed through the same path as the
// microphone. Handy for rehearsing the pitch or when a browser has no
// speech recognition.

export const DEMO_SCRIPT = [
  { speaker: 'A', text: "Could you send me the report before tomorrow's meeting so we can go through it?" },
  { speaker: 'B', text: "Sure, I still need to update the budget figures, but I'll have it ready by tonight." },
  { speaker: 'A', text: 'Great. Did Maria confirm whether the client is joining us in person or online?' },
  { speaker: 'B', text: 'She said online, so we should test the screen sharing first thing in the morning.' },
  { speaker: 'A', text: "Good idea. Let's meet ten minutes early and run through the slides together." },
];

/** Plays the script word by word. Returns a stop function. */
export function playDemo({ onInterim, onFinal, onDone, wordMs = 260, pauseMs = 700 }) {
  let line = 0;
  let word = 0;
  let timer;

  function tick() {
    if (line >= DEMO_SCRIPT.length) {
      onDone?.();
      return;
    }
    const { speaker, text } = DEMO_SCRIPT[line];
    const words = text.split(' ');
    word += 1;
    if (word < words.length) {
      onInterim(words.slice(0, word).join(' '), speaker);
      timer = setTimeout(tick, wordMs);
    } else {
      onFinal(text, speaker);
      line += 1;
      word = 0;
      timer = setTimeout(tick, pauseMs);
    }
  }

  timer = setTimeout(tick, 300);
  return () => clearTimeout(timer);
}
