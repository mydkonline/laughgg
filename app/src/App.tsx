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
import { Viewer } from "./pages/Viewer";
import { Home } from "./pages/Home";
import { Ir } from "./pages/Ir";
import { Stack } from "./pages/Stack";
import { Vlog } from "./pages/Vlog";
import { Join } from "./pages/Join";
import { Upload } from "./pages/Upload";
import { Library } from "./pages/Library";
import { Settings } from "./pages/Settings";
import { Billing } from "./pages/Billing";
import { Generate } from "./pages/Generate";
import { Cart } from "./pages/Cart";
import { ROUTER_BASE } from "./lib/locale";

/* 언어가 basename 에 들어간다.

   `/en/market` 의 `/en` 을 라우터 바깥으로 밀어 두면 아래 Route 도 화면 속
   Link 도 하나도 안 고쳐도 된다 — 전부 `/market` 인 채로 언어만큼 접두사가
   붙는다. 기본 언어(한국어)는 접두사가 없으니 지금 주소가 그대로다.

   GitHub Pages 의 `/laughgg/` 도 여기 같이 들어 있다. 두 값을 합치는 일은
   lib/locale 이 한다 — 주소를 조립하는 자리가 둘이면 한쪽만 고치게 된다. */

export default function App() {
  return (
    <BrowserRouter basename={ROUTER_BASE}>
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
        <Route path="/join" element={<Join />} />
        <Route path="/library" element={<Library />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/billing" element={<Billing />} />
        <Route path="/generate" element={<Generate />} />
        {/* 옛 주소. 링크가 돌아다닐 수 있어 살려 둔다. */}
        <Route path="/me" element={<Navigate to="/settings" replace />} />
        <Route path="/stack" element={<Stack />} />
        <Route path="/scene" element={<Scene />} />
        <Route path="/viewer" element={<Viewer />} />
        <Route path="/vlog" element={<Vlog />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="*" element={<Navigate to="/market" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
