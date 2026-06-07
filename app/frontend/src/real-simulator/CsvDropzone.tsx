import { useRef, useState } from "react";
import { parseCSV, ParseResult, ParseError } from "./csvParser";
import { formatTime } from "./utils";

export interface CsvDropzoneProps {
  onParsed: (result: ParseResult) => void;
  className?: string;
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

export default function CsvDropzone({ onParsed, className }: CsvDropzoneProps) {
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
    <div className={`flex flex-col gap-4 h-full ${className || ""}`}>
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
        className={`flex-1 flex flex-col items-center justify-center gap-4 p-10 border-2 border-dashed rounded-[2rem] transition-all outline-none cursor-pointer ${
          isDragOver 
            ? "bg-accent/10 border-accent shadow-lg shadow-accent/5 scale-[1.01]" 
            : error 
              ? "bg-red/5 border-red/40" 
              : preview 
                ? "bg-green/5 border-green/40" 
                : "bg-panel border-border-glass-subtle hover:bg-panel-hover hover:border-border-glass"
        }`}
      >
        <div className={`p-5 rounded-2xl ${preview ? 'bg-green/10 text-green' : isDragOver ? 'bg-accent/10 text-accent' : 'bg-white/5 text-muted'} transition-colors`}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={48}
            height={48}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
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
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className={`text-lg font-black tracking-tight ${preview ? "text-green" : "text-text"}`}>
            {preview ? "CSV Carregado com Sucesso" : "Importar Telemetria CSV"}
          </span>
          <span className="text-[0.7rem] font-black uppercase tracking-widest text-muted opacity-40">Arraste aqui ou clique para escolher</span>
        </div>

        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
          className="btn btn-outline mt-2"
        >
          Selecionar Ficheiro
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>

      {/* Error message */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 bg-red/10 border border-red/20 rounded-2xl text-red text-xs font-bold animate-shake"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 mt-0.5"
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
        <div className="p-6 bg-panel border border-border-glass-subtle rounded-[2rem] flex flex-col gap-6 shadow-inner animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-[0.7rem] font-black uppercase tracking-[0.3em] text-muted opacity-40">Resumo do Ficheiro</span>
            <div className="h-px flex-1 mx-6 bg-border-glass-subtle" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-40">Formato</span>
              <span className="text-sm font-black text-accent uppercase">{preview.format === 'riderdata' ? 'RiderData' : 'Genérico'}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-40">Total Linhas</span>
              <span className="text-sm font-black text-text tabular-nums">{preview.rows.length}</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-40">Duração</span>
              <span className="text-sm font-black text-text tabular-nums">{formatTime(preview.durationSec)}</span>
            </div>
            {preview.skippedCount > 0 && (
              <div className="flex flex-col gap-1">
                <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-40 text-yellow">Ignoradas</span>
                <span className="text-sm font-black text-yellow tabular-nums">{preview.skippedCount}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[0.55rem] font-black text-muted uppercase tracking-widest opacity-40">Colunas Detetadas</span>
            <div className="flex flex-wrap gap-2">
              {preview.columns.map(col => (
                <span key={col} className="px-3 py-1 bg-surface border border-border-glass-subtle rounded-lg text-[0.6rem] font-bold text-muted uppercase tracking-widest">
                  {col}
                </span>
              ))}
            </div>
          </div>

          {preview.skippedCount > 0 && (
            <div className="p-3 bg-yellow/5 border border-yellow/20 rounded-xl text-yellow text-[0.65rem] font-bold leading-relaxed">
              Nota: {preview.skippedCount} {preview.skippedCount === 1 ? "linha foi ignorada" : "linhas foram ignoradas"} por dados incompletos ou inválidos.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
