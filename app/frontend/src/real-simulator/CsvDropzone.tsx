import { useRef, useState } from "react";
import { parseCSV, ParseResult, ParseError } from "./csvParser";
import { formatTime } from "./utils";

export interface CsvDropzoneProps {
  onParsed: (result: ParseResult) => void;
}

function isParseError(result: ParseResult | ParseError): result is ParseError {
  return "type" in result;
}

function describeParseError(error: ParseError): string {
  switch (error.type) {
    case "NO_TIMESTAMP_COLUMN":
      return `Coluna de timestamp não encontrada. O CSV deve ter uma coluna chamada "timestamp", "time" ou "t".`;
    case "EMPTY_FILE":
      return "O ficheiro CSV está vazio ou não contém linhas de dados válidas.";
    case "INVALID_EXTENSION":
      return "Extensão inválida. Apenas ficheiros .csv são suportados.";
    case "NO_GPS_DATA":
      return "Nenhum dado GPS encontrado. O simulador requer coordenadas GPS para funcionar.";
    default:
      return error.message;
  }
}

export default function CsvDropzone({ onParsed }: CsvDropzoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParseResult | null>(null);

  function processFile(file: File) {
    setError(null);
    setPreview(null);

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Extensão inválida. Apenas ficheiros .csv são suportados.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const result = parseCSV(text, { enableIRLEnhancement: true });

      if (isParseError(result)) {
        setError(describeParseError(result));
      } else {
        setPreview(result);
        onParsed(result);
      }
    };
    reader.readAsText(file);
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragOver(true);
  }

  function handleDragLeave() {
    setIsDragOver(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && fileInputRef.current?.click()}
        aria-label="Zona de importação de CSV. Clique ou arraste um ficheiro .csv"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "24px 16px",
          border: `2px dashed ${isDragOver ? "#6366f1" : error ? "#ef4444" : preview ? "#22c55e" : "#4b5563"}`,
          borderRadius: 8,
          background: isDragOver ? "rgba(99,102,241,0.08)" : "#111827",
          color: "#9ca3af",
          cursor: "pointer",
          transition: "border-color 0.15s, background 0.15s",
          outline: "none",
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={36}
          height={36}
          viewBox="0 0 24 24"
          fill="none"
          stroke={preview ? "#22c55e" : isDragOver ? "#6366f1" : "#6b7280"}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>

        <span style={{ fontSize: 14, fontWeight: 500, color: preview ? "#22c55e" : "#d1d5db" }}>
          {preview ? "CSV carregado com sucesso" : "Importar ficheiro CSV"}
        </span>
        <span style={{ fontSize: 12 }}>Arraste aqui ou clique para escolher</span>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          style={{
            marginTop: 4,
            padding: "6px 16px",
            background: "#1f2937",
            border: "1px solid #374151",
            borderRadius: 6,
            color: "#d1d5db",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Selecionar ficheiro
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={handleFileInputChange}
        />
      </div>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            padding: "10px 14px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.4)",
            borderRadius: 6,
            color: "#fca5a5",
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0, marginTop: 1 }}
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}

      {/* Preview */}
      {preview && (
        <div
          style={{
            padding: "12px 14px",
            background: "#1f2937",
            border: "1px solid #374151",
            borderRadius: 6,
            fontSize: 13,
            color: "#d1d5db",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <span style={{ fontWeight: 600, color: "#f9fafb", marginBottom: 2 }}>Pré-visualização</span>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px" }}>
            <span>
              <span style={{ color: "#9ca3af" }}>Formato: </span>
              <span style={{ color: "#a5f3fc", fontWeight: 500 }}>
                {preview.format === 'riderdata' ? 'RiderData' : 'Genérico'}
              </span>
            </span>

            <span>
              <span style={{ color: "#9ca3af" }}>Linhas: </span>
              <span style={{ color: "#a5f3fc", fontWeight: 500 }}>{preview.rows.length}</span>
            </span>

            <span>
              <span style={{ color: "#9ca3af" }}>Duração: </span>
              <span style={{ color: "#a5f3fc", fontWeight: 500 }}>
                {formatTime(0)} – {formatTime(preview.durationSec)}
              </span>
            </span>

            {preview.skippedCount > 0 && (
              <span>
                <span style={{ color: "#9ca3af" }}>Ignoradas: </span>
                <span style={{ color: "#fbbf24", fontWeight: 500 }}>{preview.skippedCount}</span>
              </span>
            )}
          </div>

          <div>
            <span style={{ color: "#9ca3af" }}>Colunas: </span>
            <span style={{ color: "#c4b5fd" }}>{preview.columns.join(", ")}</span>
          </div>

          {preview.skippedCount > 0 && (
            <div
              style={{
                marginTop: 4,
                padding: "6px 10px",
                background: "rgba(251,191,36,0.08)",
                border: "1px solid rgba(251,191,36,0.3)",
                borderRadius: 4,
                color: "#fde68a",
                fontSize: 12,
              }}
            >
              {preview.skippedCount} {preview.skippedCount === 1 ? "linha foi ignorada" : "linhas foram ignoradas"} por falta de latitude, longitude ou timestamp válido.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
