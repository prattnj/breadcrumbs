import { useEffect, useState } from "react";
import { CircleMarker, Polyline, Tooltip } from "react-leaflet";

interface YearPoint {
  year: number;
  latitude: number;
  longitude: number;
}

interface AverageOverTimeLayerProps {
  visible: boolean;
  onCopyCoords: (lat: number, lng: number) => void;
}

export default function AverageOverTimeLayer({ visible, onCopyCoords }: AverageOverTimeLayerProps) {
  const [points, setPoints] = useState<YearPoint[]>([]);

  useEffect(() => {
    if (!visible) return;

    fetch("/api/average-over-time")
      .then((res) => res.json())
      .then((data) => setPoints(data.points))
      .catch(() => {});
  }, [visible]);

  if (!visible || points.length === 0) return null;

  const positions: [number, number][] = points.map((p) => [p.latitude, p.longitude]);

  return (
    <>
      <Polyline
        positions={positions}
        pathOptions={{ color: "#06b6d4", weight: 3, opacity: 0.8, dashArray: "6 4" }}
      />
      {points.map((p) => (
        <CircleMarker
          key={p.year}
          center={[p.latitude, p.longitude]}
          radius={6}
          pathOptions={{ color: "white", weight: 2, fillColor: "#06b6d4", fillOpacity: 1 }}
          eventHandlers={{ click: () => onCopyCoords(p.latitude, p.longitude) }}
        >
          <Tooltip direction="top" offset={[0, -6]}>
            <strong>{p.year}</strong>
            <br />
            {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)}
          </Tooltip>
        </CircleMarker>
      ))}
    </>
  );
}
