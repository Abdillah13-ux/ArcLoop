import { Route, Routes } from "react-router-dom";

import { Layout } from "./components/Layout";
import { CircleLoginMinimalPage } from "./pages/CircleLoginMinimalPage";
import { ContractsPage } from "./pages/ContractsPage";
import { CreatePoolPage } from "./pages/CreatePoolPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { InvitePage } from "./pages/InvitePage";
import { LoginPage } from "./pages/LoginPage";
import { MobileComingSoonPage } from "./pages/MobileComingSoonPage";
import { PoolDetailPage } from "./pages/PoolDetailPage";
import { PoolsPage } from "./pages/PoolsPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="circle-login-minimal" element={<CircleLoginMinimalPage />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="contracts" element={<ContractsPage />} />
        <Route path="pools" element={<PoolsPage />} />
        <Route path="pools/new" element={<CreatePoolPage />} />
        <Route path="pools/:id" element={<PoolDetailPage />} />
        <Route path="invites/:inviteCode" element={<InvitePage />} />
        <Route path="mobile" element={<MobileComingSoonPage />} />
      </Route>
    </Routes>
  );
}
