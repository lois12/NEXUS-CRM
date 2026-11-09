import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Function form so package subpaths (three/examples/..., @codemirror/*) are
        // grouped too — the object form only matches the package entry module.
        // First match wins. Single-importer deps follow their importer chunk automatically.
        manualChunks(id: string) {
          // Vite's dynamic-import preload helper is shared by the entry and every lazy
          // chunk. Keep it in core vendor — otherwise Rollup may drop it into a heavy
          // lib chunk (e.g. vendor-docs) and force that chunk to preload at startup.
          if (id.includes('vite/preload-helper') || id.includes('preload-helper')) return 'vendor'
          if (!id.includes('node_modules')) return
          // three core + examples/jsm — shared by Dashboard, IdeaGraph and vanta effects
          if (id.includes('node_modules/three/')) return 'three'
          // force-graph 3D stack — only pulled in by IdeaGraph (lazy page)
          if (
            id.includes('node_modules/react-force-graph') ||
            id.includes('node_modules/3d-force-graph') ||
            id.includes('node_modules/force-graph')
          ) return 'vendor-graph'
          // charts
          if (id.includes('node_modules/recharts')) return 'vendor-charts'
          // editors (tiptap + codemirror)
          if (
            id.includes('node_modules/@tiptap') ||
            id.includes('node_modules/tiptap') ||
            id.includes('node_modules/@codemirror') ||
            id.includes('node_modules/codemirror') ||
            id.includes('node_modules/@lezer') ||
            id.includes('node_modules/prosemirror-')
          ) return 'vendor-editor'
          // document tooling (pdf / xlsx / pptx / zip)
          if (
            id.includes('node_modules/pdfjs-dist') ||
            id.includes('node_modules/pdf-lib') ||
            id.includes('node_modules/xlsx') ||
            id.includes('node_modules/pptxgenjs') ||
            id.includes('node_modules/jszip')
          ) return 'vendor-docs'
          // animation
          if (id.includes('node_modules/framer-motion')) return 'vendor-motion'
          // maps (leaflet is dynamically imported by MapField)
          if (
            id.includes('node_modules/leaflet') ||
            id.includes('node_modules/react-leaflet')
          ) return 'vendor-maps'
          // core runtime shared across the app
          if (
            id.includes('node_modules/react/') ||
            id.includes('node_modules/react-dom') ||
            id.includes('node_modules/scheduler') ||
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/axios') ||
            id.includes('node_modules/socket.io-client') ||
            id.includes('node_modules/engine.io-client') ||
            id.includes('node_modules/socket.io-parser')
          ) return 'vendor'
        },
      },
    },
  },
})
