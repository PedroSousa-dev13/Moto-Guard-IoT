// =============================================================================
// Testes: NotificationCenter component
// =============================================================================

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { saveAlerts, type AlertItem } from "../utils/alerts";

// ── Mock useNotifications ─────────────────────────────────────────────────────

const mockMarkAllRead = vi.fn();
const mockMarkRead = vi.fn();
const mockDismissToast = vi.fn();
const mockUseNotifications = vi.fn();

vi.mock("../hooks/useNotifications", () => ({
  useNotifications: () => mockUseNotifications(),
}));

// ── Mock react-router-dom navigate ────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// ── Mock lucide-react ─────────────────────────────────────────────────────────

vi.mock("lucide-react", () => ({
  Bell: () => <span data-testid="bell-icon" />,
  X: () => <span data-testid="x-icon" />,
  CheckCheck: () => <span data-testid="checkcheck-icon" />,
  ExternalLink: () => <span data-testid="external-link-icon" />,
}));

import NotificationCenter from "./NotificationCenter";

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultNotifState(overrides = {}) {
  return {
    unreadCount: 0,
    toast: null,
    dismissToast: mockDismissToast,
    markAllRead: mockMarkAllRead,
    markRead: mockMarkRead,
    refreshUnread: vi.fn(),
    ...overrides,
  };
}

function makeAlert(overrides: Partial<AlertItem> = {}): AlertItem {
  return {
    id: "a1",
    title: "HARD BRAKING",
    message: "Travagem brusca detetada",
    severity: "WARNING",
    status: "unread",
    timestamp: new Date().toISOString(),
    deviceId: "MOTOGUARD-SIM-01",
    ...overrides,
  };
}

