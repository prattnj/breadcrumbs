import { useState, useEffect } from "react";
import { LocationEntry } from "./types";

interface TimelineModeProps {
  active: boolean;
  onToggle: () => void;
  onPointsLoaded: (points: LocationEntry[]) => void;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseLocalDate(dateStr: string): Date {
  const parts = dateStr.split("-").map(Number);
  return new Date(parts[0]!, parts[1]! - 1, parts[2]!);
}

export default function TimelineMode({ active, onToggle, onPointsLoaded }: TimelineModeProps) {
  const [date, setDate] = useState(() => formatDate(new Date()));
  const [loading, setLoading] = useState(false);
  const [pointCount, setPointCount] = useState(0);

  function shiftDate(days: number) {
    const d = parseLocalDate(date);
    d.setDate(d.getDate() + days);
    setDate(formatDate(d));
  }

  useEffect(() => {
    if (!active) {
      onPointsLoaded([]);
      return;
    }

    async function fetchDay() {
      setLoading(true);
      try {
        // Convert local day boundaries to UTC for the server query
        const localStart = parseLocalDate(date);
        const localEnd = new Date(localStart);
        localEnd.setDate(localEnd.getDate() + 1);

        const params = new URLSearchParams({
          startUtc: localStart.toISOString(),
          endUtc: localEnd.toISOString(),
        });
        const res = await fetch(`/api/analyze?${params.toString()}`);
        if (res.ok) {
          const json = await res.json();
          onPointsLoaded(json.points);
          setPointCount(json.points.length);
        } else {
          onPointsLoaded([]);
          setPointCount(0);
        }
      } catch {
        onPointsLoaded([]);
        setPointCount(0);
      } finally {
        setLoading(false);
      }
    }

    fetchDay();
  }, [active, date]);

  const displayDate = parseLocalDate(date);
  const dayLabel = displayDate.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-gray-400 text-xs uppercase tracking-wide">
          Timeline Mode
        </h3>
        <button
          onClick={onToggle}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            active ? "bg-indigo-600" : "bg-gray-600"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              active ? "translate-x-4" : ""
            }`}
          />
        </button>
      </div>

      {active && (
        <div className="flex flex-col gap-2">
          {/* Date navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => shiftDate(-1)}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm font-bold"
              title="Previous day"
            >
              ←
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200 min-w-0"
            />
            <button
              onClick={() => shiftDate(1)}
              className="px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded text-sm font-bold"
              title="Next day"
            >
              →
            </button>
          </div>

          {/* Day label */}
          <p className="text-gray-300 text-xs text-center">{dayLabel}</p>

          {/* Status */}
          {loading ? (
            <p className="text-gray-500 text-xs animate-pulse">Loading...</p>
          ) : (
            <p className="text-gray-400 text-xs">
              {pointCount === 0
                ? "No data for this day"
                : `${pointCount.toLocaleString()} points`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
