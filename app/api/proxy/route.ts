import { handle } from "hono/vercel";
import type { NextRequest } from "next/server";
import { app } from "@/server/hono/app";

export const runtime = "nodejs";

// Delegate all proxy requests to Hono
// Convert /api/proxy?url=... format to /api/payload/proxy/:resourceId format
async function delegateToHono(req: NextRequest) {
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return new Response(
      JSON.stringify({ error: "Missing 'url' query parameter" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        },
      },
    );
  }

  try {
    // Encode the full URL as the resourceId (Hono route supports full URLs)
    const encodedResourceId = encodeURIComponent(targetUrl);

    // Create a new request URL pointing to the Hono route
    const baseUrl = new URL(req.url);
    const honoPath = `/api/payload/proxy/${encodedResourceId}`;
    const honoUrl = new URL(honoPath, baseUrl.origin);

    // Forward query parameters if any (excluding 'url')
    url.searchParams.forEach((value, key) => {
      if (key !== "url") {
        honoUrl.searchParams.set(key, value);
      }
    });

    // Create a new request for Hono with all original headers
    const headers = new Headers();
    req.headers.forEach((value, key) => {
      headers.set(key, value);
    });

    // Create request body if present
    let body: ReadableStream | null = null;
    if (req.method !== "GET" && req.method !== "HEAD") {
      body = req.body;
    }

    const honoRequest = new Request(honoUrl.toString(), {
      method: req.method,
      headers,
      body,
    });

    // Handle with Hono
    return handle(app)(honoRequest);
  } catch (error) {
    console.error("[Proxy] Error delegating to Hono:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process proxy request",
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
}

export const GET = delegateToHono;
export const POST = delegateToHono;
export const PUT = delegateToHono;
export const DELETE = delegateToHono;
export const PATCH = delegateToHono;

// Enable CORS for all origins, methods, and headers
export const OPTIONS = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
};
