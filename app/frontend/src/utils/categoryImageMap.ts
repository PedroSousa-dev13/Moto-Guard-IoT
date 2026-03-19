/** Maps motorcycle category name → public image path */
export const CATEGORY_IMAGE_MAP: Record<string, string> = {
  "Scooter":            "/motos/scooter.webp",
  "Naked":              "/motos/naked.jpg",
  "Desportiva":         "/motos/sport.jpg",
  "Trail / Adventure":  "/motos/trail.jpg",
  "Custom / Cruiser":   "/motos/cruise.jpg",
  "Motocross / Enduro": "/motos/enduro.jpg",
  "Touring":            "/motos/tour.jpg",
  "Supermotard":        "/motos/supermotard.jpg",
};

export function imageFromCategory(category?: string | null): string {
  if (!category) return "/motos/naked.jpg"; // fallback
  return CATEGORY_IMAGE_MAP[category] ?? "/motos/naked.jpg";
}
