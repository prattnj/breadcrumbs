import express from "express";
import cors from "cors";
import { join } from "path";
import mysql from "mysql2/promise";
import { analyze, getFilteredPoints } from "./analysis.js";

const app = express();
app.use(cors());
app.use(express.json());

// Serve built client in production
const clientDist = join(import.meta.dirname, "../../client/dist");
app.use(express.static(clientDist));

const pool = mysql.createPool({
  host: "localhost",
  database: "breadcrumbs",
  user: process.env.BREADCRUMBS_MYSQL_USER,
  password: process.env.BREADCRUMBS_MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: 5,
  timezone: "+00:00",
});

let subdivisionsCache: Map<string, string> | null = null;

async function loadSubdivisions(): Promise<Map<string, string>> {
  if (!subdivisionsCache) {
    const [rows] = await pool.query(
      "SELECT grid_lat, grid_lng, subdivision FROM grid_subdivisions"
    );
    const map = new Map<string, string>();
    for (const row of rows as Array<{
      grid_lat: number;
      grid_lng: number;
      subdivision: string;
    }>) {
      const key = `${Number(row.grid_lat)},${Number(row.grid_lng)}`;
      map.set(key, row.subdivision);
    }
    subdivisionsCache = map;
  }
  return subdivisionsCache;
}

function gridKey(lat: number, lng: number): string {
  const rLat = Math.round(lat * 100) / 100;
  const rLng = Math.round(lng * 100) / 100;
  return `${rLat},${rLng}`;
}

app.get("/api/analyze", async (req, res) => {
  try {
    const start = (req.query.startUtc as string) || (req.query.start as string) || undefined;
    const end = (req.query.endUtc as string) || (req.query.end as string) || undefined;
    const exactRange = !!(req.query.startUtc || req.query.endUtc);
    const result = await analyze(start, end, exactRange);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/subdivisions", async (req, res) => {
  try {
    const start = req.query.start as string | undefined;
    const end = req.query.end as string | undefined;
    const points = await getFilteredPoints(start, end);

    if (points.length === 0) {
      res.json({ subdivisions: [] });
      return;
    }

    const subMap = await loadSubdivisions();

    // Count points per subdivision
    const counts = new Map<string, number>();
    for (const p of points) {
      const key = gridKey(p.latitude, p.longitude);
      const name = subMap.get(key) || "Unknown";
      counts.set(name, (counts.get(name) || 0) + 1);
    }

    // Sort by count descending
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const total = points.length;

    // Group <2% into "Other"
    const threshold = total * 0.02;
    const subdivisions: { name: string; points: number; percentage: number }[] = [];
    let otherCount = 0;

    for (const [name, count] of sorted) {
      if (count >= threshold) {
        subdivisions.push({
          name,
          points: count,
          percentage: Math.round((count / total) * 1000) / 10,
        });
      } else {
        otherCount += count;
      }
    }

    if (otherCount > 0) {
      subdivisions.push({
        name: "Other",
        points: otherCount,
        percentage: Math.round((otherCount / total) * 1000) / 10,
      });
    }

    res.json({ subdivisions });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/average-over-time", async (_req, res) => {
  try {
    const points = await getFilteredPoints();

    if (points.length === 0) {
      res.json({ points: [] });
      return;
    }

    // Find the year range
    const firstYear = new Date(points[0]!.timestamp).getUTCFullYear();
    const lastYear = new Date(points[points.length - 1]!.timestamp).getUTCFullYear();

    // Compute cumulative average for each year
    const result: { year: number; latitude: number; longitude: number }[] = [];
    let totalLat = 0;
    let totalLng = 0;
    let count = 0;
    let pointIdx = 0;

    for (let year = firstYear; year <= lastYear; year++) {
      const cutoff = new Date(Date.UTC(year + 1, 0, 1)); // start of next year
      while (pointIdx < points.length && new Date(points[pointIdx]!.timestamp) < cutoff) {
        totalLat += points[pointIdx]!.latitude;
        totalLng += points[pointIdx]!.longitude;
        count++;
        pointIdx++;
      }
      if (count > 0) {
        result.push({
          year,
          latitude: totalLat / count,
          longitude: totalLng / count,
        });
      }
    }

    res.json({ points: result });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Fallback to index.html for client-side routing
app.get("*", (_req, res) => {
  res.sendFile(join(clientDist, "index.html"));
});

app.listen(3013, () => {
  console.log("Breadcrumbs server listening on http://localhost:3013");
});
