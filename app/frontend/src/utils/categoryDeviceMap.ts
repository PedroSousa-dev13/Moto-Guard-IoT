export const CATEGORY_DEVICE_MAP: Record<string, string> = {
  "Scooter":            "MOTOGUARD-SIM-SCOOTER",
  "Naked":              "MOTOGUARD-SIM-NAKED",
  "Desportiva":         "MOTOGUARD-SIM-SPORT",
  "Trail / Adventure":  "MOTOGUARD-SIM-TRAIL",
  "Custom / Cruiser":   "MOTOGUARD-SIM-CUSTOM",
  "Motocross / Enduro": "MOTOGUARD-SIM-MOTO",
  "Touring":            "MOTOGUARD-SIM-TOURING",
  "Supermotard":        "MOTOGUARD-SIM-SUPERMOTO",
};

export const CATEGORIES = Object.keys(CATEGORY_DEVICE_MAP);

export function deviceIdFromCategory(category: string): string | undefined {
  return CATEGORY_DEVICE_MAP[category];
}
