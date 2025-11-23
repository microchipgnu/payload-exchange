import type { ActionPlugin } from "../action-plugin";

interface EmailCaptureConfig {
  placeholder?: string;
  buttonText?: string;
}

export const emailCapturePlugin: ActionPlugin<EmailCaptureConfig> = {
  id: "email-capture",
  name: "Email Capture",

  describe(config) {
    return {
      humanInstructions:
        "Users will enter their email address. Great for building your mailing list.",
      schema: {
        type: "object",
        properties: {
          email: {
            type: "string",
            format: "email",
          },
        },
        required: ["email"],
      },
    };
  },

  async start(ctx) {
    const instanceId = `${ctx.actionId}-${ctx.userId}-${Date.now()}`;
    return {
      instanceId,
      instructions: "Please enter your email address to continue.",
      metadata: {
        placeholder: ctx.config?.placeholder || "your@email.com",
        buttonText: ctx.config?.buttonText || "Submit",
      },
    };
  },

  async validate(ctx) {
    const { input } = ctx;
    const email = input?.email;

    if (!email || typeof email !== "string") {
      return {
        status: "failed",
        reason: "Email is required",
        rewardEligible: false,
      };
    }

    // Trim whitespace and validate
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return {
        status: "failed",
        reason: "Email is required",
        rewardEligible: false,
      };
    }

    // Basic email validation (more permissive regex)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return {
        status: "failed",
        reason: `Invalid email format: "${trimmedEmail}"`,
        rewardEligible: false,
      };
    }

    return {
      status: "completed",
      rewardEligible: true,
    };
  },
};
