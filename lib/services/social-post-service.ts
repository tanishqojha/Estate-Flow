import "server-only";

import type { OrgIntegrationConfig } from "@/lib/services/config";
import type {
  DispatchPostParams,
  DispatchPostResult,
  SocialPostService,
} from "@/lib/services/types";

/**
 * socialPostService — hands approved posts to an external automation webhook
 * (Zapier / Make / Buffer). Direct social publishing is a PRD non-goal.
 */

class DryRunSocialPostService implements SocialPostService {
  readonly dryRun = true;

  async dispatch(params: DispatchPostParams): Promise<DispatchPostResult> {
    console.info(
      `[dry-run] socialPostService.dispatch → would POST post "${params.title}" ` +
        `(${params.postType}) for platforms [${params.platforms.join(", ")}]`,
    );
    return {
      ok: true,
      dryRun: true,
      statusCode: 200,
      responseBody: JSON.stringify({ simulated: true, postId: params.postId }),
    };
  }
}

class WebhookSocialPostService implements SocialPostService {
  readonly dryRun = false;

  constructor(private readonly webhookUrl: string) {}

  async dispatch(params: DispatchPostParams): Promise<DispatchPostResult> {
    try {
      const res = await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "social_post.dispatch",
          post: params,
        }),
      });
      const responseBody = (await res.text()).slice(0, 1000);
      return {
        ok: res.ok,
        dryRun: false,
        statusCode: res.status,
        responseBody,
        error: res.ok ? undefined : `Webhook responded ${res.status}`,
      };
    } catch (err) {
      return {
        ok: false,
        dryRun: false,
        statusCode: null,
        responseBody: null,
        error: err instanceof Error ? err.message : "Webhook dispatch failed",
      };
    }
  }
}

export function createSocialPostService(config: OrgIntegrationConfig): SocialPostService {
  if (config.globalDryRun) return new DryRunSocialPostService();
  if (!config.socialDispatchWebhookUrl) {
    // TODO: set the social dispatch webhook URL (org Settings → Integrations)
    // to hand posts to Zapier/Make/Buffer. Degrading to dry-run.
    console.warn("[dry-run] socialPostService: dispatch webhook URL missing — simulating.");
    return new DryRunSocialPostService();
  }
  return new WebhookSocialPostService(config.socialDispatchWebhookUrl);
}
