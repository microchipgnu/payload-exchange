import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { selectPaymentRequirements } from "x402/client";
import type { PaymentRequirements } from "x402/types";
import {
  canRedeemActionForUser,
  computeCoverage,
} from "@/server/core/actions/coverage";
import { getPlugin } from "@/server/core/actions/registry";
import type {
  X402Challenge,
  X402PaymentRequiredResponse,
} from "@/server/core/x402/types";
import { db } from "@/server/db/client";
import { getActionForResourceAndUser } from "@/server/db/queries";
import { redemptions } from "@/server/db/schema";

const RESPONSE_HEADER_BLOCKLIST = new Set([
  "content-encoding",
  "transfer-encoding",
  "content-length",
]);

const REQUEST_HEADER_BLOCKLIST = new Set(["host", "content-length"]);

const extractRequestBody = async (request: Request) => {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await request.json()) as unknown;
  } else if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    const formData = await request.formData();
    return Object.fromEntries(formData.entries());
  } else if (contentType.includes("text/")) {
    return await request.text();
  }
  return null;
};

const extractResponseBody = async (response: Response) => {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return (await response.json()) as unknown;
    } catch {
      return null;
    }
  } else if (contentType.includes("text/")) {
    try {
      return await response.text();
    } catch {
      return null;
    }
  } else if (contentType.includes("application/octet-stream")) {
    try {
      const arrayBuffer = await response.arrayBuffer();
      // Convert ArrayBuffer to a base64-encoded string
      return {
        type: "Buffer",
        data: Array.from(new Uint8Array(arrayBuffer)),
      };
    } catch {
      return null;
    }
  } else if (contentType) {
    try {
      return await response.text();
    } catch {
      return null;
    }
  }

  return null;
};

/**
 * Parse x402 Payment Required Response according to the x402 protocol specification
 * See: https://github.com/coinbase/x402
 *
 * The response body should be a JSON object with:
 * - x402Version: number
 * - accepts: array of payment options (or paymentRequirements)
 *   Each option contains: scheme, network, maxAmountRequired, resource, etc.
 */
const parseX402Challenge = (
  _response: Response,
  body: unknown,
): X402Challenge | null => {
  // Parse the Payment Required Response JSON body
  if (!body || typeof body !== "object" || body === null) {
    return null;
  }

  try {
    const responseBody = body as X402PaymentRequiredResponse;

    // Validate x402Version exists
    if (
      typeof responseBody.x402Version !== "number" ||
      responseBody.x402Version < 1
    ) {
      console.warn("[x402] Invalid or missing x402Version");
      return null;
    }

    // Get payment options from either 'accepts' or 'paymentRequirements' field
    const paymentOptions: PaymentRequirements[] =
      responseBody.accepts ?? responseBody.paymentRequirements ?? [];

    if (paymentOptions.length === 0) {
      console.warn("[x402] No payment options found in response");
      return null;
    }

    // Use x402's selectPaymentRequirements to choose the best payment option
    // This prioritizes USDC and handles network preferences
    const option = selectPaymentRequirements(paymentOptions);

    // Validate required fields
    if (
      !option.scheme ||
      !option.network ||
      !option.maxAmountRequired ||
      !option.resource
    ) {
      console.warn("[x402] Missing required fields in payment option", option);
      return null;
    }

    // Parse amount from string to bigint
    let amount: bigint;
    try {
      amount = BigInt(option.maxAmountRequired);
    } catch {
      console.warn(
        "[x402] Invalid maxAmountRequired format:",
        option.maxAmountRequired,
      );
      return null;
    }

    // Derive currency identifier from scheme and network
    // Format: "{scheme}:{network}" (e.g., "exact:base" or "USDC:base")
    // Note: The actual asset/currency may need to be inferred from the network
    // or specified elsewhere. This format matches our internal currency representation.
    const currency = `${option.scheme}:${option.network}`;

    return {
      amount,
      currency,
      network: option.network,
      scheme: option.scheme,
      resource: option.resource,
      ...(option.description && { description: option.description }),
      ...(option.mimeType && { mimeType: option.mimeType }),
    };
  } catch (error) {
    console.error("[x402] Error parsing Payment Required Response:", error);
    return null;
  }
};

