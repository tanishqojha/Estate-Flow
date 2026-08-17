/**
 * EstateFlow CRM — demo tenant seed (PRD §10).
 * Creates: 1 org, 5 users (admin, 2 agents, field exec, social manager),
 * 20 leads, 10 properties (+ placeholder images), sample calls, follow-ups,
 * attendance and social posts — all through the service-role client.
 *
 * Run:  pnpm seed
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 * (works against `supabase start` local stack or a hosted project).
 */

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";
import type { Database, LeadSource, LeadStatus, LeadTemperature, PropertyType, UserRole } from "../lib/types/database";

loadEnv({ path: ".env.local" });
loadEnv({ path: ".env" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Seed requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Local stack: run `supabase start` and copy the printed values into .env.local.",
  );
  process.exit(1);
}

const db = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ORG_SLUG = "sunrise-realty";
const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "EstateFlow!Demo1";

interface SeedUser {
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
}

const SEED_USERS: SeedUser[] = [
  { email: "admin@sunrise.demo", fullName: "Priya Sharma", phone: "+919800000001", role: "admin" },
  { email: "agent1@sunrise.demo", fullName: "Rahul Verma", phone: "+919800000002", role: "sales_agent" },
  { email: "agent2@sunrise.demo", fullName: "Sneha Iyer", phone: "+919800000003", role: "sales_agent" },
  { email: "field1@sunrise.demo", fullName: "Vikram Patil", phone: "+919800000004", role: "field_executive" },
  { email: "social1@sunrise.demo", fullName: "Ananya Rao", phone: "+919800000005", role: "social_media_manager" },
];

const FIRST_NAMES = ["Aarav", "Isha", "Kabir", "Meera", "Rohan", "Divya", "Arjun", "Nisha", "Sameer", "Pooja",
  "Karan", "Tanvi", "Aditya", "Ritu", "Nikhil", "Shreya", "Manish", "Anjali", "Varun", "Kavya"];
const LOCATIONS = ["Baner", "Wakad", "Hinjewadi", "Kharadi", "Viman Nagar", "Koregaon Park", "Aundh", "Hadapsar"];
const SOURCES: LeadSource[] = ["36_acre", "magicbricks", "housing", "facebook", "instagram", "website", "referral", "manual"];
const STATUSES: LeadStatus[] = ["new", "new", "new", "contacted", "contacted", "interested", "site_visit_scheduled", "negotiation", "won", "lost", "not_responding"];
const TEMPS: LeadTemperature[] = ["cold", "warm", "warm", "hot"];
const PTYPES: PropertyType[] = ["apartment", "villa", "plot", "commercial", "rental"];

function pick<T>(arr: readonly T[], i: number): T {
  const v = arr[i % arr.length];
  if (v === undefined) throw new Error("pick: empty array");
  return v;
}

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 86_400_000).toISOString();
}

