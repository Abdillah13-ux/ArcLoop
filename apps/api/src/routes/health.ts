import { Hono } from "hono";

export const healthRoutes = new Hono();

healthRoutes.get("/health", (c) =>
  c.json({
    data: {
      status: "ok",
      service: "arcloop-api"
    },
    error: null
  })
);

healthRoutes.get("/version", (c) =>
  c.json({
    data: {
      name: "arcloop-api",
      version: "0.1.0"
    },
    error: null
  })
);
