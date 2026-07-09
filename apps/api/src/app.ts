import { Hono } from "hono";
import { cors } from "hono/cors";

import { chainsRoutes } from "./routes/chains";
import { contractsRoutes } from "./routes/contracts";
import { devRoutes } from "./routes/dev";
import { healthRoutes } from "./routes/health";
import { indexerRoutes } from "./routes/indexer";
import { invitesRoutes } from "./routes/invites";
import { poolsRoutes } from "./routes/pools";
import { walletsRoutes } from "./routes/wallets";

const app = new Hono();

app.use(
  "/*",
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"]
  })
);

app.route("/", healthRoutes);
app.route("/", chainsRoutes);
app.route("/", contractsRoutes);
app.route("/", poolsRoutes);
app.route("/", invitesRoutes);
app.route("/", indexerRoutes);
app.route("/", walletsRoutes);
app.route("/", devRoutes);

export { app };
