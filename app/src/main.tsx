import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("#root 가 없습니다 — index.html 을 확인하세요");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
