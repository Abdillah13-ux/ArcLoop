import { serve } from "@hono/node-server";
import { Hono } from "hono";

import { env } from "./config/env";
import { chainsRoutes } from "./routes/chains";
import { contractsRoutes } from "./routes/contracts";
import { healthRoutes } from "./routes/health";
import { indexerRoutes } from "./routes/indexer";
import { invitesRoutes } from "./routes/invites";
import { poolsRoutes } from "./routes/pools";

const app = new Hono();

app.route("/", healthRoutes);
app.route("/", chainsRoutes);
app.route("/", contractsRoutes);
app.route("/", poolsRoutes);
app.route("/", invitesRoutes);
app.route("/", indexerRoutes);

serve(
  {
    fetch: app.fetch,
    port: env.API_PORT
  },
  (info) => {
    console.log(`ArcLoop API listening on http://localhost:${info.port}`);
  }
);

export { app };
