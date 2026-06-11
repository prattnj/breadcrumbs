import L from "leaflet";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { LocationEntry } from "./types";

// We need to declare the heat layer type since leaflet.heat doesn't ship types
declare module "leaflet" {
  function heatLayer(
    latlngs: [number, number, number?][],
    options?: Record<string, unknown>
  ): L.Layer;
}

interface HeatmapLayerProps {
  points: LocationEntry[];
  visible: boolean;
}

export default function HeatmapLayer({ points, visible }: HeatmapLayerProps) {
  const map = useMap();

  useEffect(() => {
    if (!visible || points.length === 0) return;

    const heat = L.heatLayer(
      points.map((p) => [p.latitude, p.longitude, 0.7]),
      {
        radius: 18,
        blur: 15,
        maxZoom: 17,
        minOpacity: 0.2,
        gradient: {
          0.1: "#3b82f6",
          0.3: "#7c3aed",
          0.5: "#dc2626",
          0.7: "#f59e0b",
          1.0: "#ffffff",
        },
      }
    );

    heat.addTo(map);
    return () => {
      map.removeLayer(heat);
    };
  }, [map, points, visible]);

  return null;
}
