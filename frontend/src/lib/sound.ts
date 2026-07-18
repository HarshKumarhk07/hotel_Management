/**
 * Short attention "ding" via the Web Audio API — no asset file needed. Browsers
 * block audio until a user gesture, so call `primeAudio()` from a click first.
 */
let ctx: AudioContext | null = null;

export function primeAudio(): void {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    const AudioCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioCtor) ctx = new AudioCtor();
  }
  void ctx?.resume();
}

export function playNewOrderChime(): void {
  if (!ctx) primeAudio();
  if (!ctx) return;
  const now = ctx.currentTime;
  // Two quick rising tones.
  [880, 1175].forEach((freq, i) => {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + i * 0.18;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    osc.connect(gain).connect(ctx!.destination);
    osc.start(start);
    osc.stop(start + 0.18);
  });
}
