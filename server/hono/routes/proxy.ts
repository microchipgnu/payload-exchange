import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { selectPaymentRequirements } from "x402/client";
import type { PaymentRequirements } from "x402/types";
import {
  canRedeemActionForUser,
  computeCoverage,
} from "@/server/core/actions/coverage";
import { sendUSDCToUser } from "@/server/core/blockchain/send-usdc";
import type {
  X402Challenge,
  X402PaymentRequiredResponse,
} from "@/server/core/x402/types";
import { db } from "@/server/db/client";
import {
  createRedemption,
  getActionForResourceAndUser,
  updateSponsorBalance,
} from "@/server/db/queries";
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
  const userWalletAddress = c.req.header("x-user-wallet-address");
  const xPaymentHeader = c.req.header("x-payment");

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

  // Explicitly forward x-payment header if present
  if (xPaymentHeader) {
    console.log("[Proxy] Forwarding x-payment header:", xPaymentHeader);
    upstreamHeaders.set("x-payment", xPaymentHeader);
  }

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
    userId,
    userWalletAddress: userWalletAddress || "not provided",
    hasXPaymentHeader: !!xPaymentHeader,
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

    // Handle 402 Payment Required responses
    if (upstreamResponse.status === 402) {
      // If x-payment header is present, forward the request with payment header
      if (xPaymentHeader) {
        console.log(
          "[Proxy] x-payment header present, forwarding request with payment",
        );

        // Make a new request with x-payment header
        const paymentResponse = await fetch(targetUrl, {
          method,
          headers: upstreamHeaders,
          body,
        });

        const paymentResponseHeaders = new Headers();
        paymentResponse.headers.forEach((value: string, key: string) => {
          if (!RESPONSE_HEADER_BLOCKLIST.has(key.toLowerCase())) {
            paymentResponseHeaders.set(key, value);
          }
        });
        paymentResponseHeaders.set("url", targetUrl.toString());

        console.log("[Proxy] Payment request response", {
          status: paymentResponse.status,
          url: targetUrl.toString(),
          timestamp: new Date().toISOString(),
        });

        return new Response(paymentResponse.body, {
          status: paymentResponse.status,
          statusText: paymentResponse.statusText,
          headers: paymentResponseHeaders,
        });
      }

      // No x-payment header - handle sponsorship logic
      console.log(
        "[Proxy] 402 response without x-payment header, checking for sponsorship",
      );

      // Clone again for 402 handling (first clone is used for async logging)
      const clonedResponseFor402 = upstreamResponse.clone();
      let challengeBody: unknown = null;

      try {
        challengeBody = await clonedResponseFor402.json();
      } catch {
        // Response might not be JSON
        console.warn(
          "[Proxy] 402 response is not JSON, returning original response",
        );
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

      const challenge = parseX402Challenge(upstreamResponse, challengeBody);

      if (!challenge) {
        console.warn(
          "[Proxy] Could not parse x402 challenge, returning original 402 response",
        );
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

      console.log("[Proxy] Parsed x402 challenge", {
        amount: challenge.amount.toString(),
        currency: challenge.currency,
        network: challenge.network,
        scheme: challenge.scheme,
      });

      // Try to find an action for this user
      const action = await getActionForResourceAndUser(userId);

      if (!action) {
        console.log("[Proxy] No sponsor available for user", { userId });
        // No sponsor available, return original 402 response
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

      console.log("[Proxy] Found action for sponsorship", {
        actionId: action.id,
        sponsorId: action.sponsorId,
        userId,
      });

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
        console.log("[Proxy] User cannot redeem action", {
          userId,
          actionId: action.id,
          pastRedemptionsForAction,
        });
        // User already redeemed, return original 402 response
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

      // Compute coverage
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

      console.log("[Proxy] Computed coverage", {
        sponsorContribution: sponsorContribution.toString(),
        userContribution: userContribution.toString(),
        totalAmount: challenge.amount.toString(),
      });

      // Check if user wallet address is provided
      if (!userWalletAddress) {
        console.warn(
          "[Proxy] User wallet address not provided, cannot send USDC",
          {
            userId,
          },
        );
        // Return original 402 response if no wallet address
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

      // Send USDC to user from treasury wallet
      console.log("[Proxy] Sending USDC to user", {
        to: userWalletAddress,
        amount: sponsorContribution.toString(),
      });

      const usdcResult = await sendUSDCToUser(
        userWalletAddress as `0x${string}`,
        sponsorContribution,
      );

      if (!usdcResult.success || !usdcResult.transactionHash) {
        console.error("[Proxy] Failed to send USDC", {
          error: usdcResult.error,
          userId,
          userWalletAddress,
          amount: sponsorContribution.toString(),
        });
        // Return original 402 response if USDC transfer failed
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

      console.log("[Proxy] USDC sent successfully", {
        transactionHash: usdcResult.transactionHash,
        userId,
        userWalletAddress,
        amount: sponsorContribution.toString(),
      });

      // Deduct from sponsor balance
      try {
        await updateSponsorBalance(action.sponsorId, -sponsorContribution);
        console.log("[Proxy] Sponsor balance updated", {
          sponsorId: action.sponsorId,
          deductedAmount: sponsorContribution.toString(),
        });
      } catch (error) {
        console.error("[Proxy] Failed to update sponsor balance", {
          error: error instanceof Error ? error.message : String(error),
          sponsorId: action.sponsorId,
        });
      }

      // Save redemption to database
      const redemptionMetadata: Record<string, unknown> = {
        requestUrl: targetUrl.toString(),
        httpMethod: method,
        challenge: {
          amount: challenge.amount.toString(),
          currency: challenge.currency,
          network: challenge.network,
          scheme: challenge.scheme,
          resource: challenge.resource,
          ...(challenge.description && { description: challenge.description }),
          ...(challenge.mimeType && { mimeType: challenge.mimeType }),
        },
        coverage: {
          sponsorContribution: sponsorContribution.toString(),
          userContribution: userContribution.toString(),
        },
        usdcTransfer: {
          transactionHash: usdcResult.transactionHash,
          to: userWalletAddress,
          amount: sponsorContribution.toString(),
        },
        userAgent: c.req.header("user-agent") || undefined,
        referer: c.req.header("referer") || undefined,
      };

      const redemptionId = await createRedemption({
        actionId: action.id,
        userId,
        resourceId,
        instanceId: `sponsor-${Date.now()}`,
        sponsored_amount: sponsorContribution,
        metadata: redemptionMetadata,
      });

      console.log("[Proxy] Redemption saved to database", {
        redemptionId,
        actionId: action.id,
        userId,
        resourceId,
      });

      // Mark redemption as completed since we've already sent the USDC
      const { updateRedemptionStatus } = await import("@/server/db/queries");
      await updateRedemptionStatus(redemptionId, "completed");

      console.log("[Proxy] Returning original 402 response after sponsorship", {
        redemptionId,
        userId,
        url: targetUrl.toString(),
      });

      // Return the original 402 response
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
