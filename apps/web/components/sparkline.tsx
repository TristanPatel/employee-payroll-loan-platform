/**
 * Server-rendered SVG sparkline — no chart library, no client JS.
 * Pass a series of numbers (oldest first); renders a 30×8-ish ratio line
 * with the Richmond crimson stroke and a soft fill.
 */
export function Sparkline({
  data,
  width = 160,
  height = 36,
  stroke = '#8b1e24',
}: {
  data: number[];
  width?: number;
  height?: number;
  stroke?: string;
}): React.ReactElement {
  if (data.length === 0) data = [0];
  const max = Math.max(...data, 1);
  const stepX = data.length > 1 ? width / (data.length - 1) : width;
  const points = data.map((v, i) => {
    const x = i * stepX;
    const y = height - (v / max) * (height - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const fillPoints = [`0,${height}`, ...points, `${width},${height}`].join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="trend"
    >
      <polygon points={fillPoints} fill={stroke} opacity={0.08} />
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Buckets timestamped rows into a daily count series over the last N days. */
export function dailySeries(
  rows: Array<{ at: string; value?: number }>,
  days: number,
): number[] {
  const out = new Array<number>(days).fill(0);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (const r of rows) {
    const d = new Date(r.at);
    d.setUTCHours(0, 0, 0, 0);
    const idx = days - 1 - Math.round((today.getTime() - d.getTime()) / 86_400_000);
    if (idx >= 0 && idx < days) out[idx] = (out[idx] ?? 0) + (r.value ?? 1);
  }
  return out;
}
