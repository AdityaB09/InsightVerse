import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Use VITE_API_URL to point at your API (defaults to http://localhost:8080)
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  }
});
