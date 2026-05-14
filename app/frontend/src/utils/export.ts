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

function svgToCanvas(svg: SVGSVGElement): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const viewBox = (svg.getAttribute("viewBox") || "").split(" ").map(Number);
    const vbW = viewBox[2] || 385;
    const vbH = viewBox[3] || 240;
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vbW * scale);
    canvas.height = Math.round(vbH * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) { reject(new Error("No canvas context")); return; }
    ctx.scale(scale, scale);
    ctx.fillStyle = "#0d0d1b";
    ctx.fillRect(0, 0, vbW, vbH);

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(vbW));
    clone.setAttribute("height", String(vbH));
    const serialized = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, vbW, vbH);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("SVG render failed")); };
    img.src = url;
  });
}

export async function exportChartsPdf(
  container: HTMLElement,
  kpis: { trips: number; distanceKm: number; safetyAvg: number | null; performanceAvg: number | null; criticalEvents: number; avgSpeed: number | null },
  daterange: string,
  filename = "analytics.pdf",
) {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF("p", "mm", "a4");
  const pageW = 210;
  const margin = 15;
  const contentW = pageW - margin * 2;

  let y = margin;

  // ── Title ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("MotoGuard Analytics", pageW / 2, y, { align: "center" });
  y += 8;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Período: ${daterange}`, pageW / 2, y, { align: "center" });
  y += 10;

  // ── Divider ──
  doc.setDrawColor(200, 200, 200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ── KPI Summary ──
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Resumo de KPI", margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const kpiRows = [
    ["Viagens", String(kpis.trips)],
    ["Distância Total", `${kpis.distanceKm.toFixed(1)} km`],
    ["Safety Score (médio)", kpis.safetyAvg != null ? `${kpis.safetyAvg.toFixed(0)}/100` : "—"],
    ["Performance (média)", kpis.performanceAvg != null ? `${kpis.performanceAvg.toFixed(0)}/100` : "—"],
    ["Incidentes Críticos", String(kpis.criticalEvents)],
    ["Velocidade Média", kpis.avgSpeed != null ? `${kpis.avgSpeed.toFixed(1)} km/h` : "—"],
  ];
  kpiRows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, margin + contentW, y, { align: "right" });
    y += 6;
  });

  y += 6;

  // ── Capture chart SVGs individually (avoid html2canvas oklab issue) ──
  const svgs = Array.from(container.querySelectorAll<SVGSVGElement>("svg.recharts-surface"));
  if (svgs.length > 0) {
    if (y + 60 > 285) { doc.addPage(); y = margin; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Gráficos", margin, y);
    y += 4;

    for (const svg of svgs) {
      try {
        const canvas = await svgToCanvas(svg);
        const imgW = contentW;
        const imgH = (canvas.height / canvas.width) * imgW;
        if (y + imgH + 6 > 285) { doc.addPage(); y = margin; }
        doc.addImage(canvas, "PNG", margin, y, imgW, Math.min(imgH, 80));
        y += Math.min(imgH, 80) + 6;
      } catch {
        // skip chart if it fails
      }
    }
  }

  // ── Footer ──
  const footerText = `Gerado em ${new Date().toLocaleString("pt-PT")} — MotoGuard IoT`;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(150, 150, 150);
  doc.text(footerText, pageW / 2, 292, { align: "center" });

  doc.save(filename);
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
