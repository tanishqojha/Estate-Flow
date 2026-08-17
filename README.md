# EstateFlow CRM

A mobile-first, multi-tenant CRM for small and mid-sized real estate sales teams. The idea it is built around is speed-to-lead: when a lead comes in from a portal like MagicBricks or a website form, the system saves it, picks an agent, phones that agent within seconds, and once the agent presses 1 it dials the lead and drops both of them into a conference call. Nobody has to open the app for first contact to happen.

Everything else in the product exists to support that call and what follows it: the lead's timeline, the property inventory you share with them, the follow-up you schedule, and the reports that tell you whether any of it is working.

Stack: Next.js 15 (App Router) with TypeScript in strict mode, Tailwind and shadcn/ui, Supabase for Postgres, Auth, Storage and Realtime, Twilio for voice, Resend for email, deployed on Vercel.

---

## What the software actually does

### 1. It takes leads in

Leads arrive two ways.

Manually, through `/leads/new`, which is a short mobile form: name, phone, email, source, property type, budget range, preferred location, notes.

Automatically, through `POST /api/webhooks/leads`. Portals, Facebook lead ads and your own website forms post JSON to this endpoint. Each organization has its own webhook secret, sent in an `x-webhook-secret` header (a `Bearer` token also works), and that secret is the only thing that decides which tenant the lead lands in. Nothing about the tenant is read from the request body.

Ingestion is idempotent in two ways. If you send an `externalRef`, a repeat post with the same reference returns the original lead id and does nothing else, and a concurrent duplicate is caught by a unique-constraint violation and resolved the same way. If you don't send one, a second lead with the same phone number inside five minutes is treated as a duplicate. Portals retry, and this stops a retry from spawning two leads and two phone calls.

The payload requires `phone` and `source`. Everything else is optional, and a source the system doesn't recognize is stored as `other`.

### 2. It assigns the lead

Assignment runs through `leadAssignmentService`, using the org's `default_assignment_mode`: round robin, least busy agent, or manual. Round robin orders agents by who was assigned longest ago, least busy orders them by open lead count. The picked agent gets a notification and an `activities` row recording who was chosen and by which rule.

### 3. It calls, agent first

This is the part worth reading closely, because it is the core of the product.

`startBridgeForLead` builds a queue of agents: the assigned agent first, then the remaining agents in fallback order, skipping anyone with no phone number on file. It writes a `calls` row up front with the whole queue in its metadata, then hands off to `callService`.

Twilio dials the agent. When the agent answers, `/api/twilio/voice` returns TwiML that reads out the lead ("New lead: Asha Patel. Apartment, Baner, budget 50 lakh to 80 lakh. Press 1 to connect.") and gathers a single key press. Reading the lead out first matters: the agent knows what they are about to walk into before the conversation starts.

Press 1 and the app dials the lead, puts both legs into a conference named after the call id, and logs the confirmation to the timeline. Press anything else, or say nothing, and the call is marked declined and the bridge moves to the next agent in the queue. Twilio's status callbacks hit `/api/twilio/status`, which drives the same fallback path when the agent leg comes back busy, failed or unanswered.

When the queue runs out, the lead is set to `call_pending`, an urgent task due in an hour is created and assigned to a manager, and every manager gets a notification. A lead nobody answered for does not quietly disappear.

Live Twilio requests are authenticated by verifying the `x-twilio-signature` header against your auth token, so nobody else can drive your call flow by posting to the webhook.

Agents can also start the same bridge by hand from any lead detail page.

### 4. It keeps one timeline per lead

The `activities` table is the audit log and the lead's story in one place. Calls, messages, property shares, notes, follow-ups, status changes, assignment changes and webhook intake all write an activity row alongside their own feature table. The lead detail page renders that timeline in order, so a manager picking up someone else's lead can see everything that happened without asking.

### 5. It manages property inventory and sharing

Properties carry title, location, address, type, price, size, bedrooms, bathrooms, floor, furnishing, availability, description, amenities and owner or developer. They support multiple images and documents, all stored in private Supabase buckets and served through signed URLs.

Each property has an unguessable share slug. `/share/<slug>` is a public page you can send to anyone without a login. From a lead's detail page, "Share" builds a channel-appropriate message (WhatsApp formatting, a short SMS, a plain email body), sends it, records a `lead_property_shares` row, and logs the share to the timeline.

The lead detail page also shows recommended properties, matched against the lead's budget, preferred location and property type, with sold and rented stock filtered out.

### 6. It chases follow-ups

Follow-ups can be scheduled from a lead, given a note from a template, snoozed, completed or cancelled. `/followups` splits them into due, upcoming and done.

A Vercel cron job hits `/api/cron/followups` every five minutes. It finds follow-ups that are due and not yet reminded, notifies the owning agent, and marks the reminder sent so nobody gets pinged twice. The same job notifies social media managers when a scheduled post reaches its publish time. The endpoint is protected by `CRON_SECRET` when that variable is set.

