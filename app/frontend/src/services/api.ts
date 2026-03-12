import axios from 'axios';
import { User, Motorcycle, Trip, TripEvent } from '../types';

const API_BASE = '/api';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para adicionar JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth endpoints
export const authAPI = {
  login: (email: string, password: string) =>
    api.post<{ user: User; token: string }>('/auth/login', { email, password }),
  
  register: (email: string, password: string, name: string) =>
    api.post<{ user: User; token: string }>('/auth/register', { email, password, name }),

  forgotPassword: (email: string) =>
    api.post<{ message: string }>('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    api.post<{ message: string }>('/auth/reset-password', { token, newPassword }),

  verifyResetToken: (token: string) =>
    api.get<{ valid: boolean }>('/auth/verify-reset-token/' + token),
};

// Trips endpoints
export const tripsAPI = {
  getAll: () =>
    api.get<Trip[]>('/trips'),
  
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
  
  getProfiles: () =>
    api.get<any[]>('/motorcycle-profiles'),
};

// Telemetry endpoints
export const telemetryAPI = {
  getLatest: () =>
    api.get<any>('/telemetry/latest'),
};
