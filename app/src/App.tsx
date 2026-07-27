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
import { Soon } from "./pages/Soon";
import { Join } from "./pages/Join";
import { Upload } from "./pages/Upload";
import { Library } from "./pages/Library";
import { Settings } from "./pages/Settings";
import { Billing } from "./pages/Billing";
import { Generate } from "./pages/Generate";

/* GitHub Pages 는 /laughgg/ 하위에 올라간다. basename 은 빌드의 base 를 그대로 따라간다. */
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
        <Route path="/cart" element={<Soon title="장바구니" />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="*" element={<Navigate to="/market" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
