import axios from 'axios';
import type { User, Motorcycle, Trip, TripFeedItem, TripTelemetryResponse, GpxImportResponse, TripEvaluationResponse } from '../types/index';

const API_BASE = '/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

function getStoredToken(): string | null {
  const rememberMe = localStorage.getItem("rememberMe") === "true";
  if (rememberMe) {
    return localStorage.getItem("token");
  }
  return (
    sessionStorage.getItem("session_token") ||
    sessionStorage.getItem("token") ||
    localStorage.getItem("token")
  );
}

// Interceptor para adicionar JWT token
api.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      window.dispatchEvent(new Event("auth:unauthorized"));
    }
    return Promise.reject(error);
  },
);

// Auth endpoints
export const authAPI = {
  login: (email: string, password: string) =>
    api.post<{ user: User; token: string }>('/auth/login', { email, password }),
  
  register: (email: string, password: string, name: string) =>
    api.post<{ user: User; token: string }>('/auth/register', { email, password, name }),

  me: () =>
    api.get<User>('/auth/me'),

  updateProfile: (data: { name?: string; email?: string; emergencyContact?: string | null }) =>
    api.put<User>('/auth/profile', data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.put<{ message: string }>('/auth/change-password', { currentPassword, newPassword }),

  saveResendApiKey: (apiKey: string | null) =>
    api.put<{ message: string; configured: boolean }>('/auth/resend-key', { apiKey }),

  getResendApiKeyStatus: () =>
    api.get<{ configured: boolean }>('/auth/resend-key/status'),

  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, newPassword }),

  verifyResetToken: (token: string) =>
    api.get<{ valid: boolean }>('/auth/verify-reset-token/' + token),
};

// Trips endpoints
export const tripsAPI = {
  getAll: (source?: Trip['source']) =>
    api.get<Trip[]>('/trips', {
      params: source ? { source } : undefined,
    }),
  
  getFeed: (source?: Trip["source"], limit?: number) =>
    api.get<TripFeedItem[]>("/trips/feed", {
      params: {
        ...(source ? { source } : {}),
        ...(limit ? { limit } : {}),
      },
    }),

  getById: (id: string) =>
    api.get<Trip>(`/trips/${id}`),
  
  getTelemetry: (tripId: string) =>
    api.get<TripTelemetryResponse>(`/telemetry/${tripId}`),

  getEvaluation: (tripId: string) =>
    api.get<TripEvaluationResponse>(`/trips/${tripId}/evaluation`),
};

// Motorcycles endpoints
export const motorcyclesAPI = {
  getAll: () =>
    api.get<Motorcycle[]>('/motorcycles'),
  
  create: (data: Partial<Motorcycle>) =>
    api.post<Motorcycle>('/motorcycles', data),

  update: (id: string, data: Partial<Motorcycle>) =>
    api.put<Motorcycle>(`/motorcycles/${id}`, data),

  remove: (id: string) =>
    api.delete<{ success: true }>(`/motorcycles/${id}`),
  
  getProfiles: () =>
    api.get<any[]>('/motorcycle-profiles'),
};

// Telemetry endpoints
export const telemetryAPI = {
  getLatest: () =>
    api.get<any>('/telemetry/latest'),
};

export const gpxAPI = {
  import: (file: File, motorcycleId?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (motorcycleId) {
      form.append("motorcycleId", motorcycleId);
    }
    return api.post<GpxImportResponse>("/gpx/import", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
  exportTrip: (tripId: string) =>
    api.get(`/gpx/export/${tripId}`, { responseType: "blob" }),
};

export const mlAPI = {
  getStatus: () => api.get<{ enabled: boolean; modelLoaded: boolean; modelVersion: string | null; trainedAt: string | null; nSamples: number | null }>("/ml/status"),
};

export const alertsAPI = {
  getAll: (params?: { severity?: string; type?: string; tripId?: string; limit?: number }) =>
    api.get<any[]>("/alerts", { params }),
};
