import React from 'react';
import { Easing, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import timeline from '../public/timeline.json';
import boxes from '../public/boxes.json';

export const TL = timeline as any;
export const BOX = boxes as any;

// Brand tokens (public/brand.json, from packages/ui/src/tokens.ts)
export const C = {
  primary: '#8b1e24',
  primaryDark: '#701820',
  primaryLight: '#a8252c',
  accent: '#0f1117',
  base: '#faf9f7',
  raised: '#ffffff',
  muted: '#f3f1ed',
  ink: '#0f172a',
  inkMuted: '#64748b',
};
export const FONT = "'Inter', system-ui, sans-serif";

export type Mode = 'v' | 's' | 'w';
export const useLayout = () => {
  const { width: W, height: H, fps } = useVideoConfig();
  const mode: Mode = W < H ? 'v' : W === H ? 's' : 'w';
  return { W, H, fps, mode };
};

export const expoOut = Easing.bezier(0.16, 1, 0.3, 1);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);
export const expoIn = Easing.bezier(0.7, 0, 0.84, 0);

/** clamped interpolate between two frames */
export const tw = (f: number, a: number, b: number, from = 0, to = 1, easing = expoOut) =>
  interpolate(f, [a, b], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing });

export const spr = (f: number, at: number, fps: number, config: Partial<{ damping: number; stiffness: number; mass: number }> = {}) =>
  spring({ frame: f - at, fps, config: { damping: 14, stiffness: 170, mass: 0.8, ...config } });

/** A rectangle of a real screenshot, cropped (never redrawn). Coordinates in CSS px; captures are 3×. */
export const Crop: React.FC<{
  src: string; imgCssW: number; sx: number; sy: number; sw: number; sh: number; k: number; style?: React.CSSProperties;
}> = ({ src, imgCssW, sx, sy, sw, sh, k, style }) => (
  <div style={{ position: 'absolute', width: sw * k, height: sh * k, overflow: 'hidden', ...style }}>
    <Img src={staticFile(src)} style={{ position: 'absolute', left: -sx * k, top: -sy * k, width: imgCssW * k }} />
  </div>
);

/** Rect where a feature card sits, shared by the assembly push and the feature scenes (match cut). */
export const cardRect = (mode: Mode, W: number, H: number, cssW: number, cssH: number) => {
  const area =
    mode === 'v' ? { cx: W / 2, cy: 1150, mw: 900, mh: 1260 }
    : mode === 's' ? { cx: 760, cy: H / 2, mw: 560, mh: 880 }
    : { cx: 1360, cy: H / 2, mw: 800, mh: 900 };
  const k = Math.min(area.mw / cssW, area.mh / cssH);
  return { k, x: area.cx - (cssW * k) / 2, y: area.cy - (cssH * k) / 2, w: cssW * k, h: cssH * k };
};

