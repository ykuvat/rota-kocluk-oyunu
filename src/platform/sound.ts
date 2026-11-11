// KUVAT LABS — Rota
// Ses efektleri: dosya yok, WebAudio ile üretilen kısa tonlar. Ayarlardan kapatılabilir; tercih tarayıcıda saklanır.
// Tarayıcı sesi ancak ilk dokunuştan sonra açar: bağlam ilk çalmada kurulur.

import { loadSoundOn, saveSoundOn } from "./prefs";

export type Sfx = "click" | "good" | "bad" | "coin" | "week" | "fanfare";

type Note = [freq: number, at: number, dur: number];

const TUNES: Record<Sfx, { wave: OscillatorType; gain: number; notes: Note[] }> = {
  click: { wave: "triangle", gain: 0.05, notes: [[620, 0, 0.05]] },
  good: { wave: "sine", gain: 0.09, notes: [[523, 0, 0.1], [784, 0.09, 0.16]] },
  bad: { wave: "sine", gain: 0.08, notes: [[330, 0, 0.12], [247, 0.11, 0.2]] },
  coin: { wave: "square", gain: 0.035, notes: [[988, 0, 0.06], [1319, 0.06, 0.14]] },
  week: { wave: "sine", gain: 0.09, notes: [[523, 0, 0.14], [659, 0.12, 0.14], [784, 0.24, 0.26]] },
  fanfare: { wave: "triangle", gain: 0.09, notes: [[523, 0, 0.09], [659, 0.08, 0.09], [784, 0.16, 0.09], [1047, 0.24, 0.3]] },
};

let on = loadSoundOn();
let ctx: AudioContext | null = null;
let lastAt: Partial<Record<Sfx, number>> = {};

export const soundOn = () => on;

export function setSoundOn(v: boolean): void {
  on = v;
  saveSoundOn(v);
}

export function play(name: Sfx): void {
  if (!on) return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  try {
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    // aynı ses art arda yığılmasın (hızlı haftada birçok olay aynı karede gelir)
    const now = ctx.currentTime;
    if (now - (lastAt[name] ?? -1) < 0.08) return;
    lastAt[name] = now;
    const tune = TUNES[name];
    for (const [freq, at, dur] of tune.notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tune.wave;
      osc.frequency.value = freq;
      // kısa giriş, yumuşak sönüş: tıkırtı olmasın
      gain.gain.setValueAtTime(0, now + at);
      gain.gain.linearRampToValueAtTime(tune.gain, now + at + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + at + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + at);
      osc.stop(now + at + dur + 0.02);
    }
  } catch {
    lastAt = {}; // ses aygıtı yoksa sessizce geç
  }
}
