import { useState, useRef } from 'react';
import { Loader2, Upload, X } from 'lucide-react';

interface FileUploadComponentProps {
  onFileSelect: (file: File) => void;
  onError: (error: string) => void;
  isUploading: boolean;
  progress?: number;
  disabled?: boolean;
}

export default function FileUploadComponent({
  onFileSelect,
  onError,
  isUploading,
  progress = 0,
  disabled = false
}: FileUploadComponentProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    // Check file extension
    if (!file.name.toLowerCase().endsWith('.gpx')) {
      onError('Por favor seleciona um ficheiro .gpx');
      return false;
    }

    // Check file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      onError('O ficheiro é demasiado grande. Máximo permitido: 10MB');
      return false;
    }

    // Check if file is empty
    if (file.size === 0) {
      onError('O ficheiro selecionado está vazio');
      return false;
    }

    return true;
  };

  const handleFileSelect = (file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file);
      onFileSelect(file);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    if (!disabled && !isUploading) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);

    if (disabled || isUploading) return;

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleClick = () => {
    if (!disabled && !isUploading) {
      fileInputRef.current?.click();
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept=".gpx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />
      
      <div
        className={`w-full p-8 rounded-3xl bg-surface/50 border border-dashed text-center flex flex-col items-center justify-center gap-4 transition-all duration-300 group cursor-pointer relative overflow-hidden select-none outline-none focus:border-accent ${
          isDragOver
            ? 'border-accent bg-accent/5 scale-[1.01] shadow-[0_0_20px_rgba(139,92,246,0.15)]'
            : 'border-border-glass-subtle hover:border-accent/40 hover:bg-panel-hover/50'
        } ${disabled || isUploading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        role="button"
        tabIndex={disabled || isUploading ? -1 : 0}
        aria-label="Selecionar ficheiro GPX para upload"
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled && !isUploading) {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <div className={`w-14 h-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent transition-all duration-300 ${
          isDragOver ? 'scale-110 rotate-6 bg-accent/20 border-accent/40' : 'group-hover:scale-105'
        }`}>
          {isUploading ? (
            <Loader2 size={24} className="animate-spin text-accent" />
          ) : (
            <Upload size={24} className="group-hover:translate-y-[-2px] transition-transform duration-300" />
          )}
        </div>
        
        <div className="flex flex-col gap-1">
          <div className="text-[0.8rem] font-black text-text tracking-tight">
            {isUploading 
              ? 'A carregar ficheiro...' 
              : isDragOver
                ? 'Solta o ficheiro aqui'
                : 'Arrasta um ficheiro GPX ou clica para selecionar'
            }
          </div>
          <div className="text-[0.65rem] font-bold text-muted uppercase tracking-widest opacity-60">
            Máximo 10MB • Apenas ficheiros .gpx
          </div>
        </div>
      </div>

      {isUploading && (
        <div className="w-full flex flex-col gap-2 p-4 rounded-2xl bg-panel border border-border-glass-subtle animate-fade-in">
          <div className="flex justify-between items-center text-[0.65rem] font-black uppercase tracking-widest text-muted">
            <span className="flex items-center gap-2">
              <Loader2 size={10} className="animate-spin text-accent" />
              A processar GPX...
            </span>
            <span>{progress > 0 ? `${progress.toFixed(0)}%` : 'Aguarde'}</span>
          </div>
          <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden border border-border-glass-subtle">
            <div 
              className={`h-full bg-accent transition-all duration-300 rounded-full shadow-[0_0_12px_rgba(139,92,246,0.5)] ${
                progress > 0 ? '' : 'w-full animate-pulse'
              }`}
              style={{ width: progress > 0 ? `${progress}%` : '100%' }}
            />
          </div>
        </div>
      )}

      {selectedFile && !isUploading && (
        <div className="w-full p-4 rounded-2xl bg-green/5 border border-green/20 flex items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green/10 flex items-center justify-center text-green">
              <Upload size={16} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[0.8rem] font-black text-text truncate max-w-[200px]" title={selectedFile.name}>
                {selectedFile.name}
              </span>
              <span className="text-[0.65rem] font-bold text-green uppercase tracking-widest opacity-80">
                {(selectedFile.size / 1024).toFixed(1)} KB · Carregado ✓
              </span>
            </div>
          </div>
          <button 
            className="w-8 h-8 rounded-lg bg-panel hover:bg-red/10 border border-border-glass-subtle text-muted hover:text-red flex items-center justify-center transition-all" 
            onClick={(e) => {
              e.stopPropagation();
              clearFile();
            }}
            title="Remover ficheiro"
            aria-label="Remover ficheiro selecionado"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}