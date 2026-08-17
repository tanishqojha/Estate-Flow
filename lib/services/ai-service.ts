import "server-only";

import { getEnv } from "@/lib/env";

/**
 * AI caption generation — OpenAI-compatible adapter (PRD §3, optional).
 * Missing key → dry-run canned caption, never a crash (Rules.md §4).
 * Base URL is configurable so any OpenAI-compatible endpoint works.
 */

export interface CaptionInput {
  title: string;
  postType: string;
  platforms: string[];
  extraContext?: string | null;
}

export interface CaptionResult {
  caption: string;
  dryRun: boolean;
}

function dryRunCaption(input: CaptionInput): string {
  const tags = ["#RealEstate", "#DreamHome", "#PropertyGoals"]
    .concat(input.platforms.includes("instagram") ? ["#Reels"] : [])
    .join(" ");
  return (
    `✨ ${input.title} ✨\n\n` +
    `Your next home might be one visit away. DM us or drop a comment to know more!\n\n${tags}`
  );
}

export async function generateCaption(input: CaptionInput): Promise<CaptionResult> {
  const env = getEnv();
  if (env.DRY_RUN || !env.AI_API_KEY) {
    // TODO: set AI_API_KEY (and optionally AI_BASE_URL) for live AI captions.
    console.info("[dry-run] aiService.generateCaption → returning template caption.");
    return { caption: dryRunCaption(input), dryRun: true };
  }

  const baseUrl = (env.AI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.AI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content:
              "You write short, engaging social media captions for a real estate agency. " +
              "Include 3-5 relevant hashtags. Keep it under 100 words. Reply with the caption only.",
          },
          {
            role: "user",
            content:
              `Post title: ${input.title}\nFormat: ${input.postType}\n` +
              `Platforms: ${input.platforms.join(", ") || "any"}` +
              (input.extraContext ? `\nContext: ${input.extraContext}` : ""),
          },
        ],
      }),
    });
    if (!res.ok) {
      console.error(`aiService: provider responded ${res.status} — falling back to template.`);
      return { caption: dryRunCaption(input), dryRun: true };
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const caption = json.choices?.[0]?.message?.content?.trim();
    if (!caption) return { caption: dryRunCaption(input), dryRun: true };
    return { caption, dryRun: false };
  } catch (err) {
    console.error("aiService.generateCaption failed:", err);
    return { caption: dryRunCaption(input), dryRun: true };
  }
}
