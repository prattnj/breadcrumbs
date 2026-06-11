import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import { LocationEntry } from "./types";

interface TimelineLayerProps {
  points: LocationEntry[];
  visible: boolean;
}

/** Threshold in degrees (~50m) for grouping consecutive points as "same place" */
const CLUSTER_THRESHOLD = 0.0005;

interface ClusteredPoint {
  latitude: number;
  longitude: number;
  startTime: string;
  endTime: string;
  count: number;
}

function clusterConsecutivePoints(points: LocationEntry[]): ClusteredPoint[] {
  if (points.length === 0) return [];

  const clusters: ClusteredPoint[] = [];
  let clusterStart = points[0]!;
  let clusterEnd = points[0]!;
  let sumLat = clusterStart.latitude;
  let sumLng = clusterStart.longitude;
  let count = 1;

  for (let i = 1; i < points.length; i++) {
    const p = points[i]!;
    const avgLat = sumLat / count;
    const avgLng = sumLng / count;

    if (
      Math.abs(p.latitude - avgLat) <= CLUSTER_THRESHOLD &&
      Math.abs(p.longitude - avgLng) <= CLUSTER_THRESHOLD
    ) {
      // Same place — extend the cluster
      clusterEnd = p;
      sumLat += p.latitude;
      sumLng += p.longitude;
      count++;
    } else {
      // New place — flush previous cluster
      clusters.push({
        latitude: sumLat / count,
        longitude: sumLng / count,
        startTime: clusterStart.timestamp,
        endTime: clusterEnd.timestamp,
        count,
      });
      clusterStart = p;
      clusterEnd = p;
      sumLat = p.latitude;
      sumLng = p.longitude;
      count = 1;
    }
  }

  // Flush last cluster
  clusters.push({
    latitude: sumLat / count,
    longitude: sumLng / count,
    startTime: clusterStart.timestamp,
    endTime: clusterEnd.timestamp,
    count,
  });

  return clusters;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** Interpolate color from green → blue → purple based on t (0–1) */
function interpolateColor(t: number): string {
  // Green (120°) → Blue (240°) → Purple (280°)
  const hue = 120 + t * 160;
  return `hsl(${hue}, 75%, 55%)`;
}

export default function TimelineLayer({ points, visible }: TimelineLayerProps) {
  const map = useMap();
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!layerRef.current) {
      layerRef.current = L.layerGroup().addTo(map);
    }

    const layer = layerRef.current;
    layer.clearLayers();

    if (!visible || points.length === 0) return;

    const clusters = clusterConsecutivePoints(points);

    // Draw gradient segments between cluster centers
    const latLngs = clusters.map(
      (c) => [c.latitude, c.longitude] as [number, number]
    );

    for (let i = 0; i < latLngs.length - 1; i++) {
      const t = latLngs.length > 2 ? i / (latLngs.length - 2) : 0;
      const color = interpolateColor(t);
      const segment = L.polyline([latLngs[i]!, latLngs[i + 1]!], {
        color,
        weight: 3,
        opacity: 0.85,
      });
      layer.addLayer(segment);
    }

    // Add markers for each cluster
    clusters.forEach((c, i) => {
      const isFirst = i === 0;
      const isLast = i === clusters.length - 1;

      let fillColor = "#a5b4fc";
      let radius = 5;
      let borderColor = "#4f46e5";
      let weight = 1;

      if (isFirst) {
        fillColor = "#22c55e";
        radius = 7;
        borderColor = "#fff";
        weight = 2;
      } else if (isLast) {
        fillColor = "#ef4444";
        radius = 7;
        borderColor = "#fff";
        weight = 2;
      }

      const marker = L.circleMarker([c.latitude, c.longitude], {
        radius,
        fillColor,
        color: borderColor,
        weight,
        fillOpacity: 1,
      });

      // Build popup content
      let label = "";
      if (isFirst) label = "<strong>Start</strong><br/>";
      else if (isLast) label = "<strong>End</strong><br/>";

      if (c.startTime === c.endTime || c.count === 1) {
        marker.bindPopup(`${label}${formatTime(c.startTime)}`);
      } else {
        marker.bindPopup(
          `${label}${formatTime(c.startTime)} – ${formatTime(c.endTime)}`
        );
      }

      layer.addLayer(marker);
    });

    // Fit map to bounds
    if (latLngs.length > 1) {
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      map.setView(latLngs[0]!, 14);
    }

    return () => {
      layer.clearLayers();
    };
  }, [points, visible, map]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (layerRef.current) {
        layerRef.current.clearLayers();
        layerRef.current.remove();
      }
    };
  }, []);

  return null;
}
