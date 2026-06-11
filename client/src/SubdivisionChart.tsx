import { useEffect, useState } from "react";

interface Subdivision {
  name: string;
  points: number;
  percentage: number;
}

interface SubdivisionChartProps {
  start?: string;
  end?: string;
  refreshKey: number;
}

const COLORS = [
  "#6366f1", "#ec4899", "#f59e0b", "#10b981", "#3b82f6",
  "#8b5cf6", "#ef4444", "#14b8a6", "#f97316", "#84cc16",
  "#06b6d4", "#e11d48", "#a855f7", "#22c55e", "#eab308",
];

export default function SubdivisionChart({ start, end, refreshKey }: SubdivisionChartProps) {
  const [data, setData] = useState<Subdivision[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (start) params.set("start", start);
        if (end) params.set("end", end);
        const res = await fetch(`/api/subdivisions?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          setData(json.subdivisions);
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [start, end, refreshKey]);

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg p-3">
        <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">
          Time by Region
        </h3>
        <p className="text-gray-500 text-xs animate-pulse">Loading...</p>
      </div>
    );
  }

  if (data.length === 0) return null;

  // Build SVG pie chart
  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const r = 55;

  let cumulative = 0;
  const slices = data.map((item, i) => {
    const startAngle = cumulative * 3.6 * (Math.PI / 180);
    cumulative += item.percentage;
    const endAngle = cumulative * 3.6 * (Math.PI / 180);

    const x1 = cx + r * Math.cos(startAngle - Math.PI / 2);
    const y1 = cy + r * Math.sin(startAngle - Math.PI / 2);
    const x2 = cx + r * Math.cos(endAngle - Math.PI / 2);
    const y2 = cy + r * Math.sin(endAngle - Math.PI / 2);

    const largeArc = item.percentage > 50 ? 1 : 0;

    const path =
      item.percentage >= 99.9
        ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r} Z`
        : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return {
      ...item,
      path,
      color: COLORS[i % COLORS.length]!,
    };
  });

  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">
        Time by Region
      </h3>

      <svg width={size} height={size} className="mx-auto">
        {slices.map((slice, i) => (
          <path key={i} d={slice.path} fill={slice.color} />
        ))}
      </svg>

      <div className="mt-2 flex flex-col gap-0.5 max-h-40 overflow-y-auto">
        {slices.map((slice, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: slice.color }}
            />
            <span className="text-gray-300 truncate flex-1">{slice.name}</span>
            <span className="text-gray-500">{slice.percentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
