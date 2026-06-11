import { AnalysisResult } from "./types";

interface StatsPanelProps {
  data: AnalysisResult | null;
}

export default function StatsPanel({ data }: StatsPanelProps) {
  if (!data) return null;

  const startDate = new Date(data.dateRange.start).toLocaleDateString();
  const endDate = new Date(data.dateRange.end).toLocaleDateString();

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="bg-gray-800 rounded-lg p-3">
        <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-1">
          Date Range
        </h3>
        <p className="text-gray-200">
          {startDate} &mdash; {endDate}
        </p>
      </div>

      <div className="bg-gray-800 rounded-lg p-3">
        <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-1">
          Data Points
        </h3>
        <p className="text-2xl font-bold text-gray-100">
          {data.totalPoints.toLocaleString()}
        </p>
      </div>

      <div className="bg-gray-800 rounded-lg p-3">
        <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-1">
          Total Distance Traveled
        </h3>
        <p className="text-2xl font-bold text-gray-100">
          {Math.round(data.totalDistanceKm * 0.621371).toLocaleString()} mi
        </p>
        <p className="text-gray-400 text-xs mt-0.5">
          {data.totalDistanceKm.toLocaleString()} km
        </p>
      </div>
    </div>
  );
}
