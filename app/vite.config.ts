import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages 는 /indygg/ 하위에 올라간다. 개발 중에는 루트로 둔다.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/indygg/" : "/",
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  // 배포는 아직 web/ 정적 빌드가 담당한다. 패리티가 날 때까지 dist 로만 뽑는다.
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
