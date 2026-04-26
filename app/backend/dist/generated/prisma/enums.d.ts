export declare const TripStatus: {
    readonly ACTIVE: "ACTIVE";
    readonly COMPLETED: "COMPLETED";
    readonly CANCELLED: "CANCELLED";
};
export type TripStatus = (typeof TripStatus)[keyof typeof TripStatus];
export declare const TripCategory: {
    readonly COMMUTE: "COMMUTE";
    readonly WEEKEND_RIDE: "WEEKEND_RIDE";
    readonly TRACK_DAY: "TRACK_DAY";
    readonly OFF_ROAD: "OFF_ROAD";
};
export type TripCategory = (typeof TripCategory)[keyof typeof TripCategory];
export declare const DrivingStyle: {
    readonly AGGRESSIVE: "AGGRESSIVE";
    readonly DEFENSIVE: "DEFENSIVE";
    readonly ECONOMY: "ECONOMY";
};
export type DrivingStyle = (typeof DrivingStyle)[keyof typeof DrivingStyle];
export declare const TripSource: {
    readonly SIMULATOR: "SIMULATOR";
    readonly GPX_IMPORTED: "GPX_IMPORTED";
    readonly DEVICE_REAL: "DEVICE_REAL";
};
export type TripSource = (typeof TripSource)[keyof typeof TripSource];
export declare const EventType: {
    readonly HARD_BRAKING: "HARD_BRAKING";
    readonly EXCESSIVE_LEAN: "EXCESSIVE_LEAN";
    readonly HIGH_VIBRATION: "HIGH_VIBRATION";
    readonly OVERHEAT: "OVERHEAT";
    readonly LOW_VOLTAGE: "LOW_VOLTAGE";
    readonly CRASH_DETECTED: "CRASH_DETECTED";
    readonly RAPID_ACCELERATION: "RAPID_ACCELERATION";
    readonly TIRE_PRESSURE_LOW: "TIRE_PRESSURE_LOW";
    readonly OIL_PRESSURE_LOW: "OIL_PRESSURE_LOW";
    readonly SPEEDING: "SPEEDING";
    readonly ENGINE_OVERREV: "ENGINE_OVERREV";
    readonly WHEELIE_DETECTED: "WHEELIE_DETECTED";
    readonly STOPPIE_DETECTED: "STOPPIE_DETECTED";
    readonly SAFETY_SYSTEM_ACTIVE: "SAFETY_SYSTEM_ACTIVE";
};
export type EventType = (typeof EventType)[keyof typeof EventType];
export declare const EventSeverity: {
    readonly INFO: "INFO";
    readonly WARNING: "WARNING";
    readonly CRITICAL: "CRITICAL";
};
export type EventSeverity = (typeof EventSeverity)[keyof typeof EventSeverity];
//# sourceMappingURL=enums.d.ts.map