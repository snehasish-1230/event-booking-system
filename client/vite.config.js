import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiOrigin = new URL(
    env.VITE_API_URL_LOCAL || '/api',
    'http://localhost:5002'
  ).origin;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5175,
      strictPort: true,
      proxy: {
        "/api": {
          target: apiOrigin,
          changeOrigin: true,
        },
        "/uploads": {
          target: apiOrigin,
          changeOrigin: true,
        },
      },
    },
  };
});
