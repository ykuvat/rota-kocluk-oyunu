// KUVAT LABS — Rota
// Arka plan müziği: dosya yok; WebAudio ile çalınan sakin, döngüsel bir parça (yumuşak akorlar, bas, seyrek melodi,
// hafif ritim). Her turda melodi biraz değişir, böylece kısa bir döngü gibi yormaz. Ayarlardan kapatılabilir.
// Rastgelelik yalnız müzikte (Math.random): oyun durumunu etkilemez.

import { loadMusicOn, saveMusicOn } from "./prefs";
import { audioContext } from "./sound";

const BPM = 76;
const BEAT = 60 / BPM;
/** bir ölçü 4 vuruş; akor ölçü başına değişir */
const BAR = BEAT * 4;

const midi = (n: number) => 440 * 2 ** ((n - 69) / 12);

// iki dörtlük: sıcak, çözülen bir yürüyüş (Fmaj7 – Em7 – Dm7 – Cmaj7 | Am7 – Fmaj7 – G6 – Cmaj7)
const CHORDS: number[][] = [
  [53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59],
  [45, 52, 55, 60], [53, 57, 60, 64], [43, 50, 55, 59], [48, 52, 55, 59],
];
/** melodi: Do majör pentatonik, iki oktav */
const SCALE = [72, 74, 76, 79, 81, 84, 86, 88];

let on = loadMusicOn();
let master: GainNode | null = null;
let wet: GainNode | null = null;
let timer = 0;
let nextBar = 0;
let bar = 0;
let lastNote = 3;

export const musicOn = () => on;

export function setMusicOn(v: boolean): void {
  on = v;
  saveMusicOn(v);
  if (v) startMusic();
  else stopMusic();
}

/** İlk dokunuştan sonra çağrılır (tarayıcı sesi ancak o zaman açar); açık değilse ya da çalıyorsa bir şey yapmaz. */
export function startMusic(): void {
  if (!on || timer) return;
  const ctx = audioContext();
  if (!ctx) return;
  if (!master) {
    master = ctx.createGain();
    master.gain.value = 0;
    // yumuşak ton: tizleri kıs
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2400;
    // yankı: melodiye derinlik
    const delay = ctx.createDelay(1);
    delay.delayTime.value = BEAT * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    wet = ctx.createGain();
    wet.gain.value = 0.5;
    wet.connect(delay);
    delay.connect(fb).connect(delay);
    delay.connect(lp);
    master.connect(lp).connect(ctx.destination);
  }
  master.gain.cancelScheduledValues(ctx.currentTime);
  master.gain.setTargetAtTime(0.5, ctx.currentTime, 0.8);
  nextBar = ctx.currentTime + 0.1;
  timer = window.setInterval(schedule, 200);
  schedule();
}

export function stopMusic(): void {
  if (!timer) return;
  window.clearInterval(timer);
  timer = 0;
  const ctx = audioContext();
  if (ctx && master) master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
}

/** Sekme gizlenince sus, dönünce devam et. */
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopMusic();
  else startMusic();
});

function schedule(): void {
  const ctx = audioContext();
  if (!ctx || !master) return;
  // bir ölçü önden planla (zamanlayıcı gecikse de ritim kaymaz)
  while (nextBar < ctx.currentTime + 0.6) {
    playBar(ctx, nextBar, bar);
    nextBar += BAR;
    bar++;
  }
}

function tone(ctx: AudioContext, out: AudioNode, type: OscillatorType, freq: number, at: number, dur: number, gain: number, attack = 0.02): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.05);
}

function playBar(ctx: AudioContext, t: number, index: number): void {
  const out = master!;
  const chord = CHORDS[index % CHORDS.length];
  // akor: yavaş giren yumuşak yatak (hafif akortsuz iki ses: sıcaklık)
  for (const n of chord) {
    tone(ctx, out, "triangle", midi(n), t, BAR * 1.05, 0.045, 0.5);
    tone(ctx, out, "sine", midi(n + 12) * 1.003, t, BAR * 1.05, 0.018, 0.7);
  }
  // bas: 1. ve 3. vuruş
  tone(ctx, out, "sine", midi(chord[0] - 12), t, BEAT * 1.8, 0.16, 0.03);
  tone(ctx, out, "sine", midi(chord[0] - 12), t + BEAT * 2.5, BEAT * 1.2, 0.1, 0.03);
  // ritim: ilk dört ölçü sade, sonra hafif vuruş (parça açılır)
  if (index >= 4) {
    for (const b of [0, 2]) kick(ctx, out, t + BEAT * b);
    for (const b of [1, 3]) hat(ctx, out, t + BEAT * b, 0.03);
    for (const b of [0.5, 1.5, 2.5, 3.5]) hat(ctx, out, t + BEAT * b, 0.012);
  }
  // melodi: sekizliklerde, seyrek; bir önceki notaya yakın adımlarla dolaşır
  const dense = index % 8 >= 4 ? 0.42 : 0.28;
  for (let i = 0; i < 8; i++) {
    if (Math.random() > dense) continue;
    lastNote = Math.max(0, Math.min(SCALE.length - 1, lastNote + Math.round((Math.random() - 0.5) * 4)));
    const at = t + (BEAT / 2) * i + (i % 2 ? 0.03 : 0); // hafif salınım
    tone(ctx, out, "triangle", midi(SCALE[lastNote]), at, BEAT * 1.4, 0.06, 0.01);
    if (wet) tone(ctx, wet, "sine", midi(SCALE[lastNote]), at, BEAT, 0.03, 0.01);
  }
}

function kick(ctx: AudioContext, out: AudioNode, at: number): void {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.frequency.setValueAtTime(110, at);
  o.frequency.exponentialRampToValueAtTime(42, at + 0.14);
  g.gain.setValueAtTime(0.2, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + 0.25);
}

let noise: AudioBuffer | null = null;
function hat(ctx: AudioContext, out: AudioNode, at: number, gain: number): void {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource();
  s.buffer = noise;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 6000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 0.06);
  s.connect(hp).connect(g).connect(out);
  s.start(at);
  s.stop(at + 0.08);
}
