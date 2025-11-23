import { Hono } from "hono";
import { actionsRouter } from "./routes/actions";
import { proxyRouter } from "./routes/proxy";
import { resourcesRouter } from "./routes/resources";
import { sponsorsRouter } from "./routes/sponsors";

export const app = new Hono().basePath("/api/payload");

// Health check
app.get("/health", (c) => c.json({ ok: true, service: "payload-exchange" }));

// /proxy/* → x402 proxying
app.route("/proxy", proxyRouter);

// /actions/* → start + validate actions
app.route("/actions", actionsRouter);

// /sponsors/* → funding / withdraw / stats
app.route("/sponsors", sponsorsRouter);

// /resources/* → list / search / find resources
app.route("/resources", resourcesRouter);
