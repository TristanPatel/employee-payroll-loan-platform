import Image from 'next/image';

/**
 * Richmond Finance brand mark.
 *
 * Drop-in for the legacy "RF" coloured-square placeholder used across the
 * site headers. Renders the vector at /richmond-logo.svg from public/.
 *
 * To swap in a bitmap (PNG/JPG): drop the file at public/richmond-logo.png
 * and change `src` below. Width / height map to a 600x220 viewBox so the
 * aspect ratio is preserved at any rendered size.
 */
export function RichmondLogo({
  className,
  height = 36,
}: {
  className?: string;
  height?: number;
}): React.ReactElement {
  const width = Math.round((height * 600) / 220);
  return (
    <Image
      src="/richmond-logo.svg"
      alt="Richmond Finance"
      width={width}
      height={height}
      priority
      className={className}
    />
  );
}
