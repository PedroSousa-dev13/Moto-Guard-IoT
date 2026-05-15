/** Maps motorcycle category name → public image path */
export const CATEGORY_IMAGE_MAP: Record<string, string> = {
  "scooter":            "/motos/scooter.png",
  "naked":              "/motos/naked.png",
  "desportiva":         "/motos/sport.png",
  "trail / adventure":  "/motos/trail.png",
  "custom / cruiser":   "/motos/cruise.png",
  "motocross / enduro": "/motos/enduro.png",
  "touring":            "/motos/tour.png",
  "supermotard":        "/motos/supermotard.png",
};

export function imageFromCategory(category?: string | null): string {
  if (!category) {
    return "/motos/naked.png";
  }
  const normalized = category.toLowerCase();
  const path = CATEGORY_IMAGE_MAP[normalized] ?? "/motos/naked.png";
  console.debug(`imageFromCategory: input="${category}", normalized="${normalized}", path="${path}"`);
  return path;
}
