import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages 는 /laughgg/ 하위에 올라간다. 개발 중에는 루트로 둔다.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/laughgg/" : "/",
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  // Pages 워크플로가 이 dist 를 그대로 올린다.
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // three.js 는 무겁고 마켓 목록 첫 화면에는 필요 없다. 따로 떼어 둔다.
        manualChunks: (id) => (id.includes("node_modules/three") ? "three" : undefined),
      },
    },
  },
}));
