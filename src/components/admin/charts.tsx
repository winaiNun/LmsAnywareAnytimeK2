/* Dependency-free SVG charts (server-renderable). */

export function BarChart({ data, color = "#0052FF" }: { data: { label: string; value: number }[]; color?: string }) {
  const W = 420, H = 200, padB = 28, padT = 22;
  const max = Math.max(...data.map((d) => d.value), 1);
  const slot = W / data.length;
  const bw = Math.min(44, slot * 0.55);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`กราฟแท่ง: ${data.map((d) => `${d.label} ${d.value}`).join(", ")}`} className="h-auto w-full">
      {[0.25, 0.5, 0.75, 1].map((t) => (
        <line key={t} x1="0" x2={W} y1={padT + (H - padT - padB) * (1 - t)} y2={padT + (H - padT - padB) * (1 - t)} stroke="#E4E7EB" strokeDasharray="3 4" />
      ))}
      {data.map((d, i) => {
        const h = ((H - padT - padB) * d.value) / max;
        const x = i * slot + (slot - bw) / 2;
        const y = H - padB - h;
        return (
          <g key={d.label}>
            <rect x={x} y={y} width={bw} height={Math.max(h, 2)} rx="6" fill={color} opacity={i === data.length - 1 ? 1 : 0.55} />
            <text x={x + bw / 2} y={y - 6} textAnchor="middle" fontSize="12" fontWeight="600" fill="#1E1E1E">{d.value}</text>
            <text x={x + bw / 2} y={H - 8} textAnchor="middle" fontSize="12" fill="#6B7280">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function Donut({
  segments,
  centerValue,
  centerLabel,
}: {
  segments: { label: string; value: number; color: string }[];
  centerValue: string;
  centerLabel: string;
}) {
  const R = 62, C = 2 * Math.PI * R;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;

  return (
    <div className="flex flex-wrap items-center justify-center gap-6">
      <svg viewBox="0 0 160 160" role="img" aria-label={`กราฟวงกลม: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`} className="h-44 w-44">
        <circle cx="80" cy="80" r={R} fill="none" stroke="#EEF1F4" strokeWidth="18" />
        {segments.map((s) => {
          const len = (s.value / total) * C;
          const el = (
            <circle key={s.label} cx="80" cy="80" r={R} fill="none" stroke={s.color} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} transform="rotate(-90 80 80)" />
          );
          offset += len;
          return el;
        })}
        <text x="80" y="82" textAnchor="middle" fontSize="28" fontWeight="700" fill="#1E1E1E">{centerValue}</text>
        <text x="80" y="102" textAnchor="middle" fontSize="11" fill="#6B7280">{centerLabel}</text>
      </svg>
      <ul className="space-y-2 text-sm">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-neutral-600">{s.label}</span>
            <span className="ml-auto pl-4 font-semibold">{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Sparkline({ values, color = "#0052FF" }: { values: number[]; color?: string }) {
  const W = 120, H = 36;
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pts = values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * W},${H - 3 - ((v - min) / (max - min || 1)) * (H - 8)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} aria-hidden className="h-9 w-full">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
