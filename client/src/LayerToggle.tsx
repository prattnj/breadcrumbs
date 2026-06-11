interface LayerToggleProps {
  layers: { heatmap: boolean; extremes: boolean; average: boolean; averageOverTime: boolean };
  onChange: (layers: { heatmap: boolean; extremes: boolean; average: boolean; averageOverTime: boolean }) => void;
}

const LAYER_CONFIG = [
  { key: "heatmap" as const, label: "Heatmap", color: "bg-purple-500" },
  { key: "extremes" as const, label: "Extremes (N/S/E/W)", color: "bg-red-500" },
  { key: "average" as const, label: "Average Location", color: "bg-violet-500" },
  { key: "averageOverTime" as const, label: "Average Over Time", color: "bg-cyan-500" },
];

export default function LayerToggle({ layers, onChange }: LayerToggleProps) {
  function toggle(key: keyof typeof layers) {
    onChange({ ...layers, [key]: !layers[key] });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-gray-400 text-xs uppercase tracking-wide">
        Map Layers
      </h3>
      {LAYER_CONFIG.map(({ key, label, color }) => (
        <label
          key={key}
          className="flex items-center gap-2 cursor-pointer text-sm text-gray-300 hover:text-gray-100"
        >
          <input
            type="checkbox"
            checked={layers[key]}
            onChange={() => toggle(key)}
            className="sr-only"
          />
          <span
            className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
              layers[key]
                ? `${color} border-transparent`
                : "border-gray-500 bg-gray-700"
            }`}
          >
            {layers[key] && (
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </span>
          {label}
        </label>
      ))}
    </div>
  );
}