async function proxyHandler(c: Context) {
  const startTime = Date.now();
  const resourceId = c.req.param("resourceId");
  const pathAfterResourceId = c.req.param("*") || "";
  const userId = c.req.header("x-user-id") ?? "anon";

  // Construct target URL from resourceId and remaining path
  // If resourceId looks like a URL, use it directly; otherwise construct from path
  let targetUrl: URL;
  try {
    // Try to parse resourceId as URL first
    if (resourceId.startsWith("http://") || resourceId.startsWith("https://")) {
      const baseUrl = new URL(resourceId);
      if (pathAfterResourceId) {
        targetUrl = new URL(pathAfterResourceId, baseUrl);
      } else {
        targetUrl = baseUrl;
      }
    } else {
      // If not a full URL, assume resourceId is a base URL and append path
      // This is a fallback - in production you'd look up the resource URL from DB
      const baseUrl = `https://${resourceId}`;
      targetUrl = new URL(pathAfterResourceId || "/", baseUrl);
    }

    // Add query string if present
    const queryString = c.req.url.split("?")[1];
    if (queryString) {
      targetUrl.search = queryString;
    }
  } catch {
    return c.json({ error: "Invalid resource URL" }, 400);
  }

  const method = c.req.method.toUpperCase();

  // Clone request before reading body (for later logging)
  const clonedRequest = c.req.raw.clone();

  // Prepare upstream headers
  const upstreamHeaders = new Headers();
  c.req.raw.headers.forEach((value: string, key: string) => {
    if (!REQUEST_HEADER_BLOCKLIST.has(key.toLowerCase())) {
      upstreamHeaders.set(key, value);
    }
  });

  // Extract request body
  let body: ArrayBuffer | undefined;
  let requestBodySize = 0;

  if (method !== "GET" && method !== "HEAD") {
    const requestBody = await c.req.arrayBuffer();
    body = requestBody;
    requestBodySize = requestBody.byteLength;
  }

  console.log("[Proxy Request]", {
    method,
    url: targetUrl.toString(),
    requestBodySize,
    timestamp: new Date().toISOString(),
  });

  try {
    // Make upstream request
    const upstreamResponse = await fetch(targetUrl, {
      method,
      headers: upstreamHeaders,
      body,
    });

    const fetchDuration = Date.now() - startTime;
    const contentLength = upstreamResponse.headers.get("content-length");
    const responseBodySize = contentLength ? parseInt(contentLength) : null;

    console.log("[Proxy Response]", {
      method,
      url: targetUrl.toString(),
      status: upstreamResponse.status,
      responseBodySize,
      contentType: upstreamResponse.headers.get("content-type"),
      fetchDuration,
      timestamp: new Date().toISOString(),
    });

    const clonedUpstreamResponse = upstreamResponse.clone();

    // Handle response asynchronously (similar to Next.js 'after')
    void (async () => {
      try {
        if (upstreamResponse.status === 402) {
          const upstreamX402Response =
            (await clonedUpstreamResponse.json()) as unknown;
          console.log("[402 Response]", {
            url: targetUrl.toString(),
            data: upstreamX402Response,
          });
        } else {
          const cleanedTargetUrl = (() => {
            const urlObj = new URL(targetUrl.toString());
            urlObj.search = "";
            return urlObj.toString();
          })();

          const shareData = c.req.query("share_data") === "true";
          const requestBody = shareData
            ? await extractRequestBody(clonedRequest)
            : undefined;
          const requestHeaders = shareData
            ? Object.fromEntries(clonedRequest.headers)
            : undefined;
          const responseBody = shareData
            ? await extractResponseBody(clonedUpstreamResponse)
            : undefined;
          const responseHeaders = shareData
            ? Object.fromEntries(clonedUpstreamResponse.headers)
            : undefined;

          const data = {
            statusCode: clonedUpstreamResponse.status,
            statusText: clonedUpstreamResponse.statusText,
            method,
            duration: fetchDuration,
            url: targetUrl.toString(),
            requestContentType: clonedRequest.headers.get("content-type") ?? "",
            responseContentType:
              clonedUpstreamResponse.headers.get("content-type") ?? "",
            ...(shareData
              ? {
                  requestBody,
                  requestHeaders,
                  responseBody,
                  responseHeaders,
                }
              : {}),
          };
          console.log("[Proxy Data]", { cleanedTargetUrl, data });
        }
      } catch (error) {
        console.error("[Proxy After Error]", {
          url: targetUrl.toString(),
          error: error instanceof Error ? error.message : String(error),
        });
      }
    })();

    // Handle 402 Payment Required responses - intercept for action redemption
    if (upstreamResponse.status === 402) {
      // Clone again for 402 handling (first clone is used for async logging)
      const clonedResponseFor402 = upstreamResponse.clone();
      let challengeBody: unknown = null;

      try {
        challengeBody = await clonedResponseFor402.json();
      } catch {
        // Response might not be JSON
      }

      const challenge = parseX402Challenge(upstreamResponse, challengeBody);

      if (!challenge) {
        // Can't parse challenge, return original 402 response
        const responseHeaders = new Headers();
        upstreamResponse.headers.forEach((value: string, key: string) => {
          if (!RESPONSE_HEADER_BLOCKLIST.has(key.toLowerCase())) {
            responseHeaders.set(key, value);
          }
        });
        responseHeaders.set("url", targetUrl.toString());

        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          headers: responseHeaders,
        });
      }

      // Try to find an action for this resource and user
      const action = await getActionForResourceAndUser(resourceId, userId);

      if (!action) {
        // No sponsor available, return 402 with challenge info
        return c.json(
          {
            error: "No sponsor available",
            challenge: {
              amount: challenge.amount.toString(),
              currency: challenge.currency,
            },
          },
          402,
        );
      }

      // Check if user can redeem this action
      const pastCount = await db.query.redemptions.findMany({
        where: eq(redemptions.userId, userId),
      });

      const pastRedemptionsForAction = pastCount.filter(
        (r) => r.actionId === action.id && r.status === "completed",
      ).length;

      if (
        !canRedeemActionForUser({
          recurrence: action.recurrence as "one_time_per_user" | "per_request",
          pastRedemptionsCount: pastRedemptionsForAction,
        })
      ) {
        return c.json(
          {
            error: "Action already redeemed for this user",
            challenge: {
              amount: challenge.amount.toString(),
              currency: challenge.currency,
            },
          },
          402,
        );
      }

      // Get plugin and start action
      const plugin = getPlugin(action.pluginId);
      if (!plugin) {
        return c.json({ error: "Unknown plugin" }, 500);
      }

      const startResult = await plugin.start({
        userId,
        resourceId,
        actionId: action.id,
        config: action.config as Record<string, unknown>,
      });

      // Save redemption instance
      const { createRedemption } = await import("@/server/db/queries");
      await createRedemption({
        actionId: action.id,
        userId,
        resourceId,
        instanceId: startResult.instanceId,
      });

      const { sponsorContribution, userContribution } = computeCoverage(
        challenge,
        {
          coverageType: action.coverageType as "full" | "percent",
          coveragePercent:
            action.coveragePercent !== null
              ? Number(action.coveragePercent)
              : undefined,
          recurrence: action.recurrence as "one_time_per_user" | "per_request",
        },
      );

      return c.json({
        type: "action_required",
        actionInstanceId: startResult.instanceId,
        instructions: startResult.instructions,
        url: startResult.url,
        coverage: {
          sponsorContribution: sponsorContribution.toString(),
          userContribution: userContribution.toString(),
        },
      });
    }

    // For non-402 responses, forward directly
    const responseHeaders = new Headers();
    upstreamResponse.headers.forEach((value: string, key: string) => {
      if (!RESPONSE_HEADER_BLOCKLIST.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });
    responseHeaders.set("url", targetUrl.toString());

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    const errorDuration = Date.now() - startTime;
    console.error("[Proxy Error]", {
      method,
      url: targetUrl.toString(),
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      duration: errorDuration,
      timestamp: new Date().toISOString(),
    });
    const message =
      error instanceof Error ? error.message : "Unknown upstream error";
    return c.json({ error: message }, 502);
  }
}

export const proxyRouter = new Hono();

// Handle all methods for /proxy/:resourceId/*
proxyRouter.all("/:resourceId/*", proxyHandler);
proxyRouter.all("/:resourceId", proxyHandler);
