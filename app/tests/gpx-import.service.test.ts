import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseGpx } from "../backend/src/services/gpx-import.service";

describe("parseGpx", () => {
  it("parses PR2 CDV (Wikiloc) GPX with bounds and trackpoints", async () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const filePath = path.join(
      here,
      "..",
      "..",
      "gpx_files",
      "pr2-cdv-trilho-do-carreiro-dos-ss-serra-montejunto.gpx",
    );
    const xml = await readFile(filePath, "utf8");
    const parsed = parseGpx(xml);

    expect(parsed.waypoints.length).toBeGreaterThan(0);
    expect(parsed.bounds.minLat).toBeGreaterThan(39);
    expect(parsed.bounds.maxLat).toBeLessThan(40);
    expect(parsed.bounds.minLon).toBeGreaterThan(-10);
    expect(parsed.bounds.maxLon).toBeLessThan(-8);
    expect(parsed.bounds.minLat).toBeLessThan(parsed.bounds.maxLat);
    expect(parsed.bounds.minLon).toBeLessThan(parsed.bounds.maxLon);
    expect(parsed.distanceKm).toBeGreaterThan(0);
    expect(parsed.startedAt).toBeInstanceOf(Date);
    expect(parsed.endedAt).toBeInstanceOf(Date);
    expect(parsed.totalTimeSec).toBeTypeOf("number");
  });

  it("prefers rtept over a short trk when rte has more points (rota planeada vs trk resumo)", () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <trk><name>Resumo</name><trkseg>
    <trkpt lat="-26.281" lon="-49.338"><time>2020-01-01T10:00:00Z</time></trkpt>
    <trkpt lat="-26.280" lon="-49.337"><time>2020-01-01T10:01:00Z</time></trkpt>
  </trkseg></trk>
  <rte><name>Rota</name>
    <rtept lat="-26.50" lon="-49.50"></rtept>
    <rtept lat="-26.00" lon="-49.00"></rtept>
    <rtept lat="-25.50" lon="-48.50"></rtept>
  </rte>
</gpx>`;
    const parsed = parseGpx(xml);
    expect(parsed.waypoints).toHaveLength(3);
    expect(parsed.waypoints[0].lat).toBe(-26.5);
    expect(parsed.waypoints[2].lat).toBe(-25.5);
    expect(parsed.distanceKm).toBeGreaterThan(1);
  });
});
