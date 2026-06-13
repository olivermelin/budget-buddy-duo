import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: parseInt(process.env.PORT ?? "8080"),
    hmr: {
      overlay: false,
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  optimizeDeps: {
    // Sidorna laddas lazy (React.lazy), så Vite skulle annars upptäcka deras
    // beroenden (recharts, radix m.fl.) först vid navigering och köra om-optimering
    // + omladdning mitt i sessionen. Crawla alla källfiler vid start i stället.
    entries: ["index.html", "src/**/*.{ts,tsx}"],
  },
}));
