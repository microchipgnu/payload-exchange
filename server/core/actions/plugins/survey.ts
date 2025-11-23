import type { ActionPlugin } from "../action-plugin";

interface SurveyConfig {
  question: string;
  options?: string[];
  type?: "text" | "multiple-choice";
}

export const surveyPlugin: ActionPlugin<SurveyConfig> = {
  id: "survey",
  name: "Survey",

  describe(config) {
    return {
      humanInstructions:
        "Users will answer the survey question you configure. You can ask text or multiple-choice questions.",
      schema: {
        type: "object",
        properties: {
          answer: {
            type: config?.type === "multiple-choice" ? "string" : "string",
          },
        },
        required: ["answer"],
      },
    };
  },

  async start(ctx) {
    const instanceId = `${ctx.actionId}-${ctx.userId}-${Date.now()}`;
    return {
      instanceId,
      instructions:
        ctx.config?.question || "Please answer the survey question.",
      metadata: {
        type: ctx.config?.type || "text",
        options: ctx.config?.options || [],
      },
    };
  },

  async validate(ctx) {
    const { input } = ctx;
    const answer = input?.answer;

    if (!answer || typeof answer !== "string" || answer.trim().length === 0) {
      return {
        status: "failed",
        reason: "Answer is required",
        rewardEligible: false,
      };
    }

    // If multiple choice, validate against options
    if (ctx.config?.type === "multiple-choice" && ctx.config?.options) {
      if (!ctx.config.options.includes(answer)) {
        return {
          status: "failed",
          reason: "Invalid answer option",
          rewardEligible: false,
        };
      }
    }

    return {
      status: "completed",
      rewardEligible: true,
    };
  },
};
