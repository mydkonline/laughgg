import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// GitHub Pages 는 /laughgg/ 하위에 올라간다. 개발 중에는 루트로 둔다.
export default defineConfig(({ command, mode }) => ({
  base: command === "build" ? "/laughgg/" : "/",
  plugins: [react(), tailwindcss()],
  /* 개발 중에는 API 를 같은 오리진으로 흘린다.

     세션 쿠키가 SameSite=Lax 라 교차 사이트에서는 저장도 전송도 안 된다.
     localhost:5173 과 127.0.0.1:8420 은 브라우저에게 다른 사이트다 — 포트만
     다른 게 아니라 호스트가 다르다. 프록시를 두면 브라우저가 보는 주소는
     하나뿐이라 쿠키가 정상으로 오간다.

     배포에서도 같은 문제가 있다. 프런트와 API 를 같은 등록 도메인에 두거나
     (laughgg.com + api.laughgg.com) 리버스 프록시로 한 오리진에 합쳐야 한다.
     SameSite=None 으로 여는 방법도 있지만 HTTPS 가 필요하고 브라우저들이
     서드파티 쿠키를 걷어내는 중이라 오래 못 간다. */
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: loadEnv(mode, ".", "VITE_").VITE_API_ORIGIN ?? "http://127.0.0.1:8420",
        changeOrigin: true,
      },
    },
  },
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
