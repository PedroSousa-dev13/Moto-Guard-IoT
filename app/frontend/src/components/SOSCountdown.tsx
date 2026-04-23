import { useEffect, useState } from "react";
import { AlertTriangle, Check, ShieldAlert, Volume2 } from "lucide-react";
import { useI18n } from "../i18n";

interface SOSCountdownProps {
  deviceId: string;
  initialSeconds: number;
  onCancel: (deviceId: string) => void;
}

export default function SOSCountdown({ deviceId, initialSeconds, onCancel }: SOSCountdownProps) {
  const { t } = useI18n();
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl animate-fade-in">
          <div className="bg-surface/80 border-2 border-red/50 rounded-[3rem] p-12 max-w-md w-full text-center flex flex-col items-center gap-8 shadow-[0_0_100px_rgba(239,68,68,0.2)]">
            <div className="w-24 h-24 rounded-full bg-red text-white flex items-center justify-center animate-pulse shadow-xl shadow-red/20">
              <ShieldAlert size={56} />
            </div>
            <div className="flex flex-col gap-3">
              <h2 className="text-4xl font-black text-white m-0 tracking-tighter uppercase">{t('sos.sentTitle')}</h2>
              <p className="text-red font-black m-0 uppercase tracking-[0.3em] text-xs">{t('sos.sentSubtitle')}</p>
            </div>
            <p className="text-white/90 text-lg font-medium leading-relaxed">
              {t('sos.sentMessage')}
            </p>
            <button 
              onClick={() => setIsCancelled(true)}
              className="mt-4 w-full py-5 rounded-3xl bg-white text-black font-black text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
            >
              {t('common.close').toUpperCase()}
            </button>
          </div>
        </div>
      );
    }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl animate-fade-in overflow-hidden">
      {/* Background pulsating effect */}
      <div className="absolute inset-0 bg-red/10 animate-pulse" />
      
      <div className="relative bg-surface/60 border-2 border-red/60 rounded-[3.5rem] p-12 max-w-md w-full text-center flex flex-col items-center gap-10 shadow-[0_0_150px_rgba(239,68,68,0.3)] overflow-hidden">
        {/* Glow effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-40 bg-red/30 blur-[100px] -z-10" />
        
        <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-red text-white text-[0.7rem] font-black uppercase tracking-[0.25em] shadow-lg shadow-red/20 animate-bounce">
          <AlertTriangle size={16} /> {t('sos.title')}
        </div>

        <div className="relative w-48 h-48 flex items-center justify-center">
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            <circle
              cx="96" cy="96" r="86"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="12"
              className="text-white/10"
            />
            <circle
              cx="96" cy="96" r="86"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="12"
              strokeDasharray={540}
              strokeDashoffset={540 - (540 * seconds) / initialSeconds}
              className="text-red transition-all duration-1000 ease-linear"
              strokeLinecap="round"
            />
          </svg>
          <div className="flex flex-col items-center justify-center">
            <span className="text-7xl font-black text-white tabular-nums tracking-tighter">
              {seconds}
            </span>
            <span className="text-[0.75rem] font-black text-white/60 uppercase tracking-[0.25em] mt-1">{t('sos.seconds')}</span>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-4xl font-black text-white m-0 tracking-tight">{t('sos.question')}</h2>
          <p className="text-white/80 text-lg font-medium leading-relaxed m-0">
            {t('sos.message')}
          </p>
        </div>

        <div className="w-full flex flex-col gap-5">
          <button 
            onClick={() => {
              setIsCancelled(true);
              onCancel(deviceId);
            }}
            className="w-full py-6 rounded-[2rem] bg-green text-white font-black text-xl shadow-2xl shadow-green/30 hover:scale-[1.03] active:scale-95 transition-all flex items-center justify-center gap-4 group"
          >
            <Check size={28} className="group-hover:scale-125 transition-transform" /> {t('sos.button')}
          </button>
          
          <div className="flex items-center justify-center gap-3 text-white/40 text-[0.7rem] font-black uppercase tracking-[0.2em]">
            <Volume2 size={18} className="animate-pulse" /> {t('sos.audioActive')}
          </div>
        </div>
      </div>
    </div>
  );
}
