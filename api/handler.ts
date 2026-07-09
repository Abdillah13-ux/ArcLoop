import { vercelHandler } from "../apps/api/src/vercel";

function firstQueryValue(value: unknown) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return typeof value === "string" ? value : null;
}

export default function handler(req: any, res: any) {
  const path = firstQueryValue(req.query?.path);

  if (path) {
    const query = new URLSearchParams();

    for (const [key, value] of Object.entries(req.query ?? {})) {
      if (key === "path") {
        continue;
      }

      const values = Array.isArray(value) ? value : [value];
      for (const item of values) {
        if (typeof item === "string") {
          query.append(key, item);
        }
      }
    }

    const queryString = query.toString();
    req.url = `/${path}${queryString ? `?${queryString}` : ""}`;
  }

  return vercelHandler(req, res);
}