### 7. It tracks field attendance

Field executives check in and out from `/attendance` using the browser's geolocation, with an optional selfie. Coordinates are validated, including a guard against the classic (0,0) reading that means geolocation failed. A check-in at or after 10am in the org's timezone is recorded as late. Managers see who is checked in today and can page through history.

### 8. It runs a social content calendar

Posts move through idea, draft, scheduled and published, with a type (image, video, reel, story, carousel, text) and target platforms. Captions can be generated through an OpenAI-compatible endpoint; with no key configured you get a sensible template instead. Publishing is deliberately not direct: an approved post is POSTed to your own automation webhook (Zapier, Make, Buffer), and the response is stored on the post.

### 9. It reports

`/dashboard` shows new leads today, calls today, follow-ups due, hot leads, site visits, available inventory and an attendance summary, plus a 14-day lead trend and a live activity feed. `/reports` covers leads by source and status, won versus lost, agent call performance, properties shared, follow-ups completed and attendance.

## Roles

| Role | What they do |
|---|---|
| Admin / owner | Invites the team, sets roles, configures integrations, sees everything |
| Sales manager | Assigns and reassigns leads, watches agent performance, owns escalations |
| Sales agent | Works assigned leads: calls, shares, follows up, takes notes |
| Field executive | Attendance, site visits, visit notes |
| Social media manager | Content calendar, drafts and schedules posts |

Roles are enforced in row-level security policies, not only in the UI.

## Dry-run mode

`DRY_RUN=true` is the default, and it flips every service adapter to simulation. Calls, WhatsApp and SMS, email and social dispatch print `[dry-run]` lines and write realistic rows flagged `is_dry_run=true`. The bridge even simulates a connected call of plausible duration so the timeline and the reports have something in them. No external request leaves the process.

Per-provider degradation works the same way. If Twilio credentials are missing but Resend's are present, only the call and message adapters drop to dry-run, each logging a `// TODO` line naming the variable to set. Nothing throws, and nothing half-configured takes the app down.

The practical effect: you can run, demo and develop the entire product without a single paid account.

## Architecture

```
components/ (UI)  →  app/actions/ (server actions)  →  lib/services/ (adapters)  →  lib/db/ (queries)  →  Supabase
```

The rules that hold this together:

The UI never talks to a provider or the database directly. Server actions and route handlers do that. Every piece of external input, whether a webhook body or a form submission, is parsed with Zod on the server before it reaches a query. Any feature that touches a lead writes its `activities` row in the same code path that writes its own table.

There are seven service adapters, each with a production implementation and a dry-run twin behind the same interface: `callService`, `messageService`, `emailService`, `leadAssignmentService`, `propertyShareService`, `attendanceService` and `socialPostService`. `getOrgIntegrationConfig` decides which twin you get, resolving per-org encrypted settings first and falling back to environment variables.

## Data model

Eighteen tables: `organizations`, `profiles`, `team_members`, `lead_sources`, `leads`, `properties`, `property_images`, `property_documents`, `activities`, `calls`, `messages`, `lead_property_shares`, `followups`, `attendance`, `social_posts`, `tasks`, `integration_settings`, `notifications`.

Every row has `id`, `created_at` and `updated_at`. Every tenant table also has a non-null `organization_id`.

Enums cover the moving parts, including lead status (`new`, `contacted`, `interested`, `site_visit_scheduled`, `negotiation`, `won`, `lost`, `not_responding`, `call_pending`), temperature (cold, warm, hot), availability (available, hold, sold, rented), call status and outcome, message channel and status, and social post status.

## Multi-tenancy and security

One schema, shared by all tenants, with isolation enforced per row.

Row-level security is default deny on all 18 tables and on the storage buckets, with explicit per-role policies in `supabase/migrations/0003_rls.sql`. Tenant scope always comes from the session JWT or the webhook secret, never from client input.

`SUPABASE_SERVICE_ROLE_KEY` is server-only and is used for the flows that have no user session: webhook ingestion, the bridge, cron notifications and the seed script. Per-org provider secrets live in `integration_settings`, encrypted with AES-256-GCM under `SECRETS_ENCRYPTION_KEY`, and no RLS policy exposes those columns to a client. All media buckets are private and files go out as signed URLs.

Middleware refreshes the Supabase session on every request and redirects anonymous users to `/login`. Public paths are the login page, share links, the lead webhook and the Twilio callbacks.

## Quick start

```bash
# 1. Install
pnpm install

# 2. Start a local Supabase stack (needs Docker + the supabase CLI)
supabase start          # prints URL + anon + service_role keys

# 3. Configure env
cp .env.example .env.local
#    paste NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
#    SUPABASE_SERVICE_ROLE_KEY from the `supabase start` output.
#    Leave DRY_RUN=true so no external credentials are needed.

# 4. Apply migrations
supabase db push --local      # or: supabase migration up

# 5. Seed the demo tenant (1 org, 5 users, 20 leads, 10 properties, and more)
pnpm seed

# 6. Run
pnpm dev                      # http://localhost:3000
```

