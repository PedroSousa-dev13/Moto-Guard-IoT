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
        className="w-full h-full min-h-[300px] flex flex-col items-center justify-center gap-4 border-2 border-dashed border-border-glass-subtle rounded-[2rem] bg-panel text-muted hover:bg-panel-hover hover:border-border-glass transition-all cursor-pointer group"
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="p-5 rounded-2xl bg-white/5 text-muted group-hover:text-accent group-hover:bg-accent/10 transition-all">
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
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm font-black text-text uppercase tracking-widest">Selecionar vídeo .mp4</span>
          <span className="text-[0.65rem] font-medium text-muted opacity-40 uppercase tracking-widest">Arraste aqui ou clique para escolher</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4"
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full relative group">
      {/* Hidden file input for re-selection */}
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4"
        className="hidden"
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
        className="real-sim-video w-full h-full object-contain bg-black rounded-[2rem] shadow-2xl"
        controls
        controlsList="nodownload noremoteplayback"
        playsInline
      />

      {/* Button to swap video file */}
      <button
        onClick={() => fileInputRef.current?.click()}
        title="Trocar vídeo"
        className="absolute top-6 right-6 px-4 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10 text-white text-[0.6rem] font-black uppercase tracking-widest hover:bg-black/80 hover:scale-105 active:scale-95 transition-all opacity-0 group-hover:opacity-100"
      >
        Trocar vídeo
      </button>
    </div>
  );
}
