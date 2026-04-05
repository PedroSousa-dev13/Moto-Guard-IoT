import { useEffect, useRef, RefObject } from "react";

export interface VideoPlayerProps {
  videoFile: File | null;
  videoRef: RefObject<HTMLVideoElement>;
  onFileSelect: (file: File) => void;
}

export default function VideoPlayer({ videoFile, videoRef, onFileSelect }: VideoPlayerProps) {
  const objectUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Create objectURL when videoFile changes; revoke previous one on cleanup
  useEffect(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }

    if (!videoFile) return;

    const url = URL.createObjectURL(videoFile);
    objectUrlRef.current = url;

    if (videoRef.current) {
      videoRef.current.src = url;
      videoRef.current.load();
    }

    return () => {
      URL.revokeObjectURL(url);
      objectUrlRef.current = null;
    };
  }, [videoFile, videoRef]);

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) onFileSelect(file);
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "video/mp4") onFileSelect(file);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  if (!videoFile) {
    return (
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        style={{
          width: "100%",
          height: "100%",
          minHeight: 200,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          border: "2px dashed #4b5563",
          borderRadius: 8,
          background: "#111827",
          color: "#9ca3af",
          cursor: "pointer",
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={40}
          height={40}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polygon points="23 7 16 12 23 17 23 7" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
        <span style={{ fontSize: 14, fontWeight: 500 }}>Selecionar vídeo .mp4</span>
        <span style={{ fontSize: 12 }}>Arraste aqui ou clique para escolher</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4"
          style={{ display: "none" }}
          onChange={handleFileInputChange}
        />
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* Hidden file input for re-selection */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4"
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />

      {/*
        We expose native volume and fullscreen controls via the `controls` attribute.
        Play/pause/seek are managed programmatically by the parent (Playback_Controller).
        We hide the timeline/progress bar and play button via CSS while keeping
        volume and fullscreen controls visible.
      */}
      <style>{`
        .real-sim-video::-webkit-media-controls-timeline { display: none !important; }
        .real-sim-video::-webkit-media-controls-play-button { display: none !important; }
        .real-sim-video::-webkit-media-controls-current-time-display { display: none !important; }
        .real-sim-video::-webkit-media-controls-time-remaining-display { display: none !important; }
        .real-sim-video::-webkit-media-controls-seek-back-button { display: none !important; }
        .real-sim-video::-webkit-media-controls-seek-forward-button { display: none !important; }
        .real-sim-video::-webkit-media-controls-rewind-button { display: none !important; }
        .real-sim-video::-webkit-media-controls-return-to-realtime-button { display: none !important; }
        .real-sim-video::-webkit-media-controls-toggle-closed-captions-button { display: none !important; }
      `}</style>

      <video
        ref={videoRef}
        className="real-sim-video"
        controls
        controlsList="nodownload noremoteplayback"
        style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
        playsInline
      />

      {/* Button to swap video file */}
      <button
        onClick={() => fileInputRef.current?.click()}
        title="Trocar vídeo"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          background: "rgba(0,0,0,0.6)",
          border: "1px solid #4b5563",
          borderRadius: 4,
          color: "#d1d5db",
          padding: "4px 8px",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Trocar vídeo
      </button>
    </div>
  );
}