function renderNC(notifState = defaultNotifState()) {
  mockUseNotifications.mockReturnValue(notifState);
  return render(
    <MemoryRouter>
      <NotificationCenter />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

// ─── Sino / badge ─────────────────────────────────────────────────────────────

describe("NotificationCenter — sino e badge", () => {
  it("renderiza o sino", () => {
    renderNC();
    expect(screen.getByTestId("bell-icon")).toBeInTheDocument();
  });

  it("não mostra badge quando unreadCount=0", () => {
    renderNC(defaultNotifState({ unreadCount: 0 }));
    expect(screen.queryByText(/\d+/)).not.toBeInTheDocument();
  });

  it("mostra badge com contagem quando unreadCount > 0", () => {
    renderNC(defaultNotifState({ unreadCount: 5 }));
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("mostra '99+' quando unreadCount > 99", () => {
    renderNC(defaultNotifState({ unreadCount: 150 }));
    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("botão do sino tem aria-label correto com contagem", () => {
    renderNC(defaultNotifState({ unreadCount: 3 }));
    expect(screen.getByRole("button", { name: /3 por ler/ })).toBeInTheDocument();
  });

  it("botão do sino tem aria-label sem contagem quando 0", () => {
    renderNC(defaultNotifState({ unreadCount: 0 }));
    expect(screen.getByRole("button", { name: "Notificações" })).toBeInTheDocument();
  });
});

// ─── Dropdown ─────────────────────────────────────────────────────────────────

describe("NotificationCenter — dropdown", () => {
  it("dropdown não visível inicialmente", () => {
    renderNC();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre dropdown ao clicar no sino", () => {
    renderNC();
    fireEvent.click(screen.getByRole("button", { name: /Notificações/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("fecha dropdown ao clicar novamente no sino", () => {
    renderNC();
    const btn = screen.getByRole("button", { name: /Notificações/ });
    fireEvent.click(btn);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(btn);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mostra estado vazio quando sem alertas", () => {
    renderNC();
    fireEvent.click(screen.getByRole("button", { name: /Notificações/ }));
    expect(screen.getByText("Sem notificações")).toBeInTheDocument();
  });

  it("mostra alertas do localStorage", () => {
    saveAlerts([makeAlert({ id: "a1", title: "CRASH DETECTED" })]);
    renderNC();
    fireEvent.click(screen.getByRole("button", { name: /Notificações/ }));
    expect(screen.getByText("CRASH DETECTED")).toBeInTheDocument();
  });

  it("mostra botão 'Todas lidas' quando unreadCount > 0", () => {
    renderNC(defaultNotifState({ unreadCount: 2 }));
    fireEvent.click(screen.getByRole("button", { name: /Notificações/ }));
    expect(screen.getByText("Todas lidas")).toBeInTheDocument();
  });

  it("não mostra botão 'Todas lidas' quando unreadCount = 0", () => {
    renderNC(defaultNotifState({ unreadCount: 0 }));
    fireEvent.click(screen.getByRole("button", { name: /Notificações/ }));
    expect(screen.queryByText("Todas lidas")).not.toBeInTheDocument();
  });

  it("chama markAllRead ao clicar 'Todas lidas'", () => {
    renderNC(defaultNotifState({ unreadCount: 3 }));
    fireEvent.click(screen.getByRole("button", { name: /Notificações/ }));
    fireEvent.click(screen.getByText("Todas lidas"));
    expect(mockMarkAllRead).toHaveBeenCalled();
  });
});

// ─── Clique em item ───────────────────────────────────────────────────────────

describe("NotificationCenter — clique em item", () => {
  it("chama markRead com o id do alerta", () => {
    saveAlerts([makeAlert({ id: "a42", tripId: "t1" })]);
    renderNC();
    fireEvent.click(screen.getByRole("button", { name: /Notificações/ }));
    fireEvent.click(screen.getByText("HARD BRAKING"));
    expect(mockMarkRead).toHaveBeenCalledWith("a42");
  });

  it("navega para /trips/:id quando alerta tem tripId", () => {
    saveAlerts([makeAlert({ id: "a1", tripId: "trip-xyz" })]);
    renderNC();
    fireEvent.click(screen.getByRole("button", { name: /Notificações/ }));
    fireEvent.click(screen.getByText("HARD BRAKING"));
    expect(mockNavigate).toHaveBeenCalledWith("/trips/trip-xyz");
  });

  it("navega para /alertas quando alerta não tem tripId", () => {
    saveAlerts([makeAlert({ id: "a1", tripId: undefined })]);
    renderNC();
    fireEvent.click(screen.getByRole("button", { name: /Notificações/ }));
    fireEvent.click(screen.getByText("HARD BRAKING"));
    expect(mockNavigate).toHaveBeenCalledWith("/alertas");
  });

  it("fecha dropdown após clicar num item", () => {
    saveAlerts([makeAlert({ id: "a1" })]);
    renderNC();
    fireEvent.click(screen.getByRole("button", { name: /Notificações/ }));
    fireEvent.click(screen.getByText("HARD BRAKING"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

// ─── Toast ────────────────────────────────────────────────────────────────────

describe("NotificationCenter — toast", () => {
  it("não renderiza toast quando toast=null", () => {
    renderNC(defaultNotifState({ toast: null }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("renderiza toast CRITICAL", () => {
    renderNC(defaultNotifState({
      toast: {
        id: "t1",
        title: "CRASH DETECTED",
        message: "Queda detetada",
        severity: "CRITICAL",
        timestamp: new Date().toISOString(),
      },
    }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("CRASH DETECTED")).toBeInTheDocument();
    expect(screen.getByText("Queda detetada")).toBeInTheDocument();
  });

  it("renderiza toast WARNING", () => {
    renderNC(defaultNotifState({
      toast: {
        id: "t1",
        title: "OVERHEAT",
        message: "Motor a sobrequecer",
        severity: "WARNING",
        timestamp: new Date().toISOString(),
      },
    }));
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("OVERHEAT")).toBeInTheDocument();
  });

  it("toast CRITICAL tem classe notif-toast-critical", () => {
    renderNC(defaultNotifState({
      toast: {
        id: "t1", title: "CRASH", message: "msg",
        severity: "CRITICAL", timestamp: new Date().toISOString(),
      },
    }));
    const toast = screen.getByRole("alert");
    expect(toast.className).toContain("notif-toast-critical");
  });

  it("toast WARNING tem classe notif-toast-warning", () => {
    renderNC(defaultNotifState({
      toast: {
        id: "t1", title: "OVERHEAT", message: "msg",
        severity: "WARNING", timestamp: new Date().toISOString(),
      },
    }));
    const toast = screen.getByRole("alert");
    expect(toast.className).toContain("notif-toast-warning");
  });

  it("chama dismissToast ao clicar no X do toast", () => {
    renderNC(defaultNotifState({
      toast: {
        id: "t1", title: "CRASH", message: "msg",
        severity: "CRITICAL", timestamp: new Date().toISOString(),
      },
    }));
    fireEvent.click(screen.getByLabelText("Fechar notificação"));
    expect(mockDismissToast).toHaveBeenCalled();
  });

  it("mostra botão 'Ver viagem' quando toast tem tripId", () => {
    renderNC(defaultNotifState({
      toast: {
        id: "t1", title: "CRASH", message: "msg",
        severity: "CRITICAL", tripId: "trip-99",
        timestamp: new Date().toISOString(),
      },
    }));
    expect(screen.getByText("Ver viagem")).toBeInTheDocument();
  });

  it("não mostra botão 'Ver viagem' quando toast não tem tripId", () => {
    renderNC(defaultNotifState({
      toast: {
        id: "t1", title: "CRASH", message: "msg",
        severity: "CRITICAL", timestamp: new Date().toISOString(),
      },
    }));
    expect(screen.queryByText("Ver viagem")).not.toBeInTheDocument();
  });

  it("'Ver viagem' navega para /trips/:id e fecha toast", () => {
    renderNC(defaultNotifState({
      toast: {
        id: "t1", title: "CRASH", message: "msg",
        severity: "CRITICAL", tripId: "trip-42",
        timestamp: new Date().toISOString(),
      },
    }));
    fireEvent.click(screen.getByText("Ver viagem"));
    expect(mockNavigate).toHaveBeenCalledWith("/trips/trip-42");
    expect(mockDismissToast).toHaveBeenCalled();
  });
});

// ─── Acessibilidade ───────────────────────────────────────────────────────────

describe("NotificationCenter — acessibilidade", () => {
  it("dropdown tem role=dialog", () => {
    renderNC();
    fireEvent.click(screen.getByRole("button", { name: /Notificações/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("toast tem role=alert e aria-live=assertive", () => {
    renderNC(defaultNotifState({
      toast: {
        id: "t1", title: "CRASH", message: "msg",
        severity: "CRITICAL", timestamp: new Date().toISOString(),
      },
    }));
    const toast = screen.getByRole("alert");
    expect(toast.getAttribute("aria-live")).toBe("assertive");
  });

  it("botão sino tem aria-expanded=false quando fechado", () => {
    renderNC();
    const btn = screen.getByRole("button", { name: /Notificações/ });
    expect(btn.getAttribute("aria-expanded")).toBe("false");
  });

  it("botão sino tem aria-expanded=true quando aberto", () => {
    renderNC();
    const btn = screen.getByRole("button", { name: /Notificações/ });
    fireEvent.click(btn);
    expect(btn.getAttribute("aria-expanded")).toBe("true");
  });
});
