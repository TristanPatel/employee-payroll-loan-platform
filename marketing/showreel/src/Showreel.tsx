import React, { useEffect, useState } from 'react';
import { AbsoluteFill, Audio, continueRender, delayRender, staticFile, useCurrentFrame } from 'remotion';
import { C, Grain, LightBG, TL, expoIn, expoOut, tw, useLayout } from './lib';
import { Hook } from './scenes/Hook';
import { Assemble } from './scenes/Assemble';
import { CalcScene, JoinScene, SigninScene } from './scenes/Features';
import { NumberScene } from './scenes/Number';
import { Lockup } from './scenes/Lockup';

// The real Inter variable font extracted from the app's Next.js build.
const useInter = () => {
  const [handle] = useState(() => delayRender('Loading Inter'));
  useEffect(() => {
    const face = new FontFace('Inter', `url(${staticFile('fonts/Inter-latin-variable.woff2')}) format('woff2')`, { weight: '100 900' });
    face.load().then((loaded) => { (document.fonts as any).add(loaded); continueRender(handle); }).catch((e) => { console.error(e); continueRender(handle); });
  }, [handle]);
};

const SCENES: [string, number, number, React.FC][] = [
  ['hook', 0, 90, Hook],
  ['assemble', 90, 196, Assemble],
  ['calc', 195, 301, CalcScene],
  ['join', 292, 391, JoinScene],
  ['signin', 382, 481, SigninScene],
  ['number', 480, 600, NumberScene],
  ['lockup', 600, 750, Lockup],
];

export const Showreel: React.FC = () => {
  useInter();
  const f = useCurrentFrame();
  const { W, H } = useLayout();
  const h = TL.hook;
  // crimson diagonal wipe from the dark hook into the light product world
  const wipeIn = tw(f, h.exit + 3, 90, 0, 1, expoIn);
  const wipeOut = tw(f, 90, 100, 0, 1, expoOut);
  const dark = f < 90 || (f >= 480 && f < 600);
  return (
    <AbsoluteFill style={{ background: C.base }}>
      {!dark && <LightBG />}
      {SCENES.map(([id, from, to, S]) => {
        if (f < from || f >= to) return null;
        // the scene that owns the frame draws on top
        return <AbsoluteFill key={id}><S /></AbsoluteFill>;
      })}
      {f >= h.exit + 3 && f < 100 && (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute', left: -W * 0.25, width: W * 1.5, height: H * 1.3, background: C.primary,
            top: f < 90 ? H * 1.15 - wipeIn * H * 1.3 : -0.15 * H - wipeOut * H * 1.3,
            transform: 'skewY(-8deg)',
            boxShadow: `0 0 0 ${H * 0.05}px ${C.primaryLight}`,
          }} />
        </AbsoluteFill>
      )}
      <Grain dark={dark} />
      <Audio src={staticFile('audio/master.wav')} />
    </AbsoluteFill>
  );
};
