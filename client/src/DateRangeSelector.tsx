import { useState } from "react";

interface DateRangeSelectorProps {
  onRangeChange: (start?: string, end?: string) => void;
  loading: boolean;
}

const PRESETS: { label: string; getRange: () => [string?, string?] }[] = [
  { label: "All Time", getRange: () => [undefined, undefined] },
  {
    label: "This Year",
    getRange: () => {
      const year = new Date().getFullYear();
      return [`${year}-01-01`, `${year}-12-31`];
    },
  },
  {
    label: "Last Year",
    getRange: () => {
      const year = new Date().getFullYear() - 1;
      return [`${year}-01-01`, `${year}-12-31`];
    },
  },
  {
    label: "Last 30 Days",
    getRange: () => {
      const end = new Date();
      const start = new Date(end.getTime() - 30 * 86400000);
      return [
        start.toISOString().slice(0, 10),
        end.toISOString().slice(0, 10),
      ];
    },
  },
];

export default function DateRangeSelector({
  onRangeChange,
  loading,
}: DateRangeSelectorProps) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [activePreset, setActivePreset] = useState<string>("All Time");

  function handlePreset(label: string, getRange: () => [string?, string?]) {
    setActivePreset(label);
    const [s, e] = getRange();
    setStart(s ?? "");
    setEnd(e ?? "");
    onRangeChange(s, e);
  }

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    setActivePreset("");
    onRangeChange(start || undefined, end || undefined);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => handlePreset(p.label, p.getRange)}
            disabled={loading}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              activePreset === p.label
                ? "bg-indigo-600 text-white"
                : "bg-gray-700 text-gray-300 hover:bg-gray-600"
            } disabled:opacity-50`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleCustomSubmit} className="flex items-center gap-2">
        <input
          type="date"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
        />
        <span className="text-gray-400">to</span>
        <input
          type="date"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm rounded font-medium disabled:opacity-50"
        >
          Go
        </button>
      </form>
    </div>
  );
}
