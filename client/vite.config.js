import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // The backend serves this folder directly, so the build output lands
    // right next to the server code instead of inside client/.
    outDir: "../server/public",
    emptyOutDir: true,
    minify: "esbuild",
    sourcemap: false,
  },
  server: {
    // While developing with `npm run dev`, proxy API calls to the backend
    // so the browser can use relative paths like /api/products.
    proxy: {
      "/api": "http://localhost:4000",
    },
  },
});
