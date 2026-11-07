import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const apiProxyTarget = process.env.VITE_PROXY_TARGET ?? "http://localhost:4000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": apiProxyTarget,
      "/graphql": apiProxyTarget,
      "/socket.io": { target: apiProxyTarget, ws: true }
    }
  },
  preview: {
    port: 5173,
    proxy: {
      "/api": apiProxyTarget,
      "/graphql": apiProxyTarget,
      "/socket.io": { target: apiProxyTarget, ws: true }
    }
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: "vendor-tensorflow-layers", test: /node_modules[\\/]@tensorflow[\\/]tfjs-layers[\\/]/, priority: 60 },
            { name: "vendor-tensorflow-core", test: /node_modules[\\/]@tensorflow[\\/]tfjs-core[\\/]/, priority: 59 },
            { name: "vendor-tensorflow-webgl", test: /node_modules[\\/]@tensorflow[\\/]tfjs-backend-webgl[\\/]/, priority: 58 },
            { name: "vendor-tensorflow-converter", test: /node_modules[\\/]@tensorflow[\\/]tfjs-converter[\\/]/, priority: 57 },
            { name: "vendor-tensorflow", test: /node_modules[\\/]@tensorflow[\\/]/, priority: 50 },
            { name: "vendor-jspdf", test: /node_modules[\\/]jspdf[\\/]/, priority: 48 },
            { name: "vendor-html2canvas", test: /node_modules[\\/]html2canvas[\\/]/, priority: 47 },
            { name: "vendor-purify", test: /node_modules[\\/]dompurify[\\/]/, priority: 46 },
            { name: "vendor-firebase", test: /node_modules[\\/](@firebase|firebase)[\\/]/, priority: 40 },
            { name: "vendor-maps", test: /node_modules[\\/](leaflet|react-leaflet)[\\/]/, priority: 35 },
            { name: "vendor-motion", test: /node_modules[\\/]framer-motion[\\/]/, priority: 30 }
          ]
        }
      }
    }
  }
});
