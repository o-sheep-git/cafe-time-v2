/**
 * 音まわり。BGM・店内の音・雨音の3系統を別々の音量で鳴らす。
 * ブラウザの自動再生の制限があるので、AudioContext はユーザー操作のあとに作る。
 */
import { AUDIO_SOURCES } from './sources';

export type ChannelId = 'bgm' | 'cafe' | 'rain';

export interface AudioState {
  soundOn: boolean;
  bgmOn: boolean;
  bgmVolume: number;
  cafeVolume: number;
  rainVolume: number;
  /** 雨の強さ 0..1（降っていなければ雨音は鳴らない） */
  rain: number;
}

interface Channel {
  gain: GainNode;
  stop(): void;
}

const FADE = 0.8;

function noiseBuffer(ctx: AudioContext, seconds: number, kind: 'white' | 'brown'): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (kind === 'white') data[i] = white;
    else {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }
  // つなぎ目が目立たないよう、頭と終わりをなじませる
  const blend = Math.floor(ctx.sampleRate * 0.25);
  for (let i = 0; i < blend; i++) {
    const k = i / blend;
    data[i] = data[i] * k + data[len - blend + i] * (1 - k);
  }
  return buf;
}

function loopNoise(ctx: AudioContext, buf: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.loopEnd = buf.duration - 0.25;
  src.start();
  return src;
}

/** ファイルの音源をループ再生するチャンネル */
function fileChannel(ctx: AudioContext, out: AudioNode, urls: string[]): Channel {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(out);
  const el = new Audio();
  el.crossOrigin = 'anonymous';
  el.preload = 'auto';
  let index = 0;
  el.src = urls[0];
  el.loop = urls.length === 1;
  el.addEventListener('ended', () => {
    index = (index + 1) % urls.length;
    el.src = urls[index];
    void el.play().catch(() => {});
  });
  ctx.createMediaElementSource(el).connect(gain);
  void el.play().catch(() => {});
  return {
    gain,
    stop() {
      el.pause();
      el.removeAttribute('src');
      gain.disconnect();
    },
  };
}

// ---- 合成の BGM ---------------------------------------------------------

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

/** ゆっくりしたコード進行（1つ8秒）。数字は MIDI ノート */
const CHORDS: { bass: number; notes: number[] }[] = [
  { bass: 41, notes: [57, 60, 64, 67] }, // Fmaj7
  { bass: 40, notes: [55, 59, 62, 67] }, // Em7
  { bass: 38, notes: [57, 60, 65, 69] }, // Dm7
  { bass: 36, notes: [55, 59, 64, 67] }, // Cmaj7
  { bass: 45, notes: [55, 60, 64, 67] }, // Am7
  { bass: 38, notes: [53, 57, 60, 64] }, // Dm7
  { bass: 43, notes: [53, 57, 60, 62] }, // G7sus
  { bass: 36, notes: [52, 55, 59, 62] }, // Cmaj9
];
const MELODY = [72, 74, 76, 79, 81, 84];
const CHORD_SECONDS = 8;

function synthBgm(ctx: AudioContext, out: AudioNode): Channel {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1900;
  filter.Q.value = 0.3;
  const delay = ctx.createDelay(1.5);
  delay.delayTime.value = 0.52;
  const feedback = ctx.createGain();
  feedback.gain.value = 0.28;
  const wet = ctx.createGain();
  wet.gain.value = 0.35;
  filter.connect(gain);
  filter.connect(delay);
  delay.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  wet.connect(gain);
  gain.connect(out);

  const tone = (freq: number, at: number, dur: number, level: number, type: OscillatorType = 'sine') => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.linearRampToValueAtTime(level, at + 0.04);
    env.gain.exponentialRampToValueAtTime(level * 0.35, at + dur * 0.4);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(env);
    env.connect(filter);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  };

  let nextAt = ctx.currentTime + 0.3;
  let step = 0;
  let lastMelody = 2;
  const schedule = () => {
    while (nextAt < ctx.currentTime + 6) {
      const chord = CHORDS[step % CHORDS.length];
      const at = nextAt;
      tone(midi(chord.bass), at, 6.5, 0.16);
      chord.notes.forEach((n, i) => {
        const t = at + i * 0.09 + Math.random() * 0.02;
        tone(midi(n), t, 6, 0.055, 'triangle');
        tone(midi(n) * 2, t, 2.5, 0.012);
      });
      // 後半にもう一度、静かに和音を置く
      if (Math.random() < 0.7) {
        [chord.notes[1], chord.notes[3]].forEach((n, i) => tone(midi(n), at + 4 + i * 0.12, 3.5, 0.04, 'triangle'));
      }
      // まばらな旋律
      for (let beat = 1; beat < 8; beat++) {
        if (Math.random() < 0.3) {
          lastMelody = Math.max(0, Math.min(MELODY.length - 1, lastMelody + Math.round(Math.random() * 4 - 2)));
          const late = Math.random() < 0.3 ? 0.5 : 0;
          tone(midi(MELODY[lastMelody]), at + beat + late, 2.4, 0.045);
        }
      }
      nextAt += CHORD_SECONDS;
      step++;
    }
  };
  schedule();
  const timer = setInterval(schedule, 1000);

  return {
    gain,
    stop() {
      clearInterval(timer);
      gain.disconnect();
    },
  };
}

// ---- 合成の環境音 -------------------------------------------------------

