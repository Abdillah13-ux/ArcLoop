import { app } from "../apps/api/src/app";

export default {
  fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === "/api") {
      url.pathname = "/";
    } else if (url.pathname.startsWith("/api/")) {
      url.pathname = url.pathname.slice("/api".length);
    }

    return app.fetch(new Request(url, request));
  }
};
