import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Em Docker o backend é alcançável como http://backend:3000.
// Localmente (fora de Docker) usa http://localhost:3000.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test/setup.ts"],
  },
  server: {
    port: 5173,
    host: true, // escutar em 0.0.0.0 para funcionar dentro de Docker
    proxy: {
      // Proxy API calls para o backend Node.js
      "/api": {
        target: BACKEND_URL,
        changeOrigin: true,
      },
      // Proxy WebSocket (Socket.IO) para o backend
      "/socket.io": {
        target: BACKEND_URL,
        ws: true,
        changeOrigin: true,
      },
    },
  },
  build: {
    // Output para dist/ — o backend serve estes ficheiros em produção
    outDir: "dist",
    emptyOutDir: true,
  },
});
