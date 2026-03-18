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
});
