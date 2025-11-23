import { Hono } from "hono";
import { cors } from "hono/cors";
import { actionsRouter } from "./routes/actions";
import { proxyRouter } from "./routes/proxy";
import { resourcesRouter } from "./routes/resources";
import { sponsorsRouter } from "./routes/sponsors";

export const app = new Hono().basePath("/api/payload");

// Enable CORS
app.use(
  "*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["*"],
    exposeHeaders: ["*"],
    credentials: true,
  }),
);

// Health check
app.get("/health", (c) => c.json({ ok: true, service: "payload-exchange" }));

// /proxy/* → x402 proxying (with sponsor logic)
app.route("/proxy", proxyRouter);

// /actions/* → start + validate actions
app.route("/actions", actionsRouter);

// /sponsors/* → funding / withdraw / stats
app.route("/sponsors", sponsorsRouter);

// /resources/* → list / search / find resources
app.route("/resources", resourcesRouter);
