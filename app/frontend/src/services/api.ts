import axios from 'axios';
import { User, Motorcycle, Trip, TripEvent } from '../types';

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
  
  getById: (id: string) =>
    api.get<Trip>(`/trips/${id}`),
  
  getTelemetry: (tripId: string) =>
    api.get<any[]>(`/telemetry/${tripId}`),
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
