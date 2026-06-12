/**
 * Lightweight Zambia map — a simplified country outline with branch dots,
 * rendered as pure SVG (no map library, no tiles, no API keys). City
 * positions are approximate plotting coordinates within the viewBox, keyed
 * by branch code so new branches in known cities light up automatically.
 */
const CITY_POS: Record<string, { x: number; y: number; city: string }> = {
  LS: { x: 305, y: 270, city: 'Lusaka' },
  KT: { x: 265, y: 165, city: 'Kitwe' },
  ND: { x: 285, y: 175, city: 'Ndola' },
  LV: { x: 215, y: 345, city: 'Livingstone' },
  CH: { x: 250, y: 150, city: 'Chingola' },
  KB: { x: 290, y: 235, city: 'Kabwe' },
  CP: { x: 360, y: 220, city: 'Chipata' },
  SL: { x: 120, y: 240, city: 'Solwezi' },
  MN: { x: 330, y: 90, city: 'Mansa' },
  KS: { x: 360, y: 130, city: 'Kasama' },
  MG: { x: 150, y: 290, city: 'Mongu' },
};

export function ZambiaMap({
  branches,
}: {
  branches: Array<{ branch_code: string; name: string }>;
}): React.ReactElement {
  return (
    <svg viewBox="0 0 460 400" role="img" aria-label="Richmond branch network across Zambia" className="w-full max-w-xl">
      {/* Simplified Zambia outline */}
      <path
        d="M 120 60 L 200 50 L 240 70 L 300 55 L 345 65 L 390 60
           L 405 110 L 395 160 L 420 200 L 405 250 L 370 260
           L 360 300 L 310 320 L 270 360 L 215 365 L 175 340
           L 130 330 L 95 300 L 75 255 L 90 210 L 70 170
           L 95 120 L 110 90 Z"
        fill="#f3f1ed"
        stroke="#8b1e24"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {branches.map((b) => {
        const pos = CITY_POS[b.branch_code.toUpperCase()];
        if (!pos) return null;
        return (
          <g key={b.branch_code}>
            <circle cx={pos.x} cy={pos.y} r={10} fill="#8b1e24" opacity={0.15} />
            <circle cx={pos.x} cy={pos.y} r={4.5} fill="#8b1e24" />
            <text
              x={pos.x + 12}
              y={pos.y + 4}
              fontSize="13"
              fill="#1f2933"
              fontFamily="Inter, system-ui, sans-serif"
            >
              {b.name} ({b.branch_code})
            </text>
          </g>
        );
      })}
    </svg>
  );
}
