import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === "build" ? "./" : "/",
  server: {
    port: 5173,
    host: true,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      "/result": {
        target: "https://hiokiekiden.com",
        changeOrigin: true,
      },
    },
  },
}));
