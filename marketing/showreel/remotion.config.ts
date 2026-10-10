import { Config } from '@remotion/cli/config';

// Optional: point Remotion at a local Chrome / chrome-headless-shell instead of letting it download one.
if (process.env.REMOTION_BROWSER_EXECUTABLE) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER_EXECUTABLE);
}
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setConcurrency(4);
