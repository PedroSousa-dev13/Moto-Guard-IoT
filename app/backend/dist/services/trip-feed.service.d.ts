import { EventSeverity, EventType } from "../generated/prisma/enums";
export type TripFeedEventLite = {
    type: EventType;
    severity: EventSeverity;
};
export type TripFeedTripLite = {
    id: string;
    startedAt: Date;
    endedAt: Date | null;
    status: string;
    source: string;
    distanceKm: number | null;
    avgSpeedKmh: number | null;
    maxSpeedKmh: number | null;
    maxRollDeg: number | null;
    maxGForce: number | null;
    category?: string | null;
    categoryConfidence?: number | null;
    drivingStyle?: string | null;
    motorcycle: {
        id: string;
        name: string;
        brand: string | null;
        category?: string | null;
    } | null;
    profile?: {
        maxSpeedKmh: number;
        typicalMaxRollDeg: number;
        crashRollThreshold: number;
        crashGForce: number;
    } | null;
};
export type TripFeedItem = {
    id: string;
    startedAt: Date;
    endedAt: Date | null;
    status: string;
    source: string;
    distanceKm: number | null;
    avgSpeedKmh: number | null;
    maxSpeedKmh: number | null;
    category?: string | null;
    categoryConfidence?: number | null;
    drivingStyle?: string | null;
    motorcycle: {
        id: string;
        name: string;
        brand: string | null;
        category?: string | null;
    } | null;
    eventCounts: {
        total: number;
        bySeverity: Record<EventSeverity, number>;
        byType: Partial<Record<EventType, number>>;
    };
    safetyScore: number;
    performanceScore: number;
    labels: string[];
    buckets: {
        safety: "good" | "warn" | "bad";
        performance: "good" | "warn" | "bad";
    };
};
export declare function buildTripFeedItem(trip: TripFeedTripLite, events: TripFeedEventLite[]): TripFeedItem;
//# sourceMappingURL=trip-feed.service.d.ts.map