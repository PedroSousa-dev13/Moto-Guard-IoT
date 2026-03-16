import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../backend/src/services/prisma.service", () => ({
  prisma: {
    motorcycle: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "../backend/src/services/prisma.service";
import { deviceAssociationService } from "../backend/src/services/device-association.service";

describe("deviceAssociationService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deviceAssociationService.clearCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when device has no association", async () => {
    vi.mocked(prisma.motorcycle.findFirst).mockResolvedValue(null);

    const result = await deviceAssociationService.getAssociation("dev-missing");

    expect(result).toBeNull();
    expect(prisma.motorcycle.findFirst).toHaveBeenCalledWith({
      where: { deviceId: "dev-missing" },
      select: { id: true, userId: true, deviceId: true },
    });
  });

  it("loads association from database and caches it", async () => {
    vi.mocked(prisma.motorcycle.findFirst).mockResolvedValue({
      id: "m1",
      userId: "u1",
      deviceId: "dev-1",
    } as any);

    const first = await deviceAssociationService.getAssociation("dev-1");
    const second = await deviceAssociationService.getAssociation("dev-1");

    expect(first).toEqual({
      motorcycleId: "m1",
      userId: "u1",
      deviceId: "dev-1",
    });
    expect(second).toEqual(first);
    expect(prisma.motorcycle.findFirst).toHaveBeenCalledTimes(1);
  });

  it("expires cache after ttl and reloads from database", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    nowSpy.mockReturnValueOnce(1000);
    vi.mocked(prisma.motorcycle.findFirst).mockResolvedValue({
      id: "m1",
      userId: "u1",
      deviceId: "dev-1",
    } as any);
    const first = await deviceAssociationService.getAssociation("dev-1");

    nowSpy.mockReturnValueOnce(62001);
    vi.mocked(prisma.motorcycle.findFirst).mockResolvedValueOnce({
      id: "m1b",
      userId: "u1",
      deviceId: "dev-1",
    } as any);
    const second = await deviceAssociationService.getAssociation("dev-1");

    expect(first).toEqual({
      motorcycleId: "m1",
      userId: "u1",
      deviceId: "dev-1",
    });
    expect(second).toEqual({
      motorcycleId: "m1b",
      userId: "u1",
      deviceId: "dev-1",
    });
    expect(prisma.motorcycle.findFirst).toHaveBeenCalledTimes(2);
  });

  it("registers existing device without creating motorcycle", async () => {
    vi.mocked(prisma.motorcycle.findFirst).mockResolvedValue({
      id: "m2",
      userId: "u2",
      deviceId: "dev-2",
    } as any);

    const result = await deviceAssociationService.registerDevice(
      "dev-2",
      "ignored-user",
      "ignored-name",
      "p1",
    );

    expect(result).toEqual({
      motorcycleId: "m2",
      userId: "u2",
      deviceId: "dev-2",
    });
    expect(prisma.motorcycle.create).not.toHaveBeenCalled();
  });

  it("creates motorcycle when device is not registered", async () => {
    vi.mocked(prisma.motorcycle.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.motorcycle.create).mockResolvedValue({
      id: "m3",
      userId: "u3",
      deviceId: "dev-3",
    } as any);

    const result = await deviceAssociationService.registerDevice(
      "dev-3",
      "u3",
      "Tracer 9",
      "p3",
    );

    expect(prisma.motorcycle.create).toHaveBeenCalledWith({
      data: {
        userId: "u3",
        name: "Tracer 9",
        deviceId: "dev-3",
        profileId: "p3",
      },
    });
    expect(result).toEqual({
      motorcycleId: "m3",
      userId: "u3",
      deviceId: "dev-3",
    });
  });
});
