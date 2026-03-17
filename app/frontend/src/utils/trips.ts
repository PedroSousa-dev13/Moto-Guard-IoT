import type { Trip, TripSource, TripStatus, MotorcycleSummary } from "../types";

export type TripSourceFilter = "ALL" | TripSource;
export type TripStatusFilter = "ALL" | TripStatus;

export interface TripFilters {
  status: TripStatusFilter;
  motorcycleId: string;
  fromDate: string;
  toDate: string;
  onlyWithEvents: boolean;
}

export function applyTripFilters(list: Trip[], filters: TripFilters): Trip[] {
  let out = list;

  if (filters.status !== "ALL") {
    out = out.filter((t) => t.status === filters.status);
  }

  if (filters.motorcycleId !== "ALL") {
    out = out.filter((t) => t.motorcycle?.id === filters.motorcycleId);
  }

  if (filters.fromDate) {
    const from = new Date(filters.fromDate);
    out = out.filter((t) => new Date(t.startedAt) >= from);
  }

  if (filters.toDate) {
    const to = new Date(filters.toDate);
    to.setHours(23, 59, 59, 999);
    out = out.filter((t) => new Date(t.startedAt) <= to);
  }

  if (filters.onlyWithEvents) {
    out = out.filter((t) => (t.events?.length ?? t._count?.events ?? 0) > 0);
  }

  return out;
}

export function listMotorcyclesForFilter(trips: Trip[]): MotorcycleSummary[] {
  return Array.from(
    new Map(
      trips
        .filter((t) => t.motorcycle?.id)
        .map((t) => [t.motorcycle.id, t.motorcycle]),
    ).values(),
  );
}

export function paginate<T>(items: T[], page: number, pageSize: number): { page: number; totalPages: number; items: T[] } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    items: items.slice(startIdx, startIdx + pageSize),
  };
}

export function groupTripsBySource(trips: Trip[]): Record<TripSource, Trip[]> {
  return {
    SIMULATOR: trips.filter((t) => t.source === "SIMULATOR"),
    GPX_IMPORTED: trips.filter((t) => t.source === "GPX_IMPORTED"),
    DEVICE_REAL: trips.filter((t) => t.source === "DEVICE_REAL"),
  };
}

