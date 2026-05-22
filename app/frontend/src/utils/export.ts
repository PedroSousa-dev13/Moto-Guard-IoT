import html2canvas from "html2canvas";
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
  try {
    const canvas = await html2canvas(container, {
      scale: 2, // Double scale for high-quality Retina/HD rendering
      useCORS: true,
      backgroundColor: "#06060c", // Maintain MotoGuard IoT dark aesthetic background
    });

    canvas.toBlob((blob) => {
      if (!blob) return;
      triggerDownload(URL.createObjectURL(blob), filename);
    }, "image/png");
  } catch (err) {
    console.error("Erro ao exportar imagem com html2canvas:", err);
  }
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
