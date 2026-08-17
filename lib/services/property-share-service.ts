import { getEnv } from "@/lib/env";
import type {
  PropertyShareService,
  ShareMessageInput,
} from "@/lib/services/types";
import type { ShareChannel } from "@/lib/types/database";

/**
 * propertyShareService — builds public share links + channel-appropriate
 * message templates (PRD §6.6). Actual delivery goes through
 * messageService/emailService; this adapter is pure, so prod = dry-run.
 */

function formatPrice(price: number | null): string {
  if (price === null) return "Price on request";
  if (price >= 10_000_000) return `₹${(price / 10_000_000).toFixed(2)} Cr`;
  if (price >= 100_000) return `₹${(price / 100_000).toFixed(1)} L`;
  return `₹${price.toLocaleString("en-IN")}`;
}

export const propertyShareService: PropertyShareService = {
  buildShareUrl(shareSlug: string): string {
    return `${getEnv().APP_URL}/share/${shareSlug}`;
  },

  buildShareMessage(channel: ShareChannel, input: ShareMessageInput): string {
    const price = formatPrice(input.price);
    const location = input.location ?? "location on request";

    switch (channel) {
      case "whatsapp":
        return (
          `Hi ${input.leadName}! 👋\n\n` +
          `Sharing a property you might like:\n\n` +
          `🏠 *${input.propertyTitle}*\n` +
          `📍 ${location}\n` +
          `💰 ${price}\n\n` +
          `Full details & photos: ${input.shareUrl}\n\n` +
          `— ${input.agentName}`
        );
      case "sms":
        return (
          `Hi ${input.leadName}, sharing a property: ${input.propertyTitle}, ` +
          `${location}, ${price}. Details: ${input.shareUrl} — ${input.agentName}`
        );
      case "email":
        return (
          `Hi ${input.leadName},\n\n` +
          `I thought this property could be a great fit for you:\n\n` +
          `${input.propertyTitle}\n${location}\n${price}\n\n` +
          `View full details and photos here: ${input.shareUrl}\n\n` +
          `Best regards,\n${input.agentName}`
        );
      case "link":
        return input.shareUrl;
    }
  },
};
