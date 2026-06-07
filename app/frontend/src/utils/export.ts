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

export async function exportChartsPng(container: HTMLElement, filename = "analytics.png"): Promise<string | null> {
  // Polyfill CSSStyleSheet properties to prevent fatal SecurityError crashes from cross-origin stylesheets
  // and to filter out Tailwind v4's modern color functions (oklab, oklch) which crash html2canvas's parser.
  const originalCssRulesDescriptor = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, "cssRules");
  const originalRulesDescriptor = Object.getOwnPropertyDescriptor(CSSStyleSheet.prototype, "rules");
  const originalGetComputedStyle = window.getComputedStyle;
  
  const filterRules = (rawRules: CSSRuleList | null): CSSRule[] => {
    if (!rawRules) return [];
    const filtered: any = [];
    for (let i = 0; i < rawRules.length; i++) {
      const rule = rawRules[i];
      try {
        if (rule.cssText && (rule.cssText.includes("oklab") || rule.cssText.includes("oklch"))) {
          continue; // Skip rules with unsupported oklab or oklch colors to prevent html2canvas from throwing an error
        }
        filtered.push(rule);
      } catch (e) {
        // Safe fallback in case reading cssText throws an error
        filtered.push(rule);
      }
    }
    
    // Polyfill the CSSRuleList.item() method for complete library compatibility
    Object.defineProperty(filtered, "item", {
      value: function(index: number) {
        return this[index];
      },
      writable: true,
      configurable: true
    });
    
    return filtered;
  };

  if (originalCssRulesDescriptor) {
    Object.defineProperty(CSSStyleSheet.prototype, "cssRules", {
      get() {
        try {
          const rawRules = originalCssRulesDescriptor.get ? originalCssRulesDescriptor.get.call(this) : null;
          return filterRules(rawRules);
        } catch (e) {
          return filterRules(null); // Return empty ruleset with item() polyfill if browser blocks access (CORS SecurityError)
        }
      },
      configurable: true
    });
  }

  if (originalRulesDescriptor) {
    Object.defineProperty(CSSStyleSheet.prototype, "rules", {
      get() {
        try {
          const rawRules = originalRulesDescriptor.get ? originalRulesDescriptor.get.call(this) : null;
          return filterRules(rawRules);
        } catch (e) {
          return filterRules(null);
        }
      },
      configurable: true
    });
  }

  // Intercept window.getComputedStyle to translate any Tailwind v4 computed oklab/oklch colors
  // into standard high-fidelity Hex/RGBA colors supported by html2canvas's Color.parse engine,
  // and handle Recharts SVG gradient references by resolving them directly to solid colors.
  window.getComputedStyle = function(elt, pseudoElt) {
    const style = originalGetComputedStyle.call(window, elt, pseudoElt);
    return new Proxy(style, {
      get(target, prop) {
        // Do NOT pass receiver (the proxy itself) to Reflect.get, because native getters
        // on CSSStyleDeclaration require their 'this' context to be the raw native target object.
        // Passing the receiver throws 'TypeError: Illegal invocation' in many modern browsers.
        const val = Reflect.get(target, prop);
        if (typeof val === "string") {
          if (val.includes("oklab") || val.includes("oklch")) {
            const propStr = String(prop);
            if (propStr === "color") {
              return "#ffffff"; // Text fallback
            }
            if (propStr === "backgroundColor") {
              return "rgba(13, 13, 27, 0.6)"; // Standard glass surface background
            }
            if (propStr.includes("Color")) {
              return "rgba(255, 255, 255, 0.08)"; // Standard glass border color
            }
            if (propStr === "fill" || propStr === "stroke") {
              return "#8b5cf6"; // Core brand accent purple color
            }
            return "rgba(255, 255, 255, 0.1)"; // Safe generic glass translucent fallback
          }

          const propStr = String(prop);
          if (propStr === "fill" || propStr === "fill-opacity" || propStr === "fillOpacity") {
            if (val.includes("colorDist")) {
              return propStr === "fill" ? "#8b5cf6" : "0.25";
            }
            if (val.includes("colorSpeed")) {
              return propStr === "fill" ? "#0ea5e9" : "0.25";
            }
            if (val.includes("colorTrips")) {
              if (propStr === "fill") return "#6366f1";
              return elt.tagName.toLowerCase() === "path" ? "0.6" : "1.0";
            }
          }
        }
        return typeof val === "function" ? val.bind(target) : val;
      }
    });
  };

  const rect = container.getBoundingClientRect();
  const width = Math.ceil(rect.width);
  const height = Math.ceil(rect.height);

  try {
    const canvas = await html2canvas(container, {
      scale: 2, // Double scale for high-quality Retina/HD rendering
      useCORS: false, // Omit CORS fetch attempts to prevent cross-origin network errors on fonts/styles
      allowTaint: false, // Prevent tainting the canvas, which would crash toDataURL() or toBlob()
      backgroundColor: "#06060c", // Maintain MotoGuard IoT dark aesthetic background
      scrollX: 0,
      scrollY: 0,
      windowWidth: width,
      windowHeight: height,
      onclone: (clonedDoc) => {
        // Find the cloned container element and force it to match the original rendered dimensions.
        // This ensures the exported dashboard matches the on-screen layout exactly without distortion.
        const clonedContainer = clonedDoc.querySelector(".html2canvas-export") as HTMLElement;
        if (clonedContainer) {
          clonedContainer.style.margin = "0";
          clonedContainer.style.width = `${width}px`;
          clonedContainer.style.height = `${height}px`;
          clonedContainer.style.boxSizing = "border-box";
        }

        // Clean up SVG gradients inside cloned document to prevent html2canvas's SVG gradient parser from crashing
        const clonedLinearGradients = clonedDoc.querySelectorAll("linearGradient");
        clonedLinearGradients.forEach((grad) => {
          grad.parentNode?.removeChild(grad);
        });

        // Find elements with gradient fills and replace with solid fallbacks (attributes + styles)
        clonedDoc.querySelectorAll("path, rect").forEach((el: any) => {
          const fillAttr = el.getAttribute("fill") || el.style.fill;
          if (fillAttr) {
            if (fillAttr.includes("colorDist")) {
              el.setAttribute("fill", "#8b5cf6");
              el.style.fill = "#8b5cf6";
              el.setAttribute("fill-opacity", "0.25");
              el.style.fillOpacity = "0.25";
            } else if (fillAttr.includes("colorSpeed")) {
              el.setAttribute("fill", "#0ea5e9");
              el.style.fill = "#0ea5e9";
              el.setAttribute("fill-opacity", "0.25");
              el.style.fillOpacity = "0.25";
            } else if (fillAttr.includes("colorTrips")) {
              el.setAttribute("fill", "#6366f1");
              el.style.fill = "#6366f1";
              if (el.tagName.toLowerCase() === "path") {
                el.setAttribute("fill-opacity", "0.6");
                el.style.fillOpacity = "0.6";
              }
            }
          }
        });

        // Fix for Recharts SVGs: set a responsive viewBox and scale them to 100% of their parent card elements
        // in the spacious A3 document. This prevents any clipping or size mismatch.
        const originalSVGs = container.querySelectorAll("svg");
        const clonedSVGs = clonedDoc.querySelectorAll("svg");
        
        clonedSVGs.forEach((clonedSvg, index) => {
          const originalSvg = originalSVGs[index];
          if (originalSvg) {
            const rect = originalSvg.getBoundingClientRect();
            // Force dynamic scalable viewBox from the original rendered dimensions
            clonedSvg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
            clonedSvg.setAttribute("width", "100%");
            clonedSvg.setAttribute("height", "100%");
            clonedSvg.style.width = "100%";
            clonedSvg.style.height = "100%";
          }
        });
      }
    });

    const blob = await new Promise<Blob | null>((resolve) => {
      if (canvas.toBlob) {
        canvas.toBlob((b) => resolve(b), "image/png");
      } else {
        try {
          const dataUrl = canvas.toDataURL("image/png");
          const arr = dataUrl.split(",");
          const mime = arr[0].match(/:(.*?);/)?.[1] || "image/png";
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
          }
          resolve(new Blob([u8arr], { type: mime }));
        } catch (e) {
          resolve(null);
        }
      }
    });

    if (!blob) {
      throw new Error("Falha ao gerar o Blob da imagem.");
    }

    const blobUrl = URL.createObjectURL(blob);
    return blobUrl;
  } catch (err) {
    console.error("Erro ao exportar imagem com html2canvas:", err);
    throw err; // Re-throw the exact error to let the UI capture and display the diagnostic details
  } finally {
    // Restore original window.getComputedStyle and CSSStyleSheet properties to prevent any permanent side-effects
    window.getComputedStyle = originalGetComputedStyle;
    
    if (originalCssRulesDescriptor) {
      Object.defineProperty(CSSStyleSheet.prototype, "cssRules", originalCssRulesDescriptor);
    }
    if (originalRulesDescriptor) {
      Object.defineProperty(CSSStyleSheet.prototype, "rules", originalRulesDescriptor);
    }
  }
}

function triggerDownload(url: string, filename: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
