import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && (await import("lovable-tagger")).componentTagger(),
    // Stage 2 — JS budget. Emit pre-compressed .br and .gz next to every static
    // asset so the CDN can serve them without runtime compression cost.
    // Modern browsers prefer brotli, older ones fall back to gzip.
    mode === "production" && (await import("vite-plugin-compression")).default({
      algorithm: "brotliCompress",
      ext: ".br",
      threshold: 1024,
      deleteOriginFile: false,
    }),
    mode === "production" && (await import("vite-plugin-compression")).default({
      algorithm: "gzip",
      ext: ".gz",
      threshold: 1024,
      deleteOriginFile: false,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["@tanstack/react-virtual"],
  },
  // Strip console.* and debugger statements from production builds (prod only).
  // Keeps dev logs intact for debugging.
  esbuild: mode === "production" ? { drop: ["console", "debugger"] as ("console" | "debugger")[] } : undefined,
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Manual vendor chunk splitting cuts initial JS size dramatically.
        // Heavy libs (three, mermaid, pdf, excel) load only when their features run.
        manualChunks: {
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "radix-vendor": [
            "@radix-ui/react-accordion",
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-aspect-ratio",
            "@radix-ui/react-avatar",
            "@radix-ui/react-checkbox",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-context-menu",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-hover-card",
            "@radix-ui/react-label",
            "@radix-ui/react-menubar",
            "@radix-ui/react-navigation-menu",
            "@radix-ui/react-popover",
            "@radix-ui/react-progress",
            "@radix-ui/react-radio-group",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slider",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-toggle",
            "@radix-ui/react-toggle-group",
            "@radix-ui/react-tooltip",
          ],
          "query-vendor": [
            "@tanstack/react-query",
            "@tanstack/react-table",
            "@tanstack/react-virtual",
          ],
          "supabase-vendor": ["@supabase/supabase-js"],
          "charts-vendor": ["recharts"],
          "three-vendor": ["three", "@react-three/fiber", "@react-three/drei"],
          "pdf-vendor": ["jspdf", "jspdf-autotable", "html2canvas"],
          "excel-vendor": ["exceljs"],
          "mermaid-vendor": ["mermaid"],
        },
      },
    },
  },
}));
