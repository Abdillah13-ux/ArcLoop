import { serve } from "@hono/node-server";

import { app } from "./app";
import { env } from "./config/env";

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
