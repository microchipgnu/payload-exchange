import { Hono } from "hono";
import {
  getResource,
  listResources,
  searchResources,
} from "@/server/core/resources/registry";

export const resourcesRouter = new Hono();

// GET /resources
resourcesRouter.get("/", async (c) => {
  const resources = await listResources();
  return c.json(resources);
});

// GET /resources/search?q=...
resourcesRouter.get("/search", async (c) => {
  const query = c.req.query("q");
  if (!query) {
    return c.json({ error: "Query parameter 'q' is required" }, 400);
  }
  const results = await searchResources(query);
  return c.json(results);
});

// GET /resources/find?url=...
resourcesRouter.get("/find", async (c) => {
  const url = c.req.query("url");
  if (!url) {
    return c.json({ error: "Query parameter 'url' is required" }, 400);
  }
  const resource = await getResource(url);
  if (!resource) {
    return c.json({ error: "Resource not found" }, 404);
  }
  return c.json(resource);
});
