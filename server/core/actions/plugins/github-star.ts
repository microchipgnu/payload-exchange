import type { ActionPlugin } from "../action-plugin";

interface GitHubStarConfig {
  repository: string; // e.g., "owner/repo"
}

export const githubStarPlugin: ActionPlugin<GitHubStarConfig> = {
  id: "github-star",
  name: "GitHub Star",

  describe(config) {
    return {
      humanInstructions: `Users will star your GitHub repository${config?.repository ? ` (${config.repository})` : ""}.`,
      schema: {
        type: "object",
        properties: {
          githubUsername: {
            type: "string",
          },
        },
        required: ["githubUsername"],
      },
    };
  },

  async start(ctx) {
    const instanceId = `${ctx.actionId}-${ctx.userId}-${Date.now()}`;
    const repo = ctx.config?.repository || "";
    const repoUrl = repo ? `https://github.com/${repo}` : "";

    return {
      instanceId,
      instructions: `Please star the GitHub repository: ${repo}`,
      url: repoUrl,
      metadata: {
        repository: repo,
      },
    };
  },

  async validate(ctx) {
    const { input } = ctx;
    const githubUsername = input?.githubUsername;
    const repository = ctx.config?.repository;

    if (!githubUsername || typeof githubUsername !== "string") {
      return {
        status: "failed",
        reason: "GitHub username is required",
        rewardEligible: false,
      };
    }

    if (!repository) {
      return {
        status: "failed",
        reason: "Repository not configured",
        rewardEligible: false,
      };
    }

    // In a real implementation, you would check GitHub API to verify the star
    // For now, we'll trust the user input
    // TODO: Implement GitHub API verification
    return {
      status: "completed",
      rewardEligible: true,
    };
  },
};
