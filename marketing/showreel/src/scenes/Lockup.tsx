import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { C, Cursor, FONT, LightBG, TL, spr, tw, useLayout, expoOut } from '../lib';

// Geometry of the official logo (public/logo/richmond-logo-tight.png, 1795×1136) and its split parts.
const LOGO = { w: 1795, h: 1136 };
const DOVE = { x: 1, y: 2, w: 731, h: 930 };
const WORD = { x: 709, y: 460, w: 975, h: 138 };

/** Beat 5 — logo lockup on the impact, URL and CTA. */
export const Lockup: React.FC = () => {
  const f = useCurrentFrame();
  const { W, H, fps, mode } = useLayout();
  const L = TL.lockup;
  const G = mode === 'v'
    ? { lw: 860, cx: W / 2, ly: 780, url: 56, urlY: 1290, cta: 56, ctaY: 1430 }
    : mode === 's'
    ? { lw: 600, cx: W / 2, ly: 360, url: 44, urlY: 740, cta: 42, ctaY: 840 }
    : { lw: 700, cx: W / 2, ly: 330, url: 50, urlY: 770, cta: 46, ctaY: 880 };
  const s = G.lw / LOGO.w;
  const lx = G.cx - G.lw / 2;
  const dIn = spr(f, L.dove, fps, { damping: 12, stiffness: 120, mass: 1 });
  const float = f > L.dove + 30 ? Math.sin((f - L.dove - 30) / 18) * 6 : 0;
  const wipe = tw(f, L.wordmark, L.wordmark + 14);
  const urlChars = 'staffloans.richmond-afri.com'.split('');
  const cta = spr(f, L.cta, fps, { damping: 11, stiffness: 200 });
  const tapPress = Math.max(0, 1 - Math.abs(f - L.tap) / 5);
  const flash = 1 - tw(f, L.impact, L.impact + 12);
  const ring = tw(f, L.impact, L.impact + 30);
  const ring2 = tw(f, 690, 720);
  const zoom = 1 + tw(f, L.impact, 750, 0, 0.04, (t) => t);

  const dove = (lag: number, alpha: number) => {
    const d = spr(f, L.dove + lag, fps, { damping: 12, stiffness: 120, mass: 1 });
    return (
      <div key={lag} style={{
        position: 'absolute', left: DOVE.x * s, top: DOVE.y * s, width: DOVE.w * s, height: DOVE.h * s, opacity: alpha * Math.min(1, d * 2),
        transform: `translate(${(1 - d) * -W * 0.55}px, ${(1 - d) * H * 0.35 + float}px) rotate(${(1 - d) * -28}deg) scale(${0.5 + 0.5 * d})`,
        transformOrigin: '60% 40%',
      }}>
        <Img src={staticFile('logo/richmond-dove.png')} style={{ width: '100%' }} />
      </div>
    );
  };

  const ctaW = G.cta * 10.6;
  const ctaH = G.cta * 2.2;
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>

      {/* shockwaves on the impact and on the final chord */}
      {[ring, ring2 * 0.7].map((r, i) => r > 0 && r < 1 && (
        <div key={i} style={{
          position: 'absolute', left: G.cx - 1400 * r, top: G.ly + 120 - 1400 * r, width: 2800 * r, height: 2800 * r, borderRadius: '50%',
          border: `${18 * (1 - r)}px solid rgba(139,30,36,${0.5 * (1 - r)})`,
        }} />
      ))}
      <AbsoluteFill style={{ transform: `scale(${zoom})` }}>
        <div style={{ position: 'absolute', left: lx, top: G.ly - (LOGO.h * s) / 2, width: G.lw, height: LOGO.h * s }}>
          {dove(6, 0.08)}{dove(4, 0.14)}{dove(2, 0.25)}{dove(0, 1)}
          <div style={{
            position: 'absolute', left: WORD.x * s, top: WORD.y * s, width: WORD.w * s, height: WORD.h * s,
            clipPath: `inset(0 ${100 - wipe * 100}% 0 0)`, transform: `translateX(${(1 - wipe) * 40}px)`,
          }}>
            <Img src={staticFile('logo/richmond-wordmark.png')} style={{ width: '100%' }} />
          </div>
        </div>
        <div style={{ position: 'absolute', left: 0, width: W, top: G.urlY, textAlign: 'center', fontFamily: FONT, fontSize: G.url, fontWeight: 700, letterSpacing: '-0.02em', color: C.ink }}>
          {urlChars.map((ch, i) => {
            const a = tw(f, L.url + i * 0.6, L.url + i * 0.6 + 10);
            const isDomain = i >= 'staffloans.'.length;
            return <span key={i} style={{ display: 'inline-block', opacity: a, transform: `translateY(${(1 - a) * 30}px)`, color: isDomain ? C.inkMuted : C.primary }}>{ch}</span>;
          })}
        </div>
        <div style={{
          position: 'absolute', left: G.cx - ctaW / 2, top: G.ctaY, width: ctaW, height: ctaH, borderRadius: 999,
          background: C.primary, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: G.cta * 0.4,
          fontFamily: FONT, fontWeight: 700, fontSize: G.cta, letterSpacing: '-0.01em',
          transform: `scale(${cta * (1 - tapPress * 0.05)})`, opacity: Math.min(1, cta * 2),
          boxShadow: `0 ${20 + 20 * ring2}px ${50 + 40 * ring2}px rgba(139,30,36,${0.35 + 0.2 * ring2})`,
        }}>
          Apply in 10 minutes
          <svg width={G.cta * 0.8} height={G.cta * 0.8} viewBox="0 0 24 24" style={{ transform: `translateX(${Math.sin(Math.max(0, f - L.tap) / 6) * 6}px)` }}><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div style={{ position: 'absolute', left: 0, top: 0 }}>
          <Cursor k={1} presses={[L.tap]} visibleFrom={L.cta + 2}
            keys={[{ f: L.cta + 2, x: W + 60, y: G.ctaY + ctaH * 2.2 }, { f: L.tap - 3, x: G.cx + ctaW * 0.22, y: G.ctaY + ctaH * 0.6 }, { f: 700, x: G.cx + ctaW * 0.22, y: G.ctaY + ctaH * 0.6 }, { f: 724, x: W + 80, y: G.ctaY + ctaH * 2.5 }]} />
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#fff', opacity: flash, pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};
