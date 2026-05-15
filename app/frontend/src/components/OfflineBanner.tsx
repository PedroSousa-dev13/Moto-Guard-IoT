import { useEffect, useRef, useState } from "react";
import { useSocket } from "../hooks/useSocket";
import { WifiOff, RefreshCw } from "lucide-react";

const OFFLINE_GRACE_MS = 5000;
const RECONNECT_SHOW_MS = 2500;

export default function OfflineBanner() {
  const { status } = useSocket();
  const [visible, setVisible] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [hasConnectedOnce, setHasConnectedOnce] = useState(false);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (status.ws) {
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }
      if (!hasConnectedOnce) {
        setHasConnectedOnce(true);
        return;
      }
      if (wasOffline) {
        setReconnecting(false);
        const t = setTimeout(() => {
          setVisible(false);
          setWasOffline(false);
        }, RECONNECT_SHOW_MS);
        return () => clearTimeout(t);
      }
    } else if (hasConnectedOnce && !graceTimerRef.current) {
      graceTimerRef.current = setTimeout(() => {
        graceTimerRef.current = null;
        setVisible(true);
        setWasOffline(true);
        setReconnecting(true);
      }, OFFLINE_GRACE_MS);
    }
  }, [status.ws, wasOffline, hasConnectedOnce]);

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
