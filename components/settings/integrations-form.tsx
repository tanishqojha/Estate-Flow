"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  rotateWebhookSecretAction,
  updateIntegrationSettingsAction,
} from "@/app/actions/settings";
import { CopyButton } from "@/components/shared/copy-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ASSIGNMENT_MODE_LABELS } from "@/lib/types";
import type { AssignmentMode } from "@/lib/types/database";

export interface IntegrationsView {
  twilioAccountSid: string;
  twilioPhoneNumber: string;
  whatsappSender: string;
  emailFrom: string;
  aiBaseUrl: string;
  socialDispatchWebhookUrl: string;
  webhookSecret: string;
  defaultAssignmentMode: AssignmentMode;
  hasTwilioToken: boolean;
  hasResendKey: boolean;
  hasAiKey: boolean;
  canStoreSecrets: boolean;
}

function SecretInput({
  id,
  name,
  label,
  isSet,
  disabled,
}: {
  id: string;
  name: string;
  label: string;
  isSet: boolean;
  disabled: boolean;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={name}
        type="password"
        autoComplete="off"
        disabled={disabled}
        placeholder={isSet ? "•••••••• (saved — leave blank to keep)" : "not set"}
      />
    </div>
  );
}

export function IntegrationsForm({ view }: { view: IntegrationsView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rotating, startRotate] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {!view.canStoreSecrets ? (
        <p className="rounded-lg border border-[var(--viz-critical)]/40 bg-destructive/5 p-3 text-sm">
          <strong>Heads up:</strong> SECRETS_ENCRYPTION_KEY isn&apos;t set on the server, so API
          tokens can&apos;t be stored yet. Non-secret fields still save; adapters run in dry-run.
        </p>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const form = new FormData(e.currentTarget);
          const val = (key: string) => String(form.get(key) ?? "").trim();
          startTransition(async () => {
            const result = await updateIntegrationSettingsAction({
              twilioAccountSid: val("twilioAccountSid"),
              twilioAuthToken: val("twilioAuthToken") || null,
              twilioPhoneNumber: val("twilioPhoneNumber"),
              whatsappSender: val("whatsappSender"),
              resendApiKey: val("resendApiKey") || null,
              emailFrom: val("emailFrom"),
              aiApiKey: val("aiApiKey") || null,
              aiBaseUrl: val("aiBaseUrl"),
              socialDispatchWebhookUrl: val("socialDispatchWebhookUrl"),
              defaultAssignmentMode: val("assignmentMode") || "round_robin",
            });
            if (!result.ok) {
              setError(result.error);
              return;
            }
            toast.success("Integrations saved");
            router.refresh();
          });
        }}
        className="space-y-4"
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Voice & messaging (Twilio)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="twilioAccountSid">Account SID</Label>
              <Input
                id="twilioAccountSid"
                name="twilioAccountSid"
                defaultValue={view.twilioAccountSid}
                placeholder="AC…"
                autoComplete="off"
              />
            </div>
            <SecretInput
              id="twilioAuthToken"
              name="twilioAuthToken"
              label="Auth token"
              isSet={view.hasTwilioToken}
              disabled={!view.canStoreSecrets}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="twilioPhoneNumber">Voice number</Label>
                <Input
                  id="twilioPhoneNumber"
                  name="twilioPhoneNumber"
                  defaultValue={view.twilioPhoneNumber}
                  placeholder="+1…"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsappSender">WhatsApp sender</Label>
                <Input
                  id="whatsappSender"
                  name="whatsappSender"
                  defaultValue={view.whatsappSender}
                  placeholder="+1…"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Email (Resend)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SecretInput
              id="resendApiKey"
              name="resendApiKey"
              label="API key"
              isSet={view.hasResendKey}
              disabled={!view.canStoreSecrets}
            />
            <div className="space-y-2">
              <Label htmlFor="emailFrom">From address</Label>
              <Input
                id="emailFrom"
                name="emailFrom"
                defaultValue={view.emailFrom}
                placeholder='"Sunrise Realty" <hello@yourdomain.com>'
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">AI & automation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SecretInput
              id="aiApiKey"
              name="aiApiKey"
              label="AI API key (OpenAI-compatible)"
              isSet={view.hasAiKey}
              disabled={!view.canStoreSecrets}
            />
            <div className="space-y-2">
              <Label htmlFor="aiBaseUrl">AI base URL</Label>
              <Input
                id="aiBaseUrl"
                name="aiBaseUrl"
                defaultValue={view.aiBaseUrl}
                placeholder="https://api.openai.com/v1"
                inputMode="url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="socialDispatchWebhookUrl">Social dispatch webhook</Label>
              <Input
                id="socialDispatchWebhookUrl"
                name="socialDispatchWebhookUrl"
                defaultValue={view.socialDispatchWebhookUrl}
                placeholder="https://hooks.zapier.com/…"
                inputMode="url"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="assignmentMode">Default lead assignment</Label>
              <Select name="assignmentMode" defaultValue={view.defaultAssignmentMode}>
                <SelectTrigger id="assignmentMode" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ASSIGNMENT_MODE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {error ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        ) : null}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Save integrations
        </Button>
      </form>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Lead intake webhook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Give this secret to lead portals (MagicBricks, Housing, your website). They must send
            it as the <code className="rounded bg-muted px-1">x-webhook-secret</code> header to{" "}
            <code className="rounded bg-muted px-1">/api/webhooks/leads</code>.
          </p>
          <p className="break-all rounded-md bg-muted px-3 py-2 font-mono text-xs">
            {view.webhookSecret || "— created on first save —"}
          </p>
          <div className="flex gap-2">
            {view.webhookSecret ? <CopyButton value={view.webhookSecret} label="Copy secret" /> : null}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={rotating}>
                  <RefreshCw aria-hidden /> Rotate
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Rotate the webhook secret?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Every portal using the current secret stops working until you update it there.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={(e) => {
                      e.preventDefault();
                      startRotate(async () => {
                        const result = await rotateWebhookSecretAction();
                        if (!result.ok) {
                          toast.error(result.error);
                          return;
                        }
                        toast.success("Webhook secret rotated");
                        router.refresh();
                      });
                    }}
                  >
                    Rotate
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
