import { Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { ContractsPage } from "./pages/ContractsPage";
import { HomePage } from "./pages/HomePage";
import { InvitePage } from "./pages/InvitePage";
import { MobileComingSoonPage } from "./pages/MobileComingSoonPage";
import { PoolDetailPage } from "./pages/PoolDetailPage";
import { PoolsPage } from "./pages/PoolsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="contracts" element={<ContractsPage />} />
        <Route path="pools" element={<PoolsPage />} />
        <Route path="pools/:id" element={<PoolDetailPage />} />
        <Route path="invites/:inviteCode" element={<InvitePage />} />
        <Route path="mobile" element={<MobileComingSoonPage />} />
      </Route>
    </Routes>
  );
}
