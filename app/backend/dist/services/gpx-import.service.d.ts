export type GpxWaypoint = {
    lat: number;
    lon: number;
    ele?: number;
    time?: string;
};
export type GpxBounds = {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
};
export type ParsedGpx = {
    waypoints: GpxWaypoint[];
    bounds: GpxBounds;
    startedAt: Date | null;
    endedAt: Date | null;
    totalTimeSec: number | null;
    distanceKm: number;
    avgSpeedKmh: number | null;
    maxSpeedKmh: number | null;
};
export declare function parseGpx(xml: string): ParsedGpx;
//# sourceMappingURL=gpx-import.service.d.ts.map