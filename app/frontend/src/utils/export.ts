import type { TripFeedItem } from "../types";

export function exportCsv(data: TripFeedItem[], filename = "analytics.csv") {
  const headers = [
    "Data início",
    "Data fim",
    "Estado",
    "Mota",
    "Distância (km)",
    "Vel. média (km/h)",
    "Vel. máx (km/h)",
    "Safety score",
    "Performance score",
    "Eventos total",
    "Eventos INFO",
    "Eventos WARNING",
    "Eventos CRITICAL",
  ];

  const rows = data.map((t) => [
    t.startedAt ? new Date(t.startedAt).toLocaleString("pt-PT") : "",
    t.endedAt ? new Date(t.endedAt).toLocaleString("pt-PT") : "",
    t.status,
    t.motorcycle?.name ?? "",
    t.distanceKm != null ? t.distanceKm.toFixed(2) : "",
    t.avgSpeedKmh != null ? t.avgSpeedKmh.toFixed(1) : "",
    t.maxSpeedKmh != null ? t.maxSpeedKmh.toFixed(1) : "",
    t.safetyScore != null ? t.safetyScore.toFixed(0) : "",
    t.performanceScore != null ? t.performanceScore.toFixed(0) : "",
    t.eventCounts?.total ?? 0,
    t.eventCounts?.bySeverity?.INFO ?? 0,
    t.eventCounts?.bySeverity?.WARNING ?? 0,
    t.eventCounts?.bySeverity?.CRITICAL ?? 0,
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
    .join("\r\n");

  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(URL.createObjectURL(blob), filename);
}

export async function exportChartsPng(container: HTMLElement, filename = "analytics.png") {
  const rect = container.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(rect.width * scale);
  canvas.height = Math.round(rect.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.scale(scale, scale);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#ffffff";
  ctx.fillRect(0, 0, rect.width, rect.height);

  const svgs = Array.from(container.querySelectorAll<SVGSVGElement>("svg"));

  await Promise.all(
    svgs.map(
      (svg) =>
        new Promise<void>((resolve) => {
          const svgRect = svg.getBoundingClientRect();
          const clone = svg.cloneNode(true) as SVGElement;
          clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
          clone.setAttribute("width", String(svgRect.width));
          clone.setAttribute("height", String(svgRect.height));
          const serialized = new XMLSerializer().serializeToString(clone);
          const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.onload = () => {
            const x = svgRect.left - rect.left;
            const y = svgRect.top - rect.top;
            ctx.drawImage(img, x, y, svgRect.width, svgRect.height);
            URL.revokeObjectURL(url);
            resolve();
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve();
          };
          img.src = url;
        }),
    ),
  );

  canvas.toBlob((blob) => {
    if (!blob) return;
    triggerDownload(URL.createObjectURL(blob), filename);
  }, "image/png");
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
