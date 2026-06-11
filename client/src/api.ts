import { AnalysisResult } from "./types";

export async function fetchAnalysis(
  start?: string,
  end?: string
): Promise<AnalysisResult> {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);

  const res = await fetch(`/api/analyze?${params.toString()}`);
  if (!res.ok) {
    const body = await res.json();
    throw new Error(body.error || "Request failed");
  }
  return res.json();
}
