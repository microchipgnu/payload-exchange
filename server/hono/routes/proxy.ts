import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { Hono } from "hono";
import { selectPaymentRequirements } from "x402/client";
import type { PaymentRequirements } from "x402/types";
import {
  VLAYER_API_ENDPOINT,
  VLAYER_BEARER_TOKEN,
  VLAYER_CLIENT_ID,
} from "@/lib/config";
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
  createResponseProof,
  getActionForResourceAndUser,
  updateSponsorBalance,
} from "@/server/db/queries";
import { redemptions } from "@/server/db/schema";
import { VLayer } from "@/server/lib/vlayer";

const RESPONSE_HEADER_BLOCKLIST = new Set([
  "content-encoding",
  "transfer-encoding",
  "content-length",
]);

const REQUEST_HEADER_BLOCKLIST = new Set(["host", "content-length"]);

// Initialize VLayer client if configured
let vlayerClient: VLayer | null = null;
if (VLAYER_API_ENDPOINT && VLAYER_CLIENT_ID && VLAYER_BEARER_TOKEN) {
  vlayerClient = new VLayer({
    apiEndpoint: VLAYER_API_ENDPOINT,
    clientId: VLAYER_CLIENT_ID,
    bearerToken: VLAYER_BEARER_TOKEN,
  });
}

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
  // VLayer is opt-in via header, defaults to disabled
  const enableVLayer =
    c.req.header("x-enable-vlayer")?.toLowerCase() === "true" ||
    c.req.header("x-vlayer-enabled")?.toLowerCase() === "true";

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
        // Generate and save VLayer proof for all responses
        // Note: VLayer proof generation is optional - failures won't block the proxy
        // VLayer is opt-in via header (x-enable-vlayer or x-vlayer-enabled), defaults to disabled
        if (enableVLayer && vlayerClient && VLAYER_API_ENDPOINT) {
          try {
            // Prepare headers for VLayer (exclude sensitive auth headers that VLayer can't replay)
            const headers: string[] = [];
            upstreamHeaders.forEach((value, key) => {
              // Skip x-payment and other auth headers that VLayer can't replay
              const lowerKey = key.toLowerCase();
              if (
                lowerKey !== "x-payment" &&
                lowerKey !== "authorization" &&
                lowerKey !== "cookie"
              ) {
                headers.push(`${key}: ${value}`);
              }
            });

            // Get request body text if available
            let bodyText: string | undefined;
            const contentType = upstreamHeaders.get("content-type") || "";
            if (
              body &&
              body.byteLength > 0 &&
              (contentType.includes("text") ||
                contentType.includes("json") ||
                contentType.includes("form"))
            ) {
              try {
                bodyText = new TextDecoder().decode(body);
              } catch {
                // If body can't be decoded as text, skip it
              }
            }

            // Try to generate proof using VLayer
            // Note: VLayer may fail for authenticated requests, so we catch and log
            let proofResult: {
              proof: {
                data: string;
                version: string;
                meta: { notaryUrl: string };
              };
              httpResponse: {
                status: number;
                statusText: string;
                headers?: Record<string, string>;
                body?: string;
              };
            };

            try {
              // First try executeWithProof (VLayer executes the request)
              proofResult = await vlayerClient.executeWithProof({
                url: targetUrl.toString(),
                method: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
                headers,
                body: bodyText,
              });
            } catch (executeError) {
              // If executeWithProof fails, VLayer API might be down or misconfigured
              // Log the error but don't try fallback since generateWebProof uses the same API
              const errorMessage =
                executeError instanceof Error
                  ? executeError.message
                  : String(executeError);

              // Check if it's a 500 error (VLayer API issue) vs other errors
              const isVLayerApiError =
                errorMessage.includes("500") ||
                errorMessage.includes("Internal Server Error");

              if (isVLayerApiError) {
                console.warn(
                  "[VLayer] API returned 500 error - VLayer service may be down or misconfigured",
                  {
                    url: targetUrl.toString(),
                    error: errorMessage,
                    suggestion:
                      "Check VLAYER_API_ENDPOINT, VLAYER_CLIENT_ID, and VLAYER_BEARER_TOKEN environment variables",
                  },
                );
                // Don't try fallback - VLayer API is not working
                throw executeError;
              }

              // For other errors, try generateWebProof as fallback
              console.warn(
                "[VLayer] executeWithProof failed, trying generateWebProof fallback",
                {
                  url: targetUrl.toString(),
                  error: errorMessage,
                },
              );

              try {
                // Generate proof for the request (VLayer will execute it without auth)
                // Note: This won't match our actual response, but provides a proof of the request
                const proof = await vlayerClient.generateWebProof({
                  url: targetUrl.toString(),
                  method: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
                  headers,
                  body: bodyText,
                });

                // Use the actual response we received instead of VLayer's response
                proofResult = {
                  proof,
                  httpResponse: {
                    status: upstreamResponse.status,
                    statusText: upstreamResponse.statusText,
                    headers: Object.fromEntries(upstreamResponse.headers),
                    body: await clonedUpstreamResponse.text().catch(() => ""),
                  },
                };
              } catch (fallbackError) {
                // Fallback also failed - VLayer API is not working
                throw fallbackError;
              }
            }

            // Determine sponsorId and actionId if this was a sponsored request
            let sponsorId: string | undefined;
            let actionId: string | undefined;

            // Check if there's an action for this resource/user
            try {
              const action = await getActionForResourceAndUser(userId);
              if (action) {
                sponsorId = action.sponsorId;
                actionId = action.id;
              }
            } catch {
              // Ignore errors when checking for action
            }

            // Save proof to database using the actual response status
            await createResponseProof({
              resourceId,
              url: targetUrl.toString(),
              method,
              statusCode: upstreamResponse.status, // Use actual response status
              statusText: upstreamResponse.statusText,
              proof: proofResult.proof.data,
              userId,
              sponsorId,
              actionId,
              metadata: {
                proofVersion: proofResult.proof.version,
                notaryUrl: proofResult.proof.meta.notaryUrl,
                fetchDuration,
                vlayerResponseStatus: proofResult.httpResponse.status, // VLayer's response status
                actualResponseStatus: upstreamResponse.status, // Our actual response status
                responseHeaders: Object.fromEntries(upstreamResponse.headers),
              },
            });

            console.log("[VLayer] Proof saved", {
              resourceId,
              url: targetUrl.toString(),
              statusCode: upstreamResponse.status,
              sponsorId,
              proofVersion: proofResult.proof.version,
            });

            // For failed responses (5xx), log for resolution/refund requests
            if (upstreamResponse.status >= 500) {
              console.warn("[VLayer] Failed response detected", {
                resourceId,
                url: targetUrl.toString(),
                statusCode: upstreamResponse.status,
                sponsorId,
                actionId,
              });
            }
          } catch (proofError) {
            // Log detailed error information for debugging
            const errorMessage =
              proofError instanceof Error
                ? proofError.message
                : String(proofError);

            // Determine if this is a VLayer API issue or a different error
            const isVLayerApiError =
              errorMessage.includes("500") ||
              errorMessage.includes("Internal Server Error") ||
              errorMessage.includes("VLayer API error");

            if (isVLayerApiError) {
              // VLayer API is down or misconfigured - log as warning, not error
              console.warn(
                "[VLayer] API unavailable - proof generation skipped",
                {
                  url: targetUrl.toString(),
                  method,
                  error: errorMessage,
                  impact:
                    "Proofs will not be saved until VLayer API is available",
                  suggestion:
                    "Check VLayer API endpoint configuration and service status",
                },
              );
            } else {
              // Other errors (network, parsing, etc.)
              console.error("[VLayer] Failed to generate/save proof", {
                url: targetUrl.toString(),
                method,
                error: errorMessage,
                vlayerConfigured: !!vlayerClient,
                hasEndpoint: !!VLAYER_API_ENDPOINT,
              });
            }

            // Don't throw - proof generation failure shouldn't block the response
            // The proxy should continue to work even if VLayer fails
            // Proofs are optional - they help with verification but aren't required for functionality
          }
        } else if (!VLAYER_API_ENDPOINT) {
          // VLayer is not configured - this is fine, just skip proof generation
          // No need to log unless in debug mode
        }

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
