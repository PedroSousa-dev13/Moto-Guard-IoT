import React, { useState, useRef } from 'react';
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
    <div className="gpx-file-upload">
      <input
        ref={fileInputRef}
        type="file"
        accept=".gpx"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />
      
      <div
        className={`gpx-upload-area ${isDragOver ? 'drag-over' : ''} ${disabled || isUploading ? 'disabled' : ''}`}
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
        <div className="gpx-upload-icon">
          {isUploading ? (
            <Loader2 size={32} className="animate-spin" />
          ) : (
            <Upload size={32} />
          )}
        </div>
        
        <div className="gpx-upload-text">
          <div className="gpx-upload-primary">
            {isUploading 
              ? 'A carregar ficheiro...' 
              : isDragOver
                ? 'Solta o ficheiro aqui'
                : 'Arrasta um ficheiro GPX ou clica para selecionar'
            }
          </div>
          <div className="gpx-upload-secondary">
            Máximo 10MB • Apenas ficheiros .gpx
          </div>
        </div>
      </div>

      {isUploading && (
        <div className="gpx-upload-progress">
          <div 
            className={`gpx-progress-bar${progress > 0 ? '' : ' gpx-progress-indeterminate'}`}
            role="progressbar"
            aria-valuenow={progress > 0 ? progress : undefined}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progresso do upload do ficheiro GPX"
          >
            <div 
              className="gpx-progress-fill" 
              style={{ width: progress > 0 ? `${progress}%` : '100%' }}
            />
          </div>
          {progress > 0 && (
            <div className="gpx-progress-text">
              {progress.toFixed(0)}%
            </div>
          )}
        </div>
      )}

      {selectedFile && !isUploading && (
        <div className="gpx-selected-file gpx-upload-success">
          <div className="gpx-file-info">
            <div className="gpx-file-name">{selectedFile.name}</div>
            <div className="gpx-file-size">
              {(selectedFile.size / 1024).toFixed(1)} KB · Ficheiro carregado ✓
            </div>
          </div>
          <button 
            className="btn-icon-clear" 
            onClick={clearFile}
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