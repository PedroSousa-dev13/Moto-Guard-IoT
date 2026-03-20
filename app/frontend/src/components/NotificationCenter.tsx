// =============================================================================
// MotoGuard IoT — Componente: NotificationCenter
// =============================================================================
// Sino no Navbar com dropdown de notificações recentes + toast global.
// =============================================================================

import React, { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Bell, X, CheckCheck, ExternalLink } from "lucide-react";
import { loadAlerts, saveAlerts, type AlertItem } from "../utils/alerts";
import { useNotifications } from "../hooks/useNotifications";

function timeAgo(ts: string): string {
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function severityColor(sev: AlertItem["severity"]): string {
  switch (sev) {
    case "CRITICAL": return "var(--red)";
    case "WARNING": return "var(--yellow)";
    default: return "var(--accent)";
  }
}

function severityBg(sev: AlertItem["severity"]): string {
  switch (sev) {
    case "CRITICAL": return "var(--red-bg)";
    case "WARNING": return "var(--yellow-bg)";
    default: return "var(--accent-light)";
  }
}

export default function NotificationCenter() {
  const navigate = useNavigate();
  const { unreadCount, toast, dismissToast, markAllRead, markRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [dropdownPos, setDropdownPos] = useState({ top: 70, right: 24 });
  const dropdownRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  const refreshAlerts = useCallback(() => {
    setAlerts(loadAlerts().slice(0, 30));
  }, []);

  useEffect(() => {
    refreshAlerts();
    const onUpdate = () => refreshAlerts();
    window.addEventListener("motoguard:alerts", onUpdate);
    return () => window.removeEventListener("motoguard:alerts", onUpdate);
  }, [refreshAlerts]);

  // Fechar ao clicar fora
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleOpen = () => {
    if (!open && bellRef.current) {
      const rect = bellRef.current.getBoundingClientRect();
      setDropdownPos({
        top: rect.bottom + 10,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
    setOpen((v) => !v);
  };

  const handleItemClick = (alert: AlertItem) => {
    markRead(alert.id);
    setOpen(false);
    if (alert.tripId) {
      navigate(`/trips/${alert.tripId}`);
    } else {
      navigate("/alertas");
    }
  };

  const handleMarkAllRead = () => {
    markAllRead();
    refreshAlerts();
  };

  return (
    <>
      {/* ── Sino ── */}
      <div style={{ position: "relative" }}>
        <button
          ref={bellRef}
          className="nav-icon-link nav-bell"
          onClick={handleOpen}
          aria-label={`Notificações${unreadCount > 0 ? ` — ${unreadCount} por ler` : ""}`}
          aria-expanded={open}
          aria-haspopup="true"
        >
          <Bell size={20} />
          {unreadCount > 0 && (
            <span className="nav-badge" aria-hidden="true">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* ── Dropdown via Portal (escapa qualquer stacking context) ── */}
        {open && createPortal(
          <div
            ref={dropdownRef}
            className="notif-dropdown"
            role="dialog"
            aria-label="Centro de notificações"
            style={{ top: dropdownPos.top, right: dropdownPos.right }}
          >
            <div className="notif-header">
              <span className="notif-title">Notificações</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                {unreadCount > 0 && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleMarkAllRead}
                    title="Marcar todas como lidas"
                    style={{ padding: "4px 8px", fontSize: "0.75rem" }}
                  >
                    <CheckCheck size={14} />
                    Todas lidas
                  </button>
                )}
                <button
                  className="nav-icon-link"
                  onClick={() => { setOpen(false); navigate("/alertas"); }}
                  title="Ver todos os alertas"
                  style={{ width: 28, height: 28 }}
                >
                  <ExternalLink size={14} />
                </button>
              </div>
            </div>

            <div className="notif-list" role="list">
              {alerts.length === 0 ? (
                <div className="notif-empty">
                  <span style={{ fontSize: "1.5rem" }}>🔔</span>
                  <span>Sem notificações</span>
                </div>
              ) : (
                alerts.map((a) => (
                  <button
                    key={a.id}
                    role="listitem"
                    className={`notif-item ${a.status === "unread" ? "notif-unread" : ""}`}
                    onClick={() => handleItemClick(a)}
                    aria-label={`${a.title} — ${a.severity} — ${a.status === "unread" ? "Por ler" : "Lida"}`}
                  >
                    <div
                      className="notif-dot"
                      style={{ background: a.status === "unread" ? severityColor(a.severity) : "transparent", border: `2px solid ${severityColor(a.severity)}` }}
                    />
                    <div className="notif-content">
                      <div className="notif-item-header">
                        <span className="notif-item-title">{a.title}</span>
                        <span className="notif-time">{timeAgo(a.timestamp)}</span>
                      </div>
                      <div className="notif-item-msg">{a.message}</div>
                      <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
                        <span
                          className="pill"
                          style={{
                            background: severityBg(a.severity),
                            color: severityColor(a.severity),
                            border: `1px solid ${severityColor(a.severity)}30`,
                            fontSize: "0.65rem",
                            padding: "2px 7px",
                          }}
                        >
                          {a.severity}
                        </span>
                        {(a.meta as any)?.predictive && (
                          <span className="pill" style={{ background: "var(--accent-light)", color: "var(--accent)", fontSize: "0.65rem", padding: "2px 7px" }}>
                            📈 Preditivo
                          </span>
                        )}
                        {a.deviceId && (
                          <span style={{ fontSize: "0.68rem", color: "var(--muted)", fontFamily: "monospace" }}>
                            {a.deviceId}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {alerts.length > 0 && (
              <div className="notif-footer">
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ width: "100%", justifyContent: "center", fontSize: "0.8rem" }}
                  onClick={() => { setOpen(false); navigate("/alertas"); }}
                >
                  Ver todos os alertas
                </button>
              </div>
            )}
          </div>
        , document.body)}
      </div>

      {/* ── Toast global ── */}
      {toast && (
        <div
          className={`notif-toast notif-toast-${toast.severity.toLowerCase()}`}
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div className="notif-toast-body">
            <div className="notif-toast-icon">
              {toast.predictive ? "📈" : toast.severity === "CRITICAL" ? "🚨" : "⚠️"}
            </div>
            <div className="notif-toast-content">
              <div className="notif-toast-title">{toast.title}</div>
              <div className="notif-toast-msg">{toast.message}</div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              {toast.tripId && (
                <button
                  className="btn btn-sm"
                  style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.2)", color: "white", padding: "4px 10px", fontSize: "0.75rem" }}
                  onClick={() => { dismissToast(); navigate(`/trips/${toast.tripId}`); }}
                >
                  Ver viagem
                </button>
              )}
              <button
                className="nav-icon-link"
                onClick={dismissToast}
                aria-label="Fechar notificação"
                style={{ color: "rgba(255,255,255,0.7)", width: 28, height: 28 }}
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
