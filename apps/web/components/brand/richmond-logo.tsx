import Image from 'next/image';

/**
 * Richmond Finance brand mark — the official logo pulled from
 * richmond-afri.com (/images/logo.png, 2048x1447). Next/Image serves
 * resized variants automatically, so the large source is fine.
 */
const LOGO_W = 2048;
const LOGO_H = 1447;

export function RichmondLogo({
  className,
  height = 36,
}: {
  className?: string;
  height?: number;
}): React.ReactElement {
  const width = Math.round((height * LOGO_W) / LOGO_H);
  return (
    <Image
      src="/richmond-logo.png"
      alt="Richmond Finance — Finance, Insurance & Advisory"
      width={width}
      height={height}
      priority
      className={className}
    />
  );
}
