import { handle } from "@hono/node-server/vercel";

import { app } from "./app";

export const vercelHandler = handle(app);
