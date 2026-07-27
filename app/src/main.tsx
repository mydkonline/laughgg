import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { preferredEntry } from "./lib/locale";
import "./styles.css";

/* 대문으로 들어온 사람을 지난번 언어로 보낸다.

   앱을 그리기 전에 한다. 그린 뒤에 옮기면 한국어 화면이 한 번 번쩍인다. */
const go = preferredEntry();
if (go) {
  window.location.replace(go);
}

const root = document.getElementById("root");
if (!root) throw new Error("#root 가 없습니다 — index.html 을 확인하세요");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
