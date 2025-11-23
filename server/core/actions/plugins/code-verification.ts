import type { ActionPlugin } from "../action-plugin";

interface CodeVerificationConfig {
  code?: string; // If not provided, will generate random
  length?: number;
}

export const codeVerificationPlugin: ActionPlugin<CodeVerificationConfig> = {
  id: "code-verification",
  name: "Code Verification",

  describe(config) {
    return {
      humanInstructions:
        "Users will enter a verification code that you set. Useful for gated content or events.",
      schema: {
        type: "object",
        properties: {
          code: {
            type: "string",
          },
        },
        required: ["code"],
      },
    };
  },

  async start(ctx) {
    const instanceId = `${ctx.actionId}-${ctx.userId}-${Date.now()}`;
    const length = ctx.config?.length || 6;

    // Generate a random code if not provided
    let code = ctx.config?.code;
    if (!code) {
      code = Math.random()
        .toString(36)
        .substring(2, 2 + length)
        .toUpperCase();
    }

    // Store the code in metadata (in production, store in DB/cache)
    return {
      instanceId,
      instructions: `Enter the verification code: ${code}`,
      metadata: {
        expectedCode: code,
      },
    };
  },

  async validate(ctx) {
    const { input } = ctx;
    const providedCode = input?.code;
    const expectedCode = ctx.config?.code;

    if (!providedCode || typeof providedCode !== "string") {
      return {
        status: "failed",
        reason: "Verification code is required",
        rewardEligible: false,
      };
    }

    if (!expectedCode) {
      return {
        status: "failed",
        reason: "Verification code not configured",
        rewardEligible: false,
      };
    }

    // Case-insensitive comparison
    if (providedCode.toUpperCase() !== expectedCode.toUpperCase()) {
      return {
        status: "failed",
        reason: "Invalid verification code",
        rewardEligible: false,
      };
    }

    return {
      status: "completed",
      rewardEligible: true,
    };
  },
};
