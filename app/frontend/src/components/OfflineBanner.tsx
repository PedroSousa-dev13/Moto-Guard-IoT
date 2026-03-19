import { useEffect, useState } from "react";
import { useSocket } from "../hooks/useSocket";
import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflineBanner() {
  const { status } = useSocket();
  const [visible, setVisible] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    if (!status.ws) {
      setVisible(true);
      setWasOffline(true);
      setReconnecting(true);
    } else if (wasOffline) {
      // Mostrar brevemente "reconectado" e depois esconder
      setReconnecting(false);
      const t = setTimeout(() => {
        setVisible(false);
        setWasOffline(false);
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [status.ws, wasOffline]);

  if (!visible) return null;

  return (
    <div
      className={`offline-banner ${reconnecting ? "offline-banner--offline" : "offline-banner--online"}`}
      role="status"
      aria-live="polite"
    >
      {reconnecting ? (
        <>
          <WifiOff size={15} />
          <span>Sem ligação ao servidor — a reconectar...</span>
          <span className="offline-banner__dot" />
        </>
      ) : (
        <>
          <RefreshCw size={15} />
          <span>Ligação restabelecida</span>
        </>
      )}
    </div>
  );
}
