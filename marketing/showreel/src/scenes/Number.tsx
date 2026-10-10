import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, FONT, RiseWords, TL, expoIn, spr, tw, useLayout } from '../lib';

/** Beat 4 — "10 minutes to apply, without visiting a branch." Count-up on 16ths, clock ring fills a sixth of the hour. */
export const NumberScene: React.FC = () => {
  const f = useCurrentFrame();
  const { W, H, fps, mode } = useLayout();
  const n = TL.number;
  const count = Math.max(0, Math.min(n.count, Math.floor((f - n.countFrom + 1e-6) / n.countStep)));
  const lastTick = n.countFrom + count * n.countStep;
  const punch = count > 0 ? 1 - tw(f, lastTick, lastTick + 4) : 0;
  const landed = spr(f, n.minutes, fps, { damping: 10, stiffness: 220 });
  const out = tw(f, n.riserFrom, TL.lockup.impact, 0, 1, expoIn);
  const beat = Math.max(0, 1 - ((f - n.countFrom) % 30) / 14);

  const G = mode === 'v'
    ? { cx: W / 2, cy: 720, ring: 380, num: 470, textX: W / 2, textY: 1230, align: 'center' as const, big: 120, small: 56, width: 980 }
    : mode === 's'
    ? { cx: W / 2, cy: 400, ring: 270, num: 340, textX: W / 2, textY: 720, align: 'center' as const, big: 92, small: 42, width: 980 }
    : { cx: 560, cy: H / 2, ring: 330, num: 420, textX: 1010, textY: 330, align: 'left' as const, big: 128, small: 56, width: 860 };

  const circ = 2 * Math.PI * G.ring;
  const fill = tw(f, n.countFrom, n.countFrom + n.count * n.countStep, 0, 1, (t) => t) / 6; // 10 min = 1/6 of the hour
  return (
    <AbsoluteFill style={{ background: C.accent, overflow: 'hidden' }}>
      <AbsoluteFill style={{ background: `radial-gradient(circle at ${G.cx}px ${G.cy}px, rgba(168,37,44,${0.28 + 0.2 * beat}), rgba(15,17,23,0) ${mode === 'v' ? 55 : 60}%)` }} />
      <AbsoluteFill style={{ transform: `scale(${1 + out * 0.35})`, filter: out > 0.02 ? `blur(${out * 16}px)` : undefined, opacity: 1 - out * 0.4 }}>
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
          {/* 60 minute ticks */}
          {Array.from({ length: 60 }).map((_, i) => {
            const a = (i / 60) * Math.PI * 2 - Math.PI / 2;
            const on = i < Math.round(fill * 60);
            const r1 = G.ring + 26, r2 = G.ring + (i % 5 === 0 ? 58 : 42);
            return <line key={i} x1={G.cx + Math.cos(a) * r1} y1={G.cy + Math.sin(a) * r1} x2={G.cx + Math.cos(a) * r2} y2={G.cy + Math.sin(a) * r2}
              stroke={on ? C.primaryLight : 'rgba(255,255,255,0.18)'} strokeWidth={i % 5 === 0 ? 6 : 3} strokeLinecap="round"
              opacity={tw(f, n.countFrom - 6 + i * 0.25, n.countFrom + 2 + i * 0.25)} />;
          })}
          <circle cx={G.cx} cy={G.cy} r={G.ring} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={14} />
          <circle cx={G.cx} cy={G.cy} r={G.ring} fill="none" stroke={C.primaryLight} strokeWidth={14} strokeLinecap="round"
            strokeDasharray={`${circ * fill} ${circ}`} transform={`rotate(-90 ${G.cx} ${G.cy})`} />
        </svg>
        <div style={{
          position: 'absolute', left: G.cx - 500, top: G.cy - G.num * 0.62, width: 1000, textAlign: 'center',
          fontFamily: FONT, fontWeight: 900, fontSize: G.num, lineHeight: 1.2, letterSpacing: '-0.06em', color: '#fff',
          transform: `scale(${1 + punch * 0.08 + landed * 0.04})`, fontVariantNumeric: 'tabular-nums',
          textShadow: `0 0 ${60 * landed}px rgba(168,37,44,0.8)`,
        }}>{count}</div>
        <div style={{ position: 'absolute', left: G.align === 'center' ? G.textX - G.width / 2 : G.textX, top: G.textY, width: G.width, textAlign: G.align }}>
          {f >= n.minutes - 1 && (
            <div style={{ transform: `scale(${1.6 - 0.6 * landed})`, transformOrigin: G.align === 'center' ? '50% 50%' : '0 50%', opacity: Math.min(1, landed * 2) }}>
              <div style={{ fontFamily: FONT, fontWeight: 900, fontSize: G.big, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1 }}>minutes</div>
            </div>
          )}
          <div style={{ marginTop: G.small * 0.3 }}>
            <RiseWords text="to apply" at={n.toApply} size={G.big * 0.62} color={C.primaryLight} weight={800} align={G.align} />
          </div>
          <div style={{ position: 'relative', marginTop: G.small * 0.6, display: 'inline-block' }}>
            <RiseWords text="without visiting a branch." at={n.noBranch} size={G.small} color="rgba(255,255,255,0.86)" weight={600} stagger={1.5} tracking={-0.02} align={G.align} />
            <div style={{ position: 'absolute', left: 0, bottom: -G.small * 0.12, height: Math.max(4, G.small * 0.09), width: `${100 * tw(f, n.strike, n.strike + 8)}%`, background: C.primaryLight }} />
          </div>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: '#fff', opacity: tw(f, TL.lockup.impact - 4, TL.lockup.impact, 0, 1, expoIn) }} />
    </AbsoluteFill>
  );
};