/** Pointer that travels between keyframes (card-local CSS px) and presses on beat. */
export const Cursor: React.FC<{
  keys: { f: number; x: number; y: number }[]; presses: number[]; k: number; visibleFrom?: number;
}> = ({ keys, presses, k, visibleFrom = -1e9 }) => {
  const f = useCurrentFrame();
  let x = keys[0].x, y = keys[0].y;
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (b.f <= a.f) { if (f >= b.f) { x = b.x; y = b.y; } continue; } // zero-length segment = jump
    if (f >= a.f && f <= b.f) {
      const p = interpolate(f, [a.f, b.f], [0, 1], { easing: inOut, extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
      // slight arc for a hand-moved feel
      const arc = Math.sin(p * Math.PI) * Math.min(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.18);
      x = a.x + (b.x - a.x) * p;
      y = a.y + (b.y - a.y) * p - arc;
    } else if (f > b.f) { x = b.x; y = b.y; }
  }
  let press = 0, ripple: number | null = null;
  for (const p of presses) {
    if (f >= p - 2 && f <= p + 6) press = Math.max(press, 1 - Math.abs(f - p) / 6);
    if (f >= p && f < p + 16) ripple = (f - p) / 16;
  }
  if (f < visibleFrom) return null;
  const S = 1.15; // pointer scale in output px
  return (
    <>
      {ripple !== null && (
        <div style={{
          position: 'absolute', left: x * k, top: y * k, width: 0, height: 0,
        }}>
          <div style={{
            position: 'absolute', left: -90 * ripple - 10, top: -90 * ripple - 10, width: 180 * ripple + 20, height: 180 * ripple + 20,
            borderRadius: '50%', border: `${6 * (1 - ripple)}px solid ${C.primaryLight}`, opacity: 1 - ripple,
          }} />
        </div>
      )}
      <svg width={44 * S} height={56 * S} viewBox="0 0 44 56"
        style={{ position: 'absolute', left: x * k - 6 * S, top: y * k - 3 * S, transform: `scale(${1 - press * 0.18})`, transformOrigin: '6px 3px', filter: 'drop-shadow(0 6px 10px rgba(15,17,23,.35))' }}>
        <path d="M6 3 L6 44 L16.5 34.5 L23.5 51 L31 47.8 L24 31.5 L38 31.5 Z" fill="#fff" stroke={C.accent} strokeWidth={3} strokeLinejoin="round" />
      </svg>
    </>
  );
};

/** Film grain + vignette over everything. */
export const Grain: React.FC<{ dark?: boolean }> = ({ dark }) => {
  const f = useCurrentFrame();
  const { W, H } = useLayout();
  return (
    <>
      <svg width={W} height={H} style={{ position: 'absolute', inset: 0, opacity: dark ? 0.1 : 0.06, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
        <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={2} seed={Math.floor(f / 2) % 97} /></filter>
        <rect width="100%" height="100%" filter="url(#g)" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(15,17,23,0.18) 100%)', pointerEvents: 'none' }} />
    </>
  );
};

/** Warm light ground with drifting crimson glows. */
export const LightBG: React.FC = () => {
  const f = useCurrentFrame();
  const { W, H } = useLayout();
  const g1x = W * (0.8 + 0.06 * Math.sin(f / 40)), g1y = H * (0.15 + 0.04 * Math.cos(f / 50));
  const g2x = W * (0.12 + 0.05 * Math.cos(f / 45)), g2y = H * (0.88 + 0.03 * Math.sin(f / 35));
  return (
    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(180deg, ${C.base}, ${C.muted})` }}>
      <div style={{ position: 'absolute', left: g1x - 700, top: g1y - 700, width: 1400, height: 1400, borderRadius: '50%', background: `radial-gradient(circle, rgba(139,30,36,0.16), rgba(139,30,36,0) 65%)` }} />
      <div style={{ position: 'absolute', left: g2x - 600, top: g2y - 600, width: 1200, height: 1200, borderRadius: '50%', background: `radial-gradient(circle, rgba(168,37,44,0.12), rgba(168,37,44,0) 65%)` }} />
    </div>
  );
};

export const shake = (f: number, at: number, dur: number, amp: number) => {
  if (f < at || f > at + dur) return { x: 0, y: 0 };
  const d = 1 - (f - at) / dur;
  return { x: (random(`sx${Math.floor(f)}`) - 0.5) * amp * d * d, y: (random(`sy${Math.floor(f)}`) - 0.5) * amp * d * d };
};

/** Kinetic headline: each word rises out of a mask with a spring, staggered. */
export const RiseWords: React.FC<{
  text: string; at: number; size: number; color?: string; weight?: number; stagger?: number; accent?: string[]; lineHeight?: number; tracking?: number; maxWidth?: number; align?: 'left' | 'center';
}> = ({ text, at, size, color = C.ink, weight = 800, stagger = 2.5, accent = [], lineHeight = 1.02, tracking = -0.035, maxWidth, align = 'left' }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ fontFamily: FONT, fontSize: size, fontWeight: weight, lineHeight, letterSpacing: `${tracking}em`, color, maxWidth, textAlign: align }}>
      {text.split(' ').map((w, i) => {
        const s = spr(f, at + i * stagger, fps, { damping: 15, stiffness: 190 });
        return (
          <span key={i} style={{ display: 'inline-block', overflow: 'hidden', verticalAlign: 'top', paddingBottom: size * 0.12, marginBottom: -size * 0.12 }}>
            <span style={{ display: 'inline-block', transform: `translateY(${(1 - s) * 115}%) rotate(${(1 - s) * 6}deg)`, color: accent.includes(w) ? C.primary : undefined }}>
              {w}&nbsp;
            </span>
          </span>
        );
      })}
    </div>
  );
};
