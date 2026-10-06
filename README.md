# Ghost subtitles

**Feel a conversation the way a beginner in a new language hears it.**

Fluent speakers catch only fragments of a live conversation, then slide to “Fluent” and see everything they missed.

- **Controller** (`/`): microphone → real-time speech-to-text → word-dropping filter, with the Fluency slider.
- **Second screen** (`/display`): big live ghost captions for the audience, following the controller's slider over WebSockets.

## Stack

| Part | Tech |
| --- | --- |
| Frontend | React 19 + Vite |
| Speech-to-text | Browser Web Speech API (Chrome, Edge, Safari) |
| Realtime | Node + `ws` WebSockets, one shared session per room |
| Server | Express (serves the built app in production) |

## Run it

Requires Node 20.19+ (or 22.12+).

```bash
npm install
npm run dev          # server on :3001, React app on :5173
```

Open **http://localhost:5173** in Chrome and allow the microphone. Click **Second screen** to open the display in a new tab, or open the LAN address the server prints (`http://<your-ip>:5173/display`) on a projector laptop or phone.

Production build (one port):

```bash
npm run build
npm start            # http://localhost:3001
```

Tests: `npm test`

### Notes for the demo

- **Microphone needs a secure origin.** `localhost` works. The second screen never uses the mic, so plain `http://<ip>` is fine for it.
- **Chrome's speech recognition sends audio to Google's servers**, so the controller needs internet. Firefox has no Web Speech API; use the **Demo** button there.
- **Speaker A/B:** browsers can't tell voices apart, so whoever runs the controller taps A/B (or presses Space) when the speaker changes.
- **Rooms:** add `?room=name` to both URLs to run several pairs at once (e.g. `/?room=team3` and `/display?room=team3`).

## How the fluency filter works

`client/src/lib/ghost.js`

- Levels: **Lost (50%)**, **80%**, **90%**, **95%**, **98%**, **Fluent**, following lexical coverage research: 95–98% known words allows comfortable listening (van Zeeland and Schmitt, 2013).
- Each word gets a deterministic score from a hash of its line id, position and text, so every screen drops exactly the same words without extra messages.
- Common words (*the, you, can, so…*) are kept more often, like a beginner who knows high-frequency vocabulary. Thresholds are calibrated per line so the share kept matches the level.
- Higher levels always keep a superset of lower ones. That's what makes the reveal work: at **Fluent**, words missed at the last level are highlighted.

## WebSocket protocol

Connect to `/ws?room=<room>&role=controller|display`. Only controllers can change state.

| Direction | Message |
| --- | --- |
| client → server | `{type:"interim", id, speaker, text}` · `{type:"final", id, speaker, text}` · `{type:"fluency", level}` · `{type:"reset"}` |
| server → client | `{type:"state", lines, interim, level, compare}` on join · `line` · `interim` · `fluency` · `reset` · `presence` |

## Project layout

```
server/
  src/index.js        Express + WebSocket server, rooms, heartbeat
  src/session.js      Pure session state + input validation
  test/               node:test unit + WebSocket integration tests
client/
  src/lib/ghost.js    Word-dropping filter
  src/lib/useSession.js  WebSocket hook with auto-reconnect
  src/lib/useSpeech.js   Web Speech API hook with auto-restart
  src/lib/demo.js     Scripted two-person conversation
  src/pages/          Controller and Display screens
  src/components/     CaptionLine, FluencySlider, StatsCard, icons
```
