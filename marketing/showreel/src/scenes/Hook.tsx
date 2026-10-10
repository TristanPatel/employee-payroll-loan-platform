import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C, FONT, TL, shake, spr, tw, useLayout, expoIn } from '../lib';

const LINES: Record<string, string[][]> = {
  v: [['Why'], ['queue'], ['for', 'a'], ['loan?']],
  s: [['Why'], ['queue'], ['for', 'a'], ['loan?']],
  w: [['Why', 'queue'], ['for', 'a', 'loan?']],
};
const SIZE = { v: 290, s: 215, w: 215 };

/** Beat 1 — the hook. Five words of huge kinetic type, one per beat, slam on the downbeat. */
export const Hook: React.FC = () => {
  const f = useCurrentFrame();
  const { W, H, fps, mode } = useLayout();
  const words = TL.hook.words as { text: string; at: number }[];
  const at = (w: string) => words.find((x) => x.text === w)!.at;
  const size = SIZE[mode];

  const slam = spr(f, TL.hook.slam, fps, { damping: 9, stiffness: 260 });
  const sh = shake(f, TL.hook.slam, 14, 46);
  const groupScale = 1 + 0.07 * slam * (f < TL.hook.exit ? 1 : 1);
  const exitP = tw(f, TL.hook.exit, TL.hook.exit + 12, 0, 1, expoIn);

  // background ticker: the queue, crawling
  const rows = mode === 'w' ? 5 : 8;
  return (
    <AbsoluteFill style={{ background: C.accent, overflow: 'hidden' }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{
          position: 'absolute', top: (H / rows) * r - 10, left: 0, whiteSpace: 'nowrap',
          fontFamily: FONT, fontWeight: 900, fontSize: H / rows * 0.9, lineHeight: 1, letterSpacing: '-0.04em',
          color: 'transparent', WebkitTextStroke: `2px rgba(255,255,255,${r % 2 ? 0.05 : 0.08})`,
          transform: `translateX(${-((f * (r % 2 ? 3.2 : 2.1) + r * 260) % 1400)}px)`,
        }}>
          {'QUEUE · QUEUE · QUEUE · QUEUE · QUEUE · QUEUE · '}
        </div>
      ))}
      {/* crimson pulse on every beat */}
      <AbsoluteFill style={{
        background: `radial-gradient(circle at 30% 40%, rgba(168,37,44,${0.35 * Math.max(0, 1 - (f % 15) / 10) * (f < TL.hook.slam ? 0.6 : 1)}), rgba(0,0,0,0) 60%)`,
      }} />
      <AbsoluteFill style={{
        justifyContent: 'center', alignItems: mode === 'w' ? 'center' : 'flex-start',
        padding: mode === 'v' ? '0 70px' : '0 70px',
        transform: `translate(${sh.x}px, ${sh.y - exitP * H * 0.15}px) scale(${groupScale})`,
        opacity: 1 - exitP * 0.6,
      }}>
        {LINES[mode].map((line, li) => (
          <div key={li} style={{ display: 'flex', gap: size * 0.22, lineHeight: 0.92 }}>
            {line.map((w) => {
              const a = at(w);
              const s = spr(f, a, fps, { damping: 12, stiffness: 230 });
              const flash = tw(f, a, a + 8);
              const isLoan = w === 'loan?';
              const exitW = tw(f, TL.hook.exit + li * 1.5, TL.hook.exit + 10 + li * 1.5, 0, 1, expoIn);
              return (
                <span key={w} style={{ display: 'inline-block', overflow: 'hidden', padding: `0 ${size * 0.04}px ${size * 0.08}px`, margin: `0 -${size * 0.04}px -${size * 0.08}px` }}>
                  <span style={{
                    display: 'inline-block', fontFamily: FONT, fontWeight: 900, fontSize: size, letterSpacing: '-0.05em',
                    color: isLoan ? C.primaryLight : flash < 1 ? `rgb(${255 - 87 * (1 - flash)},${255 - 218 * (1 - flash)},${255 - 211 * (1 - flash)})` : '#fff',
                    transform: `translateY(${(1 - s) * 150 - exitW * 150}%) scale(${1 + (1 - s) * 0.25})`, opacity: f < a - 0.5 ? 0 : 1,
                    transformOrigin: 'left bottom',
                  }}>
                    {isLoan ? (
                      <>
                        loan
                        <span style={{ display: 'inline-block', transform: `rotate(${12 * slam - 12 * (1 - s)}deg) translateY(${-0.08 * slam * size}px)`, transformOrigin: '50% 90%', color: '#fff' }}>?</span>
                      </>
                    ) : w}
                  </span>
                </span>
              );
            })}
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
