import * as runtime from "@prisma/client/runtime/index-browser";
export type * from '../models';
export type * from './prismaNamespace';
export declare const Decimal: typeof runtime.Decimal;
export declare const NullTypes: {
    DbNull: (new (secret: never) => typeof runtime.DbNull);
    JsonNull: (new (secret: never) => typeof runtime.JsonNull);
    AnyNull: (new (secret: never) => typeof runtime.AnyNull);
};
/**
 * Helper for filtering JSON entries that have `null` on the database (empty on the db)
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export declare const DbNull: import("@prisma/client-runtime-utils").DbNullClass;
/**
 * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export declare const JsonNull: import("@prisma/client-runtime-utils").JsonNullClass;
/**
 * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
 *
 * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
 */
export declare const AnyNull: import("@prisma/client-runtime-utils").AnyNullClass;
export declare const ModelName: {
    readonly User: "User";
    readonly MotorcycleProfile: "MotorcycleProfile";
    readonly Motorcycle: "Motorcycle";
    readonly Trip: "Trip";
    readonly TripEvent: "TripEvent";
    readonly GpxData: "GpxData";
};
export type ModelName = (typeof ModelName)[keyof typeof ModelName];
export declare const TransactionIsolationLevel: {
    readonly ReadUncommitted: "ReadUncommitted";
    readonly ReadCommitted: "ReadCommitted";
    readonly RepeatableRead: "RepeatableRead";
    readonly Serializable: "Serializable";
};
export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel];
export declare const UserScalarFieldEnum: {
    readonly id: "id";
    readonly email: "email";
    readonly passwordHash: "passwordHash";
    readonly name: "name";
    readonly resetToken: "resetToken";
    readonly emergencyContact: "emergencyContact";
    readonly resendApiKey: "resendApiKey";
    readonly createdAt: "createdAt";
    readonly updatedAt: "updatedAt";
};
export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum];
export declare const MotorcycleProfileScalarFieldEnum: {
    readonly id: "id";
    readonly name: "name";
    readonly example: "example";
    readonly ccMin: "ccMin";
    readonly ccMax: "ccMax";
    readonly maxSpeedKmh: "maxSpeedKmh";
    readonly maxRpm: "maxRpm";
    readonly engineTempMin: "engineTempMin";
    readonly engineTempMax: "engineTempMax";
    readonly voltageMin: "voltageMin";
    readonly voltageMax: "voltageMax";
    readonly typicalMaxRollDeg: "typicalMaxRollDeg";
    readonly avgWeightKg: "avgWeightKg";
    readonly crashRollThreshold: "crashRollThreshold";
    readonly crashPitchThreshold: "crashPitchThreshold";
    readonly crashGForce: "crashGForce";
    readonly crashConfirmSec: "crashConfirmSec";
    readonly criticalRpm: "criticalRpm";
    readonly criticalTemp: "criticalTemp";
    readonly criticalVoltage: "criticalVoltage";
    readonly createdAt: "createdAt";
};
export type MotorcycleProfileScalarFieldEnum = (typeof MotorcycleProfileScalarFieldEnum)[keyof typeof MotorcycleProfileScalarFieldEnum];
export declare const MotorcycleScalarFieldEnum: {
    readonly id: "id";
    readonly userId: "userId";
    readonly profileId: "profileId";
    readonly name: "name";
    readonly brand: "brand";
    readonly model: "model";
    readonly year: "year";
    readonly plate: "plate";
    readonly category: "category";
    readonly deviceId: "deviceId";
    readonly createdAt: "createdAt";
    readonly updatedAt: "updatedAt";
};
export type MotorcycleScalarFieldEnum = (typeof MotorcycleScalarFieldEnum)[keyof typeof MotorcycleScalarFieldEnum];
export declare const TripScalarFieldEnum: {
    readonly id: "id";
    readonly userId: "userId";
    readonly motorcycleId: "motorcycleId";
    readonly source: "source";
    readonly startedAt: "startedAt";
    readonly endedAt: "endedAt";
    readonly distanceKm: "distanceKm";
    readonly maxSpeedKmh: "maxSpeedKmh";
    readonly avgSpeedKmh: "avgSpeedKmh";
    readonly maxRollDeg: "maxRollDeg";
    readonly maxGForce: "maxGForce";
    readonly status: "status";
    readonly mlScore: "mlScore";
    readonly mlModelVersion: "mlModelVersion";
    readonly category: "category";
    readonly categoryConfidence: "categoryConfidence";
    readonly drivingStyle: "drivingStyle";
    readonly createdAt: "createdAt";
};
export type TripScalarFieldEnum = (typeof TripScalarFieldEnum)[keyof typeof TripScalarFieldEnum];
export declare const TripEventScalarFieldEnum: {
    readonly id: "id";
    readonly tripId: "tripId";
    readonly type: "type";
    readonly severity: "severity";
    readonly message: "message";
    readonly latitude: "latitude";
    readonly longitude: "longitude";
    readonly speedKmh: "speedKmh";
    readonly rollDeg: "rollDeg";
    readonly gForce: "gForce";
    readonly engineTempC: "engineTempC";
    readonly voltage: "voltage";
    readonly occurredAt: "occurredAt";
    readonly createdAt: "createdAt";
};
export type TripEventScalarFieldEnum = (typeof TripEventScalarFieldEnum)[keyof typeof TripEventScalarFieldEnum];
export declare const GpxDataScalarFieldEnum: {
    readonly id: "id";
    readonly tripId: "tripId";
    readonly filename: "filename";
    readonly fileSize: "fileSize";
    readonly waypoints: "waypoints";
    readonly bounds: "bounds";
    readonly totalTime: "totalTime";
    readonly importDate: "importDate";
    readonly createdAt: "createdAt";
};
export type GpxDataScalarFieldEnum = (typeof GpxDataScalarFieldEnum)[keyof typeof GpxDataScalarFieldEnum];
export declare const SortOrder: {
    readonly asc: "asc";
    readonly desc: "desc";
};
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];
export declare const JsonNullValueInput: {
    readonly JsonNull: import("@prisma/client-runtime-utils").JsonNullClass;
};
export type JsonNullValueInput = (typeof JsonNullValueInput)[keyof typeof JsonNullValueInput];
export declare const QueryMode: {
    readonly default: "default";
    readonly insensitive: "insensitive";
};
export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode];
export declare const NullsOrder: {
    readonly first: "first";
    readonly last: "last";
};
export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder];
export declare const JsonNullValueFilter: {
    readonly DbNull: import("@prisma/client-runtime-utils").DbNullClass;
    readonly JsonNull: import("@prisma/client-runtime-utils").JsonNullClass;
    readonly AnyNull: import("@prisma/client-runtime-utils").AnyNullClass;
};
export type JsonNullValueFilter = (typeof JsonNullValueFilter)[keyof typeof JsonNullValueFilter];
//# sourceMappingURL=prismaNamespaceBrowser.d.ts.map