import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Nav } from "./components/Nav";
import { RankDefs } from "./components/Rank";
import { Market } from "./pages/Market";
import { Product } from "./pages/Product";
import { Workshop } from "./pages/Workshop";
import { Feed } from "./pages/Feed";
import { Scene } from "./pages/Scene";
import { News } from "./pages/News";
import { Articles } from "./pages/Articles";
import { Home } from "./pages/Home";
import { Ir } from "./pages/Ir";
import { Stack } from "./pages/Stack";
import { Vlog } from "./pages/Vlog";
import { Soon } from "./pages/Soon";

/* GitHub Pages 는 /indygg/ 하위에 올라간다. 라우터 basename 을 빌드 설정과 맞춘다. */
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function App() {
  return (
    <BrowserRouter basename={BASE}>
      <RankDefs />
      <Nav />
      <Routes>
        <Route path="/market" element={<Market />} />
        <Route path="/market/:id" element={<Product />} />
        <Route path="/workshop" element={<Workshop />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/news" element={<News />} />
        <Route path="/articles" element={<Articles />} />
        {/* 아직 안 옮긴 화면 */}
        <Route path="/" element={<Home />} />
        <Route path="/ir" element={<Ir />} />
        <Route path="/stack" element={<Stack />} />
        <Route path="/scene" element={<Scene />} />
        <Route path="/viewer" element={<Soon title="AI 3D 뷰어" />} />
        <Route path="/vlog" element={<Vlog />} />
        <Route path="/cart" element={<Soon title="장바구니" />} />
        <Route path="/upload" element={<Soon title="에셋 올리기" />} />
        <Route path="*" element={<Navigate to="/market" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
