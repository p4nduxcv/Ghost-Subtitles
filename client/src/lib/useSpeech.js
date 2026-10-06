import { useCallback, useEffect, useRef, useState } from 'react';

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);

/**
 * Real-time speech-to-text with the browser's Web Speech API.
 * Works in Chrome, Edge and Safari on localhost or HTTPS.
 * Chrome stops recognition after a pause, so we restart it while listening.
 */
export function useSpeech({ lang, onInterim, onFinal }) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState(null);
  const recRef = useRef(null);
  const wantRef = useRef(false);
  const cb = useRef({ onInterim, onFinal });
  cb.current = { onInterim, onFinal };

  const stop = useCallback(() => {
    wantRef.current = false;
    setListening(false);
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!SpeechRecognition) {
      setError('This browser has no speech recognition. Use Chrome, Edge or Safari, or try the demo.');
      return;
    }
    setError(null);
    recRef.current?.abort();

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) cb.current.onFinal(r[0].transcript.trim());
        else interim += r[0].transcript;
      }
      if (interim.trim()) cb.current.onInterim(interim.trim());
    };
    rec.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        setError('Microphone access was blocked. Allow it in the browser’s address bar and try again.');
        wantRef.current = false;
        setListening(false);
      } else if (e.error === 'audio-capture') {
        setError('No microphone found.');
        wantRef.current = false;
        setListening(false);
      }
      // 'no-speech' and 'aborted' are normal; onend restarts.
    };
    rec.onend = () => {
      if (wantRef.current && recRef.current === rec) {
        try {
          rec.start();
        } catch {
          /* already started */
        }
      }
    };

    recRef.current = rec;
    wantRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch (err) {
      setError(String(err.message || err));
    }
  }, [lang]);

  // Restart with the new language if it changes mid-session.
  useEffect(() => {
    if (wantRef.current) start();
  }, [lang, start]);

  useEffect(() => () => {
    wantRef.current = false;
    recRef.current?.abort();
  }, []);

  return { supported: Boolean(SpeechRecognition), listening, error, start, stop };
}
