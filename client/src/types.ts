export interface LocationEntry {
  timestamp: string;
  latitude: number;
  longitude: number;
}

export interface Extremes {
  north: LocationEntry;
  south: LocationEntry;
  east: LocationEntry;
  west: LocationEntry;
}

export interface AnalysisResult {
  points: LocationEntry[];
  extremes: Extremes;
  average: { latitude: number; longitude: number };
  totalPoints: number;
  totalDistanceKm: number;
  dateRange: { start: string; end: string };
}
