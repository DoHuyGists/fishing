
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";

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

  optimizeDeps: {
    include: [
      "@tiptap/vue-3",
      "@tiptap/starter-kit",
      "@tiptap/extension-paragraph",
      "@tiptap/extension-image",
      "@tiptap/extension-list",
      "dompurify",
    ],
  },

  build: {
    target: "es2022",
    chunkSizeWarningLimit: 600,

    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Vue ecosystem
            {
              name: "vendor-vue",
              test: /node_modules[\\/](?:vue|@vue|vue-router|pinia)[\\/]/,
            },

            // Internationalization
            {
              name: "vendor-i18n",
              test: /node_modules[\\/](?:vue-i18n|@intlify)[\\/]/,
            },

            // Supabase
            {
              name: "vendor-supabase",
              test: /node_modules[\\/]@supabase[\\/]/,
            },

            // Tiptap editor + ProseMirror
            {
              name: "vendor-tiptap",
              test: /node_modules[\\/](?:@tiptap|@prosemirror|prosemirror-)/,
            },

            // Charts
            {
              name: "vendor-charts",
              test: /node_modules[\\/](?:chart\.js|vue-chartjs|@kurkle)[\\/]/,
            },

            // D3 and map libraries
            {
              name: "vendor-map",
              test: /node_modules[\\/](?:d3(?:-[^\\/]*)?|topojson(?:-[^\\/]*)?|world-atlas|internmap)[\\/]/,
            },

            // Utilities
            {
              name: "vendor-utils",
              test: /node_modules[\\/](?:dayjs|dompurify)[\\/]/,
            },
          ],
        },
      },
    },
  },
});
