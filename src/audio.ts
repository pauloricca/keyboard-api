export function playbackNotes(notes: number[]) {
  const pitches = [...new Set(notes)].sort((a, b) => a - b);
  if (pitches.some(n => !Number.isInteger(n) || n < 21 || n > 108)) throw new Error('Playback notes must be within A0–C8.');
  // 25 ms between notes; keep even very dense chords within 220 ms.
  const interval = Math.min(0.025, 0.22 / Math.max(1, pitches.length - 1));
  return pitches.map((midi, i) => ({ frequency: 440 * 2 ** ((midi - 69) / 12), delay: i * interval }));
}

let context: AudioContext | undefined;
let stopCurrent: (() => void) | undefined;
let request = 0;

/** Browser-only, local synthesis; no samples, network calls or autoplay. */
export async function playChord(notes: number[]): Promise<void> {
  const voices = playbackNotes(notes);
  if (!voices.length) throw new Error('Select some notes before playing.');
  const id = ++request;
  stopCurrent?.();
  if (typeof AudioContext === 'undefined') throw new Error('Audio playback is not supported in this browser.');
  context ??= new AudioContext();
  await context.resume();
  if (id !== request) return;
  if (context.state !== 'running') throw new Error('Audio could not start. Try pressing Play again.');
  const ctx = context;
  const output = ctx.createGain();
  output.gain.value = 0.24 / voices.length ** 0.7;
  output.connect(ctx.destination);
  const oscillators: OscillatorNode[] = [];
  const envelopes: GainNode[] = [];
  const start = ctx.currentTime + 0.025;
  return new Promise<void>(resolve => {
    let remaining = 0;
    const cleanup = () => {
      output.disconnect(); envelopes.forEach(e => e.disconnect());
      if (id === request) stopCurrent = undefined;
      resolve();
    };
    stopCurrent = () => {
      const now = ctx.currentTime;
      output.gain.cancelScheduledValues(now);
      output.gain.setValueAtTime(output.gain.value, now);
      output.gain.linearRampToValueAtTime(0, now + 0.025);
      oscillators.forEach(o => o.stop(now + 0.03));
    };
    for (const voice of voices) {
      const onset = start + voice.delay;
      for (const [harmonic, level] of [[1, 1], [2, 0.3], [3, 0.12], [4, 0.04]]) {
        if (voice.frequency * harmonic >= ctx.sampleRate / 2) continue;
        const oscillator = ctx.createOscillator(), envelope = ctx.createGain();
        oscillator.type = 'sine'; oscillator.frequency.value = voice.frequency * harmonic;
        // Fast hammer-like attack, with upper harmonics fading more quickly.
        envelope.gain.setValueAtTime(0, onset);
        envelope.gain.linearRampToValueAtTime(level, onset + 0.008);
        envelope.gain.exponentialRampToValueAtTime(0.0001, onset + 2.2 / Math.sqrt(harmonic));
        envelope.gain.linearRampToValueAtTime(0, onset + 2.25);
        oscillator.connect(envelope); envelope.connect(output);
        oscillators.push(oscillator); envelopes.push(envelope); remaining++;
        oscillator.onended = () => { oscillator.disconnect(); if (--remaining === 0) cleanup(); };
        oscillator.start(onset); oscillator.stop(onset + 2.3);
      }
    }
  });
}
