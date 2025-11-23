/**
 * Verification Layer (VLayer) for Proxy
 *
 * This module provides web proof generation functionality for proxy requests
 * using the VLayer web prover service.
 */

import { parseWebProofHex } from "./webproof-parser";

export interface WebProofRequest {
  url: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  headers: string[];
  body?: string;
}

export interface WebProofResponse {
  success: boolean;
  data: string;
  version: string;
  meta: {
    notaryUrl: string;
  };
  // Legacy format support - presentation field (deprecated)
  presentation?: string;
}

export interface ExecutedRequestWithProof {
  proof: WebProofResponse;
  httpResponse: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
  };
}

export interface VLayerConfig {
  apiEndpoint: string;
  clientId: string;
  bearerToken: string;
}

export class VLayer {
  private readonly apiEndpoint: string;
  private readonly clientId: string;
  private readonly bearerToken: string;

  constructor(config: VLayerConfig) {
    this.apiEndpoint = config.apiEndpoint;
    this.clientId = config.clientId;
    this.bearerToken = config.bearerToken;
  }

  /**
   * Generates a web proof for a given request
   * Note: This may execute the request through VLayer, which might fail for authenticated requests
   */
  async generateWebProof(request: WebProofRequest): Promise<WebProofResponse> {
    try {
      const response = await fetch(this.apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-client-id": this.clientId,
          Authorization: `Bearer ${this.bearerToken}`,
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new Error(
          `VLayer API error: ${response.status} ${response.statusText}. ${errorText}`,
        );
      }

      const apiResponse = (await response.json()) as {
        success: boolean;
        data?: string;
        version?: string;
        meta?: { notaryUrl: string };
        error?: { code: string; message: string };
      };

      if (!apiResponse.success || !apiResponse.data) {
        throw new Error(
          `VLayer proof generation failed: ${apiResponse.error?.message || "Unknown error"}`,
        );
      }

      // Transform API response to WebProofResponse format
      const webProof: WebProofResponse = {
        success: apiResponse.success,
        data: apiResponse.data,
        version: apiResponse.version || "0.1.0-alpha.12",
        meta: apiResponse.meta || { notaryUrl: "" },
        // For backward compatibility, create presentation field
        presentation: JSON.stringify({
          presentationJson: apiResponse.data,
          version: apiResponse.version,
          meta: apiResponse.meta,
        }),
      };

      return webProof;
    } catch (error) {
      console.error("Error generating web proof:", error);
      throw error;
    }
  }

  /**
   * Executes a request through VLayer API and returns both proof and HTTP response
   * This method makes a single request to VLayer which executes the target request
   * and returns both the cryptographic proof and the HTTP response.
   *
   * Note: This may fail for authenticated requests. Use generateWebProof instead if you already have the response.
   */
  async executeWithProof(
    request: WebProofRequest,
  ): Promise<ExecutedRequestWithProof> {
    try {
      const proof = await this.generateWebProof(request);

      // Parse the proof hex data to extract HTTP response
      let parsedProof: ReturnType<typeof parseWebProofHex>;
      try {
        parsedProof = parseWebProofHex(proof.data);
      } catch (parseError) {
        throw new Error(
          `Failed to parse VLayer proof data: ${(parseError as Error).message}`,
        );
      }

      // Extract HTTP response from parsed proof
      if (!parsedProof.response) {
        throw new Error("VLayer proof data does not contain HTTP response");
      }

      const httpResponse = {
        status: parsedProof.response.statusCode,
        statusText: parsedProof.response.statusText,
        headers: parsedProof.response.headers,
        body:
          parsedProof.response.bodyText ||
          (parsedProof.response.bodyJson
            ? JSON.stringify(parsedProof.response.bodyJson)
            : ""),
      };

      return {
        proof,
        httpResponse,
      };
    } catch (error) {
      console.error("Error executing request with proof:", error);
      throw error;
    }
  }

  /**
   * Validates a web proof presentation
   */
  static validateWebProof(webProof: WebProofResponse): boolean {
    try {
      // New format: check for data, version, and meta fields
      if (
        webProof.success &&
        webProof.data &&
        webProof.version &&
        webProof.meta
      ) {
        // Validate data is a hex string
        if (
          typeof webProof.data === "string" &&
          /^[0-9a-fA-F]+$/.test(webProof.data)
        ) {
          return true;
        }
      }

      // Legacy format: check presentation field
      if (webProof.presentation && typeof webProof.presentation === "string") {
        try {
          const parsed = JSON.parse(webProof.presentation);
          return !!(parsed.presentationJson && parsed.meta && parsed.version);
        } catch {
          return false;
        }
      }

      return false;
    } catch (error) {
      console.error("Error validating web proof:", error);
      return false;
    }
  }
}
