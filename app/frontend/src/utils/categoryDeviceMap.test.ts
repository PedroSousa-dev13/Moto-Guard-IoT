import { describe, it, expect } from "vitest";
import { CATEGORY_DEVICE_MAP, CATEGORIES, deviceIdFromCategory } from "./categoryDeviceMap";

describe("categoryDeviceMap", () => {
  it("has exactly 8 categories", () => {
    expect(CATEGORIES).toHaveLength(8);
  });

  it("CATEGORIES matches CATEGORY_DEVICE_MAP keys", () => {
    expect(CATEGORIES).toEqual(Object.keys(CATEGORY_DEVICE_MAP));
  });

  it("every category maps to a MOTOGUARD-SIM-* device id", () => {
    for (const [, deviceId] of Object.entries(CATEGORY_DEVICE_MAP)) {
      expect(deviceId).toMatch(/^MOTOGUARD-SIM-/);
    }
  });

  it("all device ids are unique", () => {
    const ids = Object.values(CATEGORY_DEVICE_MAP);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe("deviceIdFromCategory", () => {
    it("returns correct device id for known categories", () => {
      expect(deviceIdFromCategory("Scooter")).toBe("MOTOGUARD-SIM-SCOOTER");
      expect(deviceIdFromCategory("Naked")).toBe("MOTOGUARD-SIM-NAKED");
      expect(deviceIdFromCategory("Desportiva")).toBe("MOTOGUARD-SIM-SPORT");
      expect(deviceIdFromCategory("Trail / Adventure")).toBe("MOTOGUARD-SIM-TRAIL");
      expect(deviceIdFromCategory("Custom / Cruiser")).toBe("MOTOGUARD-SIM-CUSTOM");
      expect(deviceIdFromCategory("Motocross / Enduro")).toBe("MOTOGUARD-SIM-MOTO");
      expect(deviceIdFromCategory("Touring")).toBe("MOTOGUARD-SIM-TOURING");
      expect(deviceIdFromCategory("Supermotard")).toBe("MOTOGUARD-SIM-SUPERMOTO");
    });

    it("returns undefined for unknown category", () => {
      expect(deviceIdFromCategory("Inexistente")).toBeUndefined();
      expect(deviceIdFromCategory("")).toBeUndefined();
    });
  });
});
