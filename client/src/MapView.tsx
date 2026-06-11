import "leaflet/dist/leaflet.css";
import L from "leaflet";
(window as any).L = L;
import "leaflet.heat";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import { useEffect, useState, useCallback } from "react";
import { AnalysisResult, LocationEntry } from "./types";
import HeatmapLayer from "./HeatmapLayer";
import AverageOverTimeLayer from "./AverageOverTimeLayer";
import TimelineLayer from "./TimelineLayer";

// Fix default marker icon path issue with bundlers
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

function createColoredIcon(color: string) {
  return L.divIcon({
    className: "",
    html: `<div style="
      width: 14px; height: 14px;
      background: ${color};
      border: 2px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const ICONS = {
  north: createColoredIcon("#ef4444"),
  south: createColoredIcon("#3b82f6"),
  east: createColoredIcon("#f59e0b"),
  west: createColoredIcon("#10b981"),
  average: createColoredIcon("#a855f7"),
};

interface FitBoundsProps {
  data: AnalysisResult | null;
}

function FitBounds({ data }: FitBoundsProps) {
  const map = useMap();

  useEffect(() => {
    if (!data || data.points.length === 0) return;
    const bounds = L.latLngBounds(
      data.points.map((p) => [p.latitude, p.longitude])
    );
    map.fitBounds(bounds, { padding: [30, 30] });
  }, [data, map]);

  return null;
}

interface MapViewProps {
  data: AnalysisResult | null;
  layers: {
    heatmap: boolean;
    extremes: boolean;
    average: boolean;
    averageOverTime: boolean;
  };
  satellite: boolean;
  onSatelliteToggle: () => void;
  timelineActive: boolean;
  timelinePoints: LocationEntry[];
}

function CopyToast({ message, visible }: { message: string | null; visible: boolean }) {
  if (!message) return null;
  return (
    <div className="absolute bottom-4 left-0 right-0 z-[1100] flex justify-center pointer-events-none">
      <div className={`bg-gray-900 text-white text-sm px-3 py-1.5 rounded-md shadow-lg ${visible ? 'toast-enter' : 'toast-exit'}`}>
        {message}
      </div>
    </div>
  );
}

export default function MapView({ data, layers, satellite, onSatelliteToggle, timelineActive, timelinePoints }: MapViewProps) {
  const [toast, setToast] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const copyCoords = useCallback((lat: number, lng: number) => {
    const text = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    navigator.clipboard.writeText(text).then(() => {
      setToast(`Copied ${text}`);
      setToastVisible(true);
      setTimeout(() => setToastVisible(false), 1200);
      setTimeout(() => setToast(null), 1500);
    });
  }, []);

  return (
    <div className="w-full h-full relative">
      {/* Satellite toggle overlaid on map */}
      <div className="absolute top-2.5 left-14 z-[1000] bg-white rounded-md shadow-md px-2.5 py-1.5 flex items-center gap-2">
        <span className="text-xs font-medium text-gray-700">Satellite</span>
        <button
          onClick={onSatelliteToggle}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            satellite ? "bg-indigo-600" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              satellite ? "translate-x-4" : ""
            }`}
          />
        </button>
      </div>

      <MapContainer
        center={[39.8283, -98.5795]}
        zoom={4}
        className="w-full h-full rounded-lg"
      >
        {satellite ? (
        <>
          <TileLayer
            attribution="Tiles &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
          <TileLayer
            attribution="Labels &copy; Esri"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            pane="overlayPane"
          />
        </>
      ) : (
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
      )}

      <FitBounds data={timelineActive ? null : data} />

      {/* Timeline mode layer */}
      <TimelineLayer points={timelinePoints} visible={timelineActive} />

      {/* Normal layers - hidden when timeline is active */}
      {!timelineActive && data && (
        <HeatmapLayer points={data.points} visible={layers.heatmap} />
      )}

      {!timelineActive && data && layers.extremes && (
        <>
          <Marker
            position={[
              data.extremes.north.latitude,
              data.extremes.north.longitude,
            ]}
            icon={ICONS.north}
            eventHandlers={{ click: () => copyCoords(data.extremes.north.latitude, data.extremes.north.longitude) }}
          >
            <Popup>
              <strong>Furthest North</strong>
              <br />
              {data.extremes.north.latitude.toFixed(4)},{" "}
              {data.extremes.north.longitude.toFixed(4)}
              <br />
              <em>{new Date(data.extremes.north.timestamp).toLocaleDateString()}</em>
            </Popup>
          </Marker>
          <Marker
            position={[
              data.extremes.south.latitude,
              data.extremes.south.longitude,
            ]}
            icon={ICONS.south}
            eventHandlers={{ click: () => copyCoords(data.extremes.south.latitude, data.extremes.south.longitude) }}
          >
            <Popup>
              <strong>Furthest South</strong>
              <br />
              {data.extremes.south.latitude.toFixed(4)},{" "}
              {data.extremes.south.longitude.toFixed(4)}
              <br />
              <em>{new Date(data.extremes.south.timestamp).toLocaleDateString()}</em>
            </Popup>
          </Marker>
          <Marker
            position={[
              data.extremes.east.latitude,
              data.extremes.east.longitude,
            ]}
            icon={ICONS.east}
            eventHandlers={{ click: () => copyCoords(data.extremes.east.latitude, data.extremes.east.longitude) }}
          >
            <Popup>
              <strong>Furthest East</strong>
              <br />
              {data.extremes.east.latitude.toFixed(4)},{" "}
              {data.extremes.east.longitude.toFixed(4)}
              <br />
              <em>{new Date(data.extremes.east.timestamp).toLocaleDateString()}</em>
            </Popup>
          </Marker>
          <Marker
            position={[
              data.extremes.west.latitude,
              data.extremes.west.longitude,
            ]}
            icon={ICONS.west}
            eventHandlers={{ click: () => copyCoords(data.extremes.west.latitude, data.extremes.west.longitude) }}
          >
            <Popup>
              <strong>Furthest West</strong>
              <br />
              {data.extremes.west.latitude.toFixed(4)},{" "}
              {data.extremes.west.longitude.toFixed(4)}
              <br />
              <em>{new Date(data.extremes.west.timestamp).toLocaleDateString()}</em>
            </Popup>
          </Marker>
        </>
      )}

      {!timelineActive && data && layers.average && (
        <Marker
          position={[data.average.latitude, data.average.longitude]}
          icon={ICONS.average}
          eventHandlers={{ click: () => copyCoords(data.average.latitude, data.average.longitude) }}
        >
          <Popup>
            <strong>Average Location</strong>
            <br />
            {data.average.latitude.toFixed(4)},{" "}
            {data.average.longitude.toFixed(4)}
          </Popup>
        </Marker>
      )}

      <AverageOverTimeLayer visible={!timelineActive && layers.averageOverTime} onCopyCoords={copyCoords} />
    </MapContainer>
      <CopyToast message={toast} visible={toastVisible} />
    </div>
  );
}
