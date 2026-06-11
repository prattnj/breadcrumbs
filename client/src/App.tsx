import { useState, useEffect } from "react";
import { fetchAnalysis } from "./api";
import { AnalysisResult, LocationEntry } from "./types";
import DateRangeSelector from "./DateRangeSelector";
import MapView from "./MapView";
import StatsPanel from "./StatsPanel";
import LayerToggle from "./LayerToggle";
import SubdivisionChart from "./SubdivisionChart";
import TimelineMode from "./TimelineMode";

export default function App() {
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [layers, setLayers] = useState({
    heatmap: true,
    extremes: false,
    average: false,
    averageOverTime: false,
  });
  const [satellite, setSatellite] = useState(() => {
    return localStorage.getItem("breadcrumbs-satellite") === "true";
  });
  const [dateRange, setDateRange] = useState<{ start?: string; end?: string }>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const [timelineActive, setTimelineActive] = useState(false);
  const [timelinePoints, setTimelinePoints] = useState<LocationEntry[]>([]);

  async function loadData(start?: string, end?: string) {
    setLoading(true);
    setError(null);
    setDateRange({ start, end });
    setRefreshKey((k) => k + 1);
    try {
      const result = await fetchAnalysis(start, end);
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-gray-800 border-b border-gray-700">
        <h1 className="text-3xl font-bold tracking-wide flex-1">
          Breadcrumbs
        </h1>
        {!timelineActive && (
          <DateRangeSelector onRangeChange={loadData} loading={loading} />
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-850 border-r border-gray-700 p-4 flex flex-col gap-4 overflow-y-auto bg-gray-800/50">
          <TimelineMode
            active={timelineActive}
            onToggle={() => setTimelineActive(!timelineActive)}
            onPointsLoaded={setTimelinePoints}
          />
          {!timelineActive && (
            <>
              <hr className="border-gray-700" />
              <LayerToggle layers={layers} onChange={setLayers} />
              <hr className="border-gray-700" />
              <StatsPanel data={data} />
              <hr className="border-gray-700" />
              <SubdivisionChart start={dateRange.start} end={dateRange.end} refreshKey={refreshKey} />
            </>
          )}
        </aside>

        {/* Map */}
        <main className="flex-1 relative">
          {loading && !timelineActive && (
            <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-gray-900/60">
              <div className="text-gray-300 text-lg animate-pulse">
                Loading...
              </div>
            </div>
          )}
          {error && !timelineActive && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] bg-red-900/90 text-red-200 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}
          <MapView
            data={data}
            layers={layers}
            satellite={satellite}
            onSatelliteToggle={() => {
              const next = !satellite;
              setSatellite(next);
              localStorage.setItem("breadcrumbs-satellite", String(next));
            }}
            timelineActive={timelineActive}
            timelinePoints={timelinePoints}
          />
        </main>
      </div>
    </div>
  );
}
