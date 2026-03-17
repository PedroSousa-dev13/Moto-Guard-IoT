import { describe, it, expect } from "vitest";

describe("GPX Routes", () => {
  it("deve existir e ser importável", async () => {
    const routes = await import("../backend/src/routes/gpx.routes");
    expect(routes.default).toBeDefined();
  });

  it("deve exportar um router válido", async () => {
    const routes = await import("../backend/src/routes/gpx.routes");
    expect(typeof routes.default).toBe("function");
  });
});