async function main() {
  // Idempotency: bail out if the demo org already exists.
  const { data: existing } = await db
    .from("organizations")
    .select("id")
    .eq("slug", ORG_SLUG)
    .maybeSingle();
  if (existing) {
    console.log(`Demo org "${ORG_SLUG}" already seeded (${existing.id}). Nothing to do.`);
    return;
  }

  console.log("Creating organization…");
  const { data: org, error: orgErr } = await db
    .from("organizations")
    .insert({ name: "Sunrise Realty", slug: ORG_SLUG })
    .select()
    .single();
  if (orgErr || !org) throw new Error(`org insert failed: ${orgErr?.message}`);

  console.log("Creating integration settings (webhook secret)…");
  const { data: settings, error: settingsErr } = await db
    .from("integration_settings")
    .insert({ organization_id: org.id })
    .select("webhook_secret")
    .single();
  if (settingsErr || !settings) throw new Error(`settings insert failed: ${settingsErr?.message}`);

  console.log("Creating auth users + profiles…");
  const userIds: Record<string, string> = {};
  for (const u of SEED_USERS) {
    const { data: created, error } = await db.auth.admin.createUser({
      email: u.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
      app_metadata: { organization_id: org.id, role: u.role },
      user_metadata: { full_name: u.fullName, phone: u.phone },
    });
    if (error || !created.user) throw new Error(`auth user ${u.email} failed: ${error?.message}`);
    userIds[u.email] = created.user.id;

    // handle_new_user trigger creates the profile; make phone/name exact.
    const { error: profErr } = await db
      .from("profiles")
      .upsert({
        id: created.user.id,
        organization_id: org.id,
        full_name: u.fullName,
        email: u.email,
        phone: u.phone,
        role: u.role,
      });
    if (profErr) throw new Error(`profile ${u.email} failed: ${profErr.message}`);

    await db.from("team_members").insert({
      organization_id: org.id,
      email: u.email,
      full_name: u.fullName,
      phone: u.phone,
      role: u.role,
      status: "active",
      profile_id: created.user.id,
    });
  }

  const adminId = userIds["admin@sunrise.demo"]!;
  const agent1 = userIds["agent1@sunrise.demo"]!;
  const agent2 = userIds["agent2@sunrise.demo"]!;
  const fieldExec = userIds["field1@sunrise.demo"]!;
  const socialMgr = userIds["social1@sunrise.demo"]!;
  const agents = [agent1, agent2];

  console.log("Creating 10 properties…");
  const propertyIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const ptype = pick(PTYPES, i);
    const loc = pick(LOCATIONS, i);
    const bedrooms = ptype === "plot" || ptype === "commercial" ? null : (i % 3) + 1;
    const { data: prop, error } = await db
      .from("properties")
      .insert({
        organization_id: org.id,
        title: `${bedrooms ? `${bedrooms}BHK ` : ""}${ptype === "plot" ? "Residential Plot" : ptype === "commercial" ? "Commercial Space" : ptype === "villa" ? "Villa" : ptype === "rental" ? "Rental Apartment" : "Apartment"} in ${loc}`,
        location: loc,
        address: `${100 + i}, ${loc} Main Road, Pune`,
        property_type: ptype,
        price: 3_500_000 + i * 1_750_000,
        size: `${800 + i * 150} sq.ft`,
        bedrooms,
        bathrooms: bedrooms,
        floor: ptype === "apartment" ? `${(i % 9) + 1} of 12` : null,
        furnishing_status: ptype === "plot" ? null : pick(["unfurnished", "semi_furnished", "fully_furnished"] as const, i),
        availability_status: i === 8 ? "sold" : i === 9 ? "hold" : "available",
        description: `Well-located ${ptype} in ${loc} with excellent connectivity, close to IT parks, schools and hospitals.`,
        amenities: ["Parking", "Power Backup", "Security", ...(i % 2 ? ["Gym", "Swimming Pool"] : ["Garden"])],
        owner_developer: i % 2 ? "Sunrise Developers" : "Owner Direct",
        cover_image_url: `https://picsum.photos/seed/estate${i}/800/600`,
      })
      .select("id")
      .single();
    if (error || !prop) throw new Error(`property ${i} failed: ${error?.message}`);
    propertyIds.push(prop.id);

    await db.from("property_images").insert(
      [0, 1, 2].map((n) => ({
        organization_id: org.id,
        property_id: prop.id,
        external_url: `https://picsum.photos/seed/estate${i}-${n}/800/600`,
        caption: n === 0 ? "Front view" : n === 1 ? "Living area" : "Neighborhood",
        sort_order: n,
        is_cover: n === 0,
      })),
    );
  }

  console.log("Creating 20 leads + timeline activities…");
  const leadIds: string[] = [];
  for (let i = 0; i < 20; i++) {
    const name = `${pick(FIRST_NAMES, i)} ${["Kulkarni", "Deshmukh", "Joshi", "Singh", "Mehta"][i % 5]}`;
    const status = pick(STATUSES, i);
    const agentId = pick(agents, i);
    const { data: lead, error } = await db
      .from("leads")
      .insert({
        organization_id: org.id,
        full_name: name,
        phone: `+9198765432${String(10 + i)}`,
        email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        source: pick(SOURCES, i),
        property_type: pick(PTYPES, i),
        budget_min: 3_000_000 + (i % 5) * 1_000_000,
        budget_max: 6_000_000 + (i % 5) * 2_000_000,
        preferred_location: pick(LOCATIONS, i),
        status,
        temperature: pick(TEMPS, i),
        assigned_agent_id: agentId,
        notes: i % 3 === 0 ? "Prefers east-facing. Callback after 6pm." : null,
        next_followup_at: status !== "won" && status !== "lost" ? daysFromNow((i % 4) - 1) : null,
        last_contacted_at: status === "new" ? null : daysAgo(i % 6),
        created_at: daysAgo(20 - i),
      })
      .select("id")
      .single();
    if (error || !lead) throw new Error(`lead ${i} failed: ${error?.message}`);
    leadIds.push(lead.id);

    await db.from("activities").insert({
      organization_id: org.id,
      lead_id: lead.id,
      actor_id: null,
      type: "lead_created",
      title: `Lead created from ${pick(SOURCES, i)}`,
      created_at: daysAgo(20 - i),
    });
    await db.from("activities").insert({
      organization_id: org.id,
      lead_id: lead.id,
      actor_id: adminId,
      type: "lead_assigned",
      title: `Assigned to ${agentId === agent1 ? "Rahul Verma" : "Sneha Iyer"}`,
      created_at: daysAgo(20 - i),
    });
  }

  console.log("Creating sample calls…");
  for (let i = 0; i < 8; i++) {
    const leadId = leadIds[i]!;
    const agentId = pick(agents, i);
    const connected = i % 3 !== 2;
    await db.from("calls").insert({
      organization_id: org.id,
      lead_id: leadId,
      agent_id: agentId,
      call_sid: `CA_seed_${randomUUID().slice(0, 12)}`,
      conference_sid: connected ? `conf_seed_${i}` : null,
      status: connected ? "completed" : "no_answer",
      duration: connected ? 120 + i * 45 : null,
      started_at: daysAgo(i % 5),
      ended_at: daysAgo(i % 5),
      outcome: connected ? "connected" : "no_answer",
      is_dry_run: true,
    });
    await db.from("activities").insert({
      organization_id: org.id,
      lead_id: leadId,
      actor_id: agentId,
      type: connected ? "call_completed" : "call_missed",
      title: connected ? `Call completed (${2 + i} min)` : "Call attempted — no answer",
      created_at: daysAgo(i % 5),
    });
  }

  console.log("Creating follow-ups…");
  for (let i = 0; i < 10; i++) {
    const leadId = leadIds[i + 5]!;
    const agentId = pick(agents, i);
    const done = i % 4 === 0;
    await db.from("followups").insert({
      organization_id: org.id,
      lead_id: leadId,
      agent_id: agentId,
      due_at: done ? daysAgo(2) : daysFromNow((i % 5) - 1),
      status: done ? "completed" : "pending",
      note: pick(
        ["Share price sheet", "Confirm site visit slot", "Discuss loan pre-approval", "Send new tower options"],
        i,
      ),
      completed_at: done ? daysAgo(1) : null,
    });
    await db.from("activities").insert({
      organization_id: org.id,
      lead_id: leadId,
      actor_id: agentId,
      type: done ? "followup_completed" : "followup_scheduled",
      title: done ? "Follow-up completed" : "Follow-up scheduled",
    });
  }

  console.log("Creating attendance records…");
  for (let d = 1; d <= 5; d++) {
    for (const uid of [agent1, agent2, fieldExec]) {
      const late = uid === fieldExec && d % 2 === 0;
      const checkIn = new Date(Date.now() - d * 86_400_000);
      checkIn.setHours(late ? 10 : 9, late ? 40 : 15, 0, 0);
      const checkOut = new Date(checkIn);
      checkOut.setHours(18, 30, 0, 0);
      await db.from("attendance").insert({
        organization_id: org.id,
        user_id: uid,
        work_date: checkIn.toISOString().slice(0, 10),
        check_in_time: checkIn.toISOString(),
        check_out_time: checkOut.toISOString(),
        check_in_lat: 18.5204 + Math.random() * 0.01,
        check_in_lng: 73.8567 + Math.random() * 0.01,
        check_out_lat: 18.5204 + Math.random() * 0.01,
        check_out_lng: 73.8567 + Math.random() * 0.01,
        status: late ? "late" : "present",
      });
    }
  }

  console.log("Creating social posts…");
  const socialPosts = [
    { title: "New launch teaser — Baner", status: "published" as const, post_type: "reel" as const, offset: -3 },
    { title: "3BHK walkthrough video", status: "scheduled" as const, post_type: "video" as const, offset: 2 },
    { title: "Festive offer creative", status: "draft" as const, post_type: "image" as const, offset: 4 },
    { title: "Client testimonial series", status: "idea" as const, post_type: "carousel" as const, offset: 7 },
  ];
  for (const p of socialPosts) {
    await db.from("social_posts").insert({
      organization_id: org.id,
      title: p.title,
      caption: p.status === "idea" ? null : `${p.title} — #PuneRealEstate #SunriseRealty`,
      post_type: p.post_type,
      status: p.status,
      scheduled_for: p.status === "idea" ? null : daysFromNow(p.offset),
      published_at: p.status === "published" ? daysAgo(3) : null,
      platforms: ["instagram", "facebook"],
      created_by: socialMgr,
    });
  }

  console.log("\n✅ Seed complete!");
  console.log("──────────────────────────────────────────────");
  console.log(`Org:            Sunrise Realty (${org.id})`);
  console.log(`Webhook secret: ${settings.webhook_secret}`);
  console.log(`Password (all): ${DEMO_PASSWORD}`);
  for (const u of SEED_USERS) console.log(`  ${u.role.padEnd(22)} ${u.email}`);
  console.log("──────────────────────────────────────────────");
  console.log("Webhook test:");
  console.log(
    `  curl -X POST $APP_URL/api/webhooks/leads -H "Content-Type: application/json" \\\n` +
      `    -H "x-webhook-secret: ${settings.webhook_secret}" \\\n` +
      `    -d '{"fullName":"Test Lead","phone":"+919812345678","source":"website"}'`,
  );
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
