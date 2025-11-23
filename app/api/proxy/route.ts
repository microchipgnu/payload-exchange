import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const targetUrl = url.searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json(
      { error: "Missing 'url' query parameter" },
      { status: 400 },
    );
  }

  console.log(`[Proxy] Request to: ${targetUrl}`);

  // Log all incoming headers
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
    console.log(`[Proxy] Incoming Header - ${key}: ${value}`);
  });

  // Prepare headers for upstream request
  const upstreamHeaders = new Headers();

  // Forward relevant headers
  // We explicitly forward x-payment if present
  const xPayment = req.headers.get("x-payment");
  if (xPayment) {
    console.log(`[Proxy] Forwarding x-payment header: ${xPayment}`);
    upstreamHeaders.set("x-payment", xPayment);
  }

  // Forward authorization if present
  const auth = req.headers.get("authorization");
  if (auth) {
    upstreamHeaders.set("authorization", auth);
  }

  // Forward content-type if present
  const contentType = req.headers.get("content-type");
  if (contentType) {
    upstreamHeaders.set("content-type", contentType);
  }

  // Forward accept header
  const accept = req.headers.get("accept");
  if (accept) {
    upstreamHeaders.set("accept", accept);
  }

  try {
    console.log(`[Proxy] Fetching upstream: ${targetUrl}`);
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: upstreamHeaders,
    });

    console.log(`[Proxy] Upstream response status: ${response.status}`);

    // Log upstream response headers
    response.headers.forEach((value, key) => {
      console.log(`[Proxy] Upstream Header - ${key}: ${value}`);
    });

    // Read response body
    const body = await response.arrayBuffer();

    // Prepare downstream response
    const responseHeaders = new Headers();

    // Forward important response headers
    const headersToForward = [
      "content-type",
      "www-authenticate",
      "x-payment-required", // specific x402 headers if any
    ];

    response.headers.forEach((value, key) => {
      // Forward all headers except some blocklisted ones usually, but for simplicity/debug lets forward most things
      // especially those related to 402 flows
      if (
        !["content-encoding", "content-length", "transfer-encoding"].includes(
          key.toLowerCase(),
        )
      ) {
        responseHeaders.set(key, value);
      }
    });

    return new NextResponse(body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[Proxy] Error fetching upstream:", error);
    return NextResponse.json(
      { error: "Failed to fetch upstream resource", details: String(error) },
      { status: 502 },
    );
  }
}
