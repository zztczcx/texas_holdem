'use client';

import { useCallback, useRef } from 'react';

/**
 * Poker sound effects generated entirely via Web Audio API — no external files required.
 * All sounds are short (< 0.4 s) synthetic tones tuned to feel satisfying.
 */

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  // Re-use a single AudioContext per page to avoid "too many AudioContexts" warnings.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (!w.__pokerAudioCtx || w.__pokerAudioCtx.state === 'closed') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctor: typeof AudioContext | undefined = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return null;
    try {
      w.__pokerAudioCtx = new Ctor();
    } catch {
      return null;
    }
  }
  return w.__pokerAudioCtx as AudioContext;
}

/** Resume context after a user gesture (browsers require this). */
async function resumeCtx(ctx: AudioContext): Promise<void> {
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}

// ── Primitive builders ────────────────────────────────────────────────────────

function playTone(
  ctx: AudioContext,
  freq: number,
  type: OscillatorType,
  startTime: number,
  duration: number,
  gain = 0.25,
): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.connect(env);
  env.connect(ctx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  env.gain.setValueAtTime(gain, startTime);
  env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.01);
}

function playNoise(
  ctx: AudioContext,
  startTime: number,
  duration: number,
  gain = 0.15,
  highpass = 2000,
): void {
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = highpass;

  const env = ctx.createGain();
  env.gain.setValueAtTime(gain, startTime);
  env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  source.connect(filter);
  filter.connect(env);
  env.connect(ctx.destination);
  source.start(startTime);
  source.stop(startTime + duration);
}

// ── Sound recipes ─────────────────────────────────────────────────────────────

function soundDeal(ctx: AudioContext): void {
  const t = ctx.currentTime;
  // Quick card-swish: two short noise bursts with descending highpass
  playNoise(ctx, t, 0.08, 0.18, 3000);
  playNoise(ctx, t + 0.06, 0.07, 0.10, 1500);
}

function soundChip(ctx: AudioContext): void {
  const t = ctx.currentTime;
  // Short click: high sine + quick thud
  playTone(ctx, 900, 'sine', t, 0.06, 0.18);
  playTone(ctx, 400, 'triangle', t, 0.08, 0.12);
}

function soundRaise(ctx: AudioContext): void {
  const t = ctx.currentTime;
  // Two ascending chip clicks — emphasises the raise
  playTone(ctx, 800, 'sine', t, 0.06, 0.20);
  playTone(ctx, 1100, 'sine', t + 0.07, 0.07, 0.18);
  playTone(ctx, 350, 'triangle', t, 0.08, 0.10);
}

function soundFold(ctx: AudioContext): void {
  const t = ctx.currentTime;
  // Low dismissive thud — card slapped face-down
  playTone(ctx, 160, 'triangle', t, 0.12, 0.22);
  playNoise(ctx, t, 0.09, 0.10, 500);
}

function soundAllIn(ctx: AudioContext): void {
  const t = ctx.currentTime;
  // Stack of chips: rapid ascending series
  [0, 0.06, 0.12, 0.18].forEach((delay, i) => {
    playTone(ctx, 700 + i * 120, 'sine', t + delay, 0.09, 0.18);
  });
  playTone(ctx, 300, 'triangle', t, 0.18, 0.18);
}

function soundWin(ctx: AudioContext): void {
  const t = ctx.currentTime;
  // Ascending arpeggio — C major: C4 E4 G4 C5
  const notes = [261.63, 329.63, 392.0, 523.25];
  notes.forEach((freq, i) => {
    playTone(ctx, freq, 'triangle', t + i * 0.09, 0.22, 0.20);
    playTone(ctx, freq * 2, 'sine', t + i * 0.09, 0.12, 0.08);
  });
}

function soundCheck(ctx: AudioContext): void {
  const t = ctx.currentTime;
  // Gentle tap — short mid-range click
  playTone(ctx, 520, 'sine', t, 0.05, 0.12);
  playNoise(ctx, t, 0.04, 0.06, 1000);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export type SoundName = 'deal' | 'chip' | 'raise' | 'fold' | 'allIn' | 'win' | 'check';

export function useSounds(): { play: (sound: SoundName) => void } {
  const enabledRef = useRef(true);

  const play = useCallback((sound: SoundName): void => {
    if (!enabledRef.current) return;
    const ctx = getAudioContext();
    if (!ctx) return;

    resumeCtx(ctx).then(() => {
      switch (sound) {
        case 'deal':   soundDeal(ctx);   break;
        case 'chip':   soundChip(ctx);   break;
        case 'raise':  soundRaise(ctx);  break;
        case 'fold':   soundFold(ctx);   break;
        case 'allIn':  soundAllIn(ctx);  break;
        case 'win':    soundWin(ctx);    break;
        case 'check':  soundCheck(ctx);  break;
      }
    }).catch(() => {/* ignore AudioContext errors */});
  }, []);

  return { play };
}