function synthCafe(ctx: AudioContext, out: AudioNode): Channel {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(out);

  // 部屋の低いざわめき
  const room = loopNoise(ctx, noiseBuffer(ctx, 6, 'brown'));
  const roomFilter = ctx.createBiquadFilter();
  roomFilter.type = 'lowpass';
  roomFilter.frequency.value = 420;
  const roomGain = ctx.createGain();
  roomGain.gain.value = 0.5;
  room.connect(roomFilter).connect(roomGain).connect(gain);

  // 遠くの話し声のような揺れ
  const murmur = loopNoise(ctx, noiseBuffer(ctx, 5, 'brown'));
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 520;
  band.Q.value = 0.9;
  const murmurGain = ctx.createGain();
  murmurGain.gain.value = 0.25;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.23;
  const lfoDepth = ctx.createGain();
  lfoDepth.gain.value = 0.12;
  lfo.connect(lfoDepth).connect(murmurGain.gain);
  lfo.start();
  murmur.connect(band).connect(murmurGain).connect(gain);

  // ときどき食器の音
  let timer: ReturnType<typeof setTimeout>;
  const clink = () => {
    const at = ctx.currentTime + 0.05;
    const hits = 1 + Math.floor(Math.random() * 2);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.2 - 0.8;
    pan.connect(gain);
    for (let i = 0; i < hits; i++) {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 1800 + Math.random() * 2200;
      const t = at + i * (0.07 + Math.random() * 0.08);
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.035 + Math.random() * 0.03, t + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(env).connect(pan);
      osc.start(t);
      osc.stop(t + 0.35);
    }
    timer = setTimeout(clink, 7000 + Math.random() * 16000);
  };
  timer = setTimeout(clink, 4000 + Math.random() * 6000);

  return {
    gain,
    stop() {
      clearTimeout(timer);
      room.stop();
      murmur.stop();
      lfo.stop();
      gain.disconnect();
    },
  };
}

function synthRain(ctx: AudioContext, out: AudioNode): Channel {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(out);

  const hiss = loopNoise(ctx, noiseBuffer(ctx, 5, 'white'));
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 900;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 5200;
  const hissGain = ctx.createGain();
  hissGain.gain.value = 0.14;
  hiss.connect(hp).connect(lp).connect(hissGain).connect(gain);

  const rumble = loopNoise(ctx, noiseBuffer(ctx, 7, 'brown'));
  const rl = ctx.createBiquadFilter();
  rl.type = 'lowpass';
  rl.frequency.value = 650;
  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0.55;
  rumble.connect(rl).connect(rumbleGain).connect(gain);

  return {
    gain,
    stop() {
      hiss.stop();
      rumble.stop();
      gain.disconnect();
    },
  };
}

// ---- まとめ役 ---------------------------------------------------------------

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private channels: Partial<Record<ChannelId, Channel>> = {};
  private state: AudioState = { soundOn: false, bgmOn: true, bgmVolume: 0.5, cafeVolume: 0.4, rainVolume: 0.5, rain: 0 };
  /** ユーザー操作があって、音を出してよい状態か */
  private unlocked = false;

  get supported(): boolean {
    return typeof window !== 'undefined' && (typeof AudioContext !== 'undefined' || 'webkitAudioContext' in window);
  }

  /** ユーザー操作（クリックやキー入力）の中から呼ぶ */
  unlock(): void {
    this.unlocked = true;
    this.apply();
  }

  update(state: AudioState): void {
    this.state = state;
    this.apply();
  }

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (!this.supported) return null;
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  private target(id: ChannelId): number {
    const s = this.state;
    if (!s.soundOn) return 0;
    if (id === 'bgm') return s.bgmOn ? s.bgmVolume * 0.8 : 0;
    if (id === 'cafe') return s.cafeVolume * 0.6;
    return s.rainVolume * Math.min(1, s.rain * 1.2) * 0.8;
  }

  private create(id: ChannelId, ctx: AudioContext, out: AudioNode): Channel {
    if (id === 'bgm') return AUDIO_SOURCES.bgm.length > 0 ? fileChannel(ctx, out, AUDIO_SOURCES.bgm) : synthBgm(ctx, out);
    if (id === 'cafe') return AUDIO_SOURCES.cafe ? fileChannel(ctx, out, [AUDIO_SOURCES.cafe]) : synthCafe(ctx, out);
    return AUDIO_SOURCES.rain ? fileChannel(ctx, out, [AUDIO_SOURCES.rain]) : synthRain(ctx, out);
  }

  private apply(): void {
    if (!this.unlocked) return;
    const anyOn = (['bgm', 'cafe', 'rain'] as const).some((id) => this.target(id) > 0);
    if (!anyOn && !this.ctx) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;

    if (anyOn && ctx.state === 'suspended') void ctx.resume().catch(() => {});

    for (const id of ['bgm', 'cafe', 'rain'] as const) {
      const target = this.target(id);
      let ch = this.channels[id];
      if (target > 0 && !ch) {
        try {
          ch = this.create(id, ctx, this.master);
          this.channels[id] = ch;
        } catch {
          continue;
        }
      }
      if (!ch) continue;
      const g = ch.gain.gain;
      g.cancelScheduledValues(ctx.currentTime);
      g.setTargetAtTime(target, ctx.currentTime, FADE / 3);
      if (target === 0) {
        // 消えきってから止める（すぐまた鳴らすこともあるので少し待つ）
        const stale = ch;
        setTimeout(() => {
          if (this.channels[id] === stale && this.target(id) === 0) {
            stale.stop();
            delete this.channels[id];
          }
        }, FADE * 1000 * 3);
      }
    }

    if (!anyOn) {
      setTimeout(() => {
        const stillOff = (['bgm', 'cafe', 'rain'] as const).every((id) => this.target(id) === 0);
        if (stillOff && this.ctx?.state === 'running') void this.ctx.suspend().catch(() => {});
      }, FADE * 1000 * 4);
    }
  }
}

export const audio = new AudioEngine();
