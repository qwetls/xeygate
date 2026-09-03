import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import path from "node:path";

export default defineConfig({
    plugins: [
        TanStackRouterVite({ target: "react", autoCodeSplitting: true }),
        react(),
        tailwindcss()
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@srouter/types": path.resolve(__dirname, "../../packages/types/src/index.ts"),
            "@srouter/constants": path.resolve(__dirname, "../../packages/constants/src/index.ts")
        }
    },
    build: {
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes("node_modules")) return;
                    // exact package paths, no broad patterns
                    if (id.includes("node_modules/react/")) return "react-vendor";
                    if (id.includes("node_modules/react-dom/")) return "react-vendor";
                    if (id.includes("node_modules/scheduler/")) return "react-vendor";
                    if (id.includes("node_modules/sonner/")) return "toast";
                    if (id.includes("node_modules/lucide-react/")) return "icons";
                    if (id.includes("node_modules/@tanstack/react-router/")) return "router";
                    if (id.includes("node_modules/@tanstack/react-query/")) return "query";
                    if (id.includes("node_modules/@tanstack/react-table/")) return "table";
                    if (id.includes("node_modules/recharts/")) return "charts";
                    if (id.includes("node_modules/@xyflow/")) return "flow";
                    if (id.includes("node_modules/@base-ui/")) return "ui";
                    if (id.includes("node_modules/class-variance-authority/")) return "ui";
                    if (id.includes("node_modules/clsx/")) return "ui";
                    if (id.includes("node_modules/tailwind-merge/")) return "ui";
                    return "vendor"; // everything else
                }
            }
        }
    },
    server: {
        port: 5173,
        proxy: {
            "/v1": "http://localhost:3000",
            "/health": "http://localhost:3000"
        }
    }
});