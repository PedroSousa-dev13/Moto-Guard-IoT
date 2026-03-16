export declare const TripStatus: {
    readonly ACTIVE: "ACTIVE";
    readonly COMPLETED: "COMPLETED";
    readonly CANCELLED: "CANCELLED";
};
export type TripStatus = (typeof TripStatus)[keyof typeof TripStatus];
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
};
export type EventType = (typeof EventType)[keyof typeof EventType];
export declare const EventSeverity: {
    readonly INFO: "INFO";
    readonly WARNING: "WARNING";
    readonly CRITICAL: "CRITICAL";
};
export type EventSeverity = (typeof EventSeverity)[keyof typeof EventSeverity];
//# sourceMappingURL=enums.d.ts.map