import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === "model-viewer",
        },
      },
    }),
    tailwindcss(),
  ],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Tách các thư viện bên thứ ba thành các file riêng biệt
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("vue") || id.includes("vue-router") || id.includes("pinia")) {
              return "vendor-vue";
            }
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }
            if (id.includes("d3") || id.includes("topojson") || id.includes("world-atlas")) {
              return "vendor-map-d3";
            }
            if (id.includes("dayjs")) {
              return "vendor-utils";
            }
            return "vendor";
          }
        },
      },
    },
  },
});
