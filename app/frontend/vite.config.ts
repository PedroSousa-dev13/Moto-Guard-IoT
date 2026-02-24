import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls para o backend Node.js
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      // Proxy WebSocket (Socket.IO) para o backend
      "/socket.io": {
        target: "http://localhost:3000",
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
