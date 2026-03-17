import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseGpx } from "../backend/src/services/gpx-import.service";

describe("parseGpx", () => {
  it("parses AL.gpx with bounds and trackpoints", async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.join(here, "..", "..", "gpx_files", "AL.gpx");
    const xml = await readFile(filePath, "utf8");
    const parsed = parseGpx(xml);

    expect(parsed.waypoints.length).toBeGreaterThan(0);
    expect(parsed.bounds.minLat).toBeCloseTo(39.651479590684175, 6);
    expect(parsed.bounds.minLon).toBeCloseTo(19.41835700534284, 6);
    expect(parsed.bounds.maxLat).toBeCloseTo(42.406892040744424, 6);
    expect(parsed.bounds.maxLon).toBeCloseTo(20.50760803744197, 6);
    expect(parsed.distanceKm).toBeGreaterThan(0);
    expect(parsed.startedAt).toBeInstanceOf(Date);
    expect(parsed.endedAt).toBeInstanceOf(Date);
    expect(parsed.totalTimeSec).toBeTypeOf("number");
  });
});

