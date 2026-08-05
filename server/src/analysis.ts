import mysql from "mysql2/promise";
import { LocationEntry, Extremes, AnalysisResult } from "./types.js";

const pool = mysql.createPool({
  host: process.env.BREADCRUMBS_MYSQL_HOST || "localhost",
  database: "breadcrumbs",
  user: process.env.BREADCRUMBS_MYSQL_USER,
  password: process.env.BREADCRUMBS_MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  timezone: "+00:00",
});

/**
 * Query all location events from the database, sorted chronologically.
 *
 * @param exactRange - When true, start/end are exact UTC boundaries (no +1 day adjustment on end)
 */
async function loadPoints(
  start?: string,
  end?: string,
  exactRange = false
): Promise<LocationEntry[]> {
  const params: any[] = [];
  let dateFilter = "";

  if (start || end) {
    const conditions: string[] = [];
    if (start) {
      conditions.push("ss.start_time >= ?");
      params.push(start);
    }
    if (end) {
      if (exactRange) {
        conditions.push("ss.end_time < ?");
        params.push(end);
      } else {
        const endDate = new Date(new Date(end).getTime() + 86400000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " ");
        conditions.push("ss.end_time < ?");
        params.push(endDate);
      }
    }
    dateFilter = " AND " + conditions.join(" AND ");
  }

  const sql = `
    (
      SELECT stp.recorded_at AS event_time, stp.lat, stp.lng
      FROM segment_timeline_paths stp
      JOIN semantic_segments ss ON ss.id = stp.segment_id
      WHERE 1=1 ${dateFilter}
    )
    UNION ALL
    (
      SELECT ss.start_time AS event_time, p.lat, p.lng
      FROM semantic_segments ss
      JOIN segment_visits sv ON sv.segment_id = ss.id
      JOIN places p ON p.id = sv.place_id
      WHERE p.lat IS NOT NULL ${dateFilter}
    )
    UNION ALL
    (
      SELECT ss.end_time AS event_time, p.lat, p.lng
      FROM semantic_segments ss
      JOIN segment_visits sv ON sv.segment_id = ss.id
      JOIN places p ON p.id = sv.place_id
      WHERE p.lat IS NOT NULL ${dateFilter}
    )
    UNION ALL
    (
      SELECT ss.start_time AS event_time, sa.start_lat AS lat, sa.start_lng AS lng
      FROM semantic_segments ss
      JOIN segment_activities sa ON sa.segment_id = ss.id
      WHERE 1=1 ${dateFilter}
    )
    UNION ALL
    (
      SELECT ss.end_time AS event_time, sa.end_lat AS lat, sa.end_lng AS lng
      FROM semantic_segments ss
      JOIN segment_activities sa ON sa.segment_id = ss.id
      WHERE 1=1 ${dateFilter}
    )
    ORDER BY event_time
  `;

  const allParams = [
    ...params, // timeline paths
    ...params, // visits start
    ...params, // visits end
    ...params, // activities start
    ...params, // activities end
  ];

  const [rows] = await pool.query(sql, allParams);
  const events = rows as Array<{ event_time: Date; lat: number; lng: number }>;

  return events.map((e) => ({
    timestamp: new Date(e.event_time).toISOString(),
    latitude: Number(e.lat),
    longitude: Number(e.lng),
  }));
}

// Cache for full dataset (no date filter)
let cachedPoints: LocationEntry[] | null = null;

async function getPoints(start?: string, end?: string, exactRange = false): Promise<LocationEntry[]> {
  if (!start && !end) {
    if (!cachedPoints) {
      cachedPoints = await loadPoints();
    }
    return cachedPoints;
  }
  return loadPoints(start, end, exactRange);
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeExtremes(data: LocationEntry[]): Extremes {
  let north = data[0];
  let south = data[0];
  let east = data[0];
  let west = data[0];

  for (const entry of data) {
    if (entry.latitude > north.latitude) north = entry;
    if (entry.latitude < south.latitude) south = entry;
    if (entry.longitude > east.longitude) east = entry;
    if (entry.longitude < west.longitude) west = entry;
  }

  return { north, south, east, west };
}

function computeAverage(data: LocationEntry[]): {
  latitude: number;
  longitude: number;
} {
  const totalLat = data.reduce((sum, e) => sum + e.latitude, 0);
  const totalLng = data.reduce((sum, e) => sum + e.longitude, 0);
  return {
    latitude: totalLat / data.length,
    longitude: totalLng / data.length,
  };
}

function computeTotalDistance(data: LocationEntry[]): number {
  let total = 0;
  for (let i = 1; i < data.length; i++) {
    total += haversineKm(
      data[i - 1].latitude,
      data[i - 1].longitude,
      data[i].latitude,
      data[i].longitude
    );
  }
  return Math.round(total * 100) / 100;
}

export async function getFilteredPoints(
  start?: string,
  end?: string,
  exactRange = false
): Promise<LocationEntry[]> {
  return getPoints(start, end, exactRange);
}

export async function analyze(
  start?: string,
  end?: string,
  exactRange = false
): Promise<AnalysisResult> {
  const data = await getPoints(start, end, exactRange);

  if (data.length === 0) {
    throw new Error("No data found for the given date range");
  }

  return {
    points: data,
    extremes: computeExtremes(data),
    average: computeAverage(data),
    totalPoints: data.length,
    totalDistanceKm: computeTotalDistance(data),
    dateRange: {
      start: data[0].timestamp,
      end: data[data.length - 1].timestamp,
    },
  };
}
