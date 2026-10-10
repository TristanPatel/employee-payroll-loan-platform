import React from 'react';
import { Composition } from 'remotion';
import { Showreel } from './Showreel';
import { TL } from './lib';

export const Root: React.FC = () => (
  <>
    <Composition id="Vertical" component={Showreel} durationInFrames={TL.durationInFrames} fps={TL.fps} width={1080} height={1920} />
    <Composition id="Square" component={Showreel} durationInFrames={TL.durationInFrames} fps={TL.fps} width={1080} height={1080} />
    <Composition id="Wide" component={Showreel} durationInFrames={TL.durationInFrames} fps={TL.fps} width={1920} height={1080} />
  </>
);
