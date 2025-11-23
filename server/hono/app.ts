import { Hono } from "hono";
import { actionsRouter } from "./routes/actions";
import { proxyRouter } from "./routes/proxy";
import { resourcesRouter } from "./routes/resources";
import { sponsorsRouter } from "./routes/sponsors";

export const app = new Hono().basePath("/api/payload");

// Configure CORS to allow requests from ChatGPT Apps SDK sandbox
const allowedOrigins = [
  "https://payload-exchange.web-sandbox.oaiusercontent.com",
  "https://chat.openai.com",
  "https://chatgpt.com",
];

app.use("*", async (c, next) => {
  const origin = c.req.header("origin");
  const isAllowedOrigin = origin
    ? allowedOrigins.some((allowed) => origin === allowed)
    : true; // Allow requests without origin header (same-origin, etc.)

  if (c.req.method === "OPTIONS") {
    // Handle preflight request
    const headers = new Headers();
    if (isAllowedOrigin) {
      if (origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Access-Control-Allow-Credentials", "true");
      } else {
        // No origin header - allow all (for same-origin requests)
        headers.set("Access-Control-Allow-Origin", "*");
      }
    }
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-user-id, x-action-instance-id");
    headers.set("Access-Control-Max-Age", "86400"); // 24 hours
    return new Response(null, { status: 204, headers });
  }

  await next();

  // Add CORS headers to response
  if (isAllowedOrigin) {
    if (origin) {
      c.header("Access-Control-Allow-Origin", origin);
      c.header("Access-Control-Allow-Credentials", "true");
    } else {
      c.header("Access-Control-Allow-Origin", "*");
    }
  }
  c.header("Access-Control-Expose-Headers", "Content-Type");
});

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
