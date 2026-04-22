import { useEffect, useState } from "react";
import { AlertTriangle, Check, ShieldAlert, Volume2 } from "lucide-react";

interface SOSCountdownProps {
  deviceId: string;
  initialSeconds: number;
  onCancel: (deviceId: string) => void;
}

export default function SOSCountdown({ deviceId, initialSeconds, onCancel }: SOSCountdownProps) {
  const [seconds, setSeconds] = useState(initialSeconds);
  const [isCancelled, setIsCancelled] = useState(false);

  useEffect(() => {
    if (seconds <= 0 || isCancelled) return;

    const timer = setInterval(() => {
      setSeconds((s) => Math.max(0, s - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [seconds, isCancelled]);

  // Efeito sonoro de alerta (beep)
  useEffect(() => {
    if (seconds <= 0 || isCancelled) return;
    
    // Tenta reproduzir um som do sistema se disponível, ou apenas vibração visual
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(seconds < 5 ? 880 : 440, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.start();
    setTimeout(() => oscillator.stop(), 200);

    return () => {
      oscillator.disconnect();
      audioContext.close();
    };
  }, [seconds, isCancelled]);

  if (seconds <= 0 && !isCancelled) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
        <div className="bg-red/10 border-2 border-red/30 rounded-3xl p-10 max-w-md w-full text-center flex flex-col items-center gap-6 shadow-2xl shadow-red/20">
          <div className="w-20 h-20 rounded-full bg-red text-white flex items-center justify-center animate-pulse">
            <ShieldAlert size={48} />
          </div>
          <div className="flex flex-col gap-2">
            <h2 className="text-3xl font-black text-text m-0">ALERTA ENVIADO</h2>
            <p className="text-muted font-bold m-0 uppercase tracking-widest text-xs">A ajuda está a caminho</p>
          </div>
          <p className="text-text/80 text-sm leading-relaxed">
            O tempo de cancelamento expirou. O email de emergência foi enviado para os teus contactos.
          </p>
          <button 
            onClick={() => setIsCancelled(true)}
            className="mt-4 w-full py-4 rounded-2xl bg-white/5 border border-white/10 text-text font-black hover:bg-white/10 transition-all"
          >
            FECHAR
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl animate-fade-in overflow-hidden">
      {/* Background pulsating effect */}
      <div className="absolute inset-0 bg-red/5 animate-pulse" />
      
      <div className="relative bg-surface/40 border-2 border-red/40 rounded-[2.5rem] p-10 max-w-md w-full text-center flex flex-col items-center gap-8 shadow-2xl shadow-red/20 overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-red/20 blur-[80px] -z-10" />
        
        <div className="flex items-center gap-2 px-4 py-1 rounded-full bg-red/10 border border-red/20 text-red text-[0.6rem] font-black uppercase tracking-[0.2em] animate-bounce">
          <AlertTriangle size={12} /> Deteção de Queda
        </div>

        <div className="relative w-40 h-40 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="80" cy="80" r="70"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="8"
              className="text-white/5"
            />
            <circle
              cx="80" cy="80" r="70"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="8"
              strokeDasharray={440}
              strokeDashoffset={440 - (440 * seconds) / initialSeconds}
              className="text-red transition-all duration-1000 ease-linear"
              strokeLinecap="round"
            />
          </svg>
          <div className="flex flex-col items-center justify-center">
            <span className="text-6xl font-black text-text tabular-nums tracking-tighter">
              {seconds}
            </span>
            <span className="text-[0.6rem] font-black text-muted uppercase tracking-[0.2em]">Segundos</span>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-2xl font-black text-text m-0 tracking-tight">Estás bem?</h2>
          <p className="text-muted text-sm font-medium leading-relaxed m-0">
            Detetámos uma queda. Iremos enviar um alerta de emergência se não cancelares este aviso.
          </p>
        </div>

        <div className="w-full flex flex-col gap-4">
          <button 
            onClick={() => {
              setIsCancelled(true);
              onCancel(deviceId);
            }}
            className="w-full py-5 rounded-3xl bg-green text-white font-black text-lg shadow-xl shadow-green/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 group"
          >
            <Check size={24} className="group-hover:scale-125 transition-transform" /> ESTOU BEM
          </button>
          
          <div className="flex items-center justify-center gap-2 text-muted text-[0.65rem] font-bold uppercase tracking-widest">
            <Volume2 size={14} className="animate-pulse" /> Aviso sonoro ativo
          </div>
        </div>
      </div>
    </div>
  );
}