The seed prints your webhook secret and a ready-to-paste curl command. Demo logins use the password `EstateFlow!Demo1` unless you set `SEED_PASSWORD`:

| Role | Email |
|---|---|
| Admin | admin@sunrise.demo |
| Sales agent | agent1@sunrise.demo, agent2@sunrise.demo |
| Field executive | field1@sunrise.demo |
| Social media manager | social1@sunrise.demo |

## Testing the intake webhook

```bash
curl -X POST http://localhost:3000/api/webhooks/leads \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: <org-webhook-secret>" \
  -d '{
    "fullName": "Asha Patel",
    "phone": "+919812345678",
    "email": "asha@example.com",
    "source": "magicbricks",
    "propertyType": "apartment",
    "budgetMin": 5000000,
    "budgetMax": 8000000,
    "preferredLocation": "Baner",
    "notes": "Wants possession this year"
  }'
```

The response tells you the lead id, the agent it was assigned to, and what the bridge did, including whether it ran dry.

## Going live with Twilio

1. Buy a voice-capable number and set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_PHONE_NUMBER`, either as environment variables or per organization under Settings → Integrations.
2. Set `APP_URL` to a publicly reachable URL (your Vercel domain, or a tunnel in development) so Twilio can reach `/api/twilio/voice` and `/api/twilio/status`.
3. Set `DRY_RUN=false`.

Signature validation switches on automatically once real credentials are present.

## Deploying

1. Create a hosted Supabase project and run the migrations: `supabase link --project-ref <ref> && supabase db push`.
2. Import the repo into Vercel and set every variable from `.env.example`. At minimum: the three Supabase variables, `APP_URL=https://<your-app>.vercel.app`, and `DRY_RUN`.
3. If you want the demo tenant on the hosted project, run `pnpm seed` locally against it with the same environment variables.
4. Point your provider webhooks at the deployed URL: lead portals to `/api/webhooks/leads`, Twilio to `/api/twilio/voice` and `/api/twilio/status`.

`vercel.json` already registers the five-minute cron for `/api/cron/followups`.

## Route map

| Route | What it is |
|---|---|
| `/dashboard` | KPI tiles, 14-day lead trend, activity feed |
| `/leads`, `/leads/new`, `/leads/:id`, `/leads/:id/edit` | Search and filters, detail plus timeline, status, temperature and assignment controls, notes, one-tap call, share and follow-up |
| `/properties`, `/properties/new`, `/properties/:id`, `/properties/:id/edit` | Inventory, gallery, availability, public share link |
| `/followups` | Due, upcoming and done, with snooze, complete and templates |
| `/attendance` | GPS check-in and check-out with selfie, history, manager roster |
| `/social` | Idea to draft to scheduled to published, AI captions, webhook dispatch |
| `/reports` | Sources, statuses, won and lost, agent calls, shares, attendance |
| `/team` | Roster and the admin invite flow (temporary password shown once) |
| `/settings`, `/settings/integrations` | Org config, encrypted per-org Twilio, Resend and AI credentials, webhook secret with rotation |
| `/notifications` | In-app notification list |
| `/share/:slug` | Public property page, no login required |
| `/api/webhooks/leads` | Secret-authenticated lead intake |
| `/api/twilio/voice`, `/api/twilio/status` | TwiML for the agent leg, and status callbacks |
| `/api/cron/followups` | Due follow-up and social post notifications |

Navigation on mobile is a bottom bar: Dashboard, Leads, Properties, Follow-ups and More, with the rest tucked behind More.

## Project layout

```
app/
  (app)/…                       # role-aware app routes, mobile-first
  share/[slug]/                 # public property page
  api/webhooks/leads/route.ts   # secret-authed lead intake
  api/twilio/{voice,status}/    # TwiML + status callbacks
  api/cron/followups/           # due notifications (Vercel Cron)
  actions/                      # server actions
lib/
  services/                     # the 7 adapters + bridge orchestrator (prod + dry-run)
  db/                           # typed query modules
  validation/                   # Zod schemas
  types/                        # DB + domain types
  supabase/                     # browser / server / admin clients
  crypto.ts                     # AES-256-GCM for per-org secrets
components/                     # shadcn/ui-based UI and hand-rolled SVG charts
supabase/migrations/            # schema, RLS, storage (0001 to 0004)
supabase/seed.ts                # demo tenant
middleware.ts                   # session refresh + route protection
```

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Development server |
| `pnpm build` | Production build, type-checked |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm seed` | Seed the demo tenant |

## What this is not

It is not a listing marketplace, and it does not handle accounting or legal paperwork. It does not publish to social platforms directly; it hands approved posts to your automation webhook and stops there. There are no native app-store builds, though the whole interface is built for a phone screen first.
