import { createHash, randomUUID } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatTicketNumber } from "@/lib/giveaway-format";
import type { Giveaway, GiveawayLog, GiveawayResult, GiveawayTicket, Profile, Subscription } from "@/lib/types";

export type AdminGiveawayData = {
  giveaways: Giveaway[];
  giveawayTickets: GiveawayTicket[];
  giveawayResults: GiveawayResult[];
  giveawayLogs: GiveawayLog[];
};

export type GiveawayParticipantRow = GiveawayTicket & {
  profiles?: Pick<Profile, "email" | "full_name" | "is_premium"> | null;
};

export function referralProgress(validReferrals: number) {
  const capped = Math.min(Math.max(validReferrals, 0), 50);
  const currentStep = Math.floor(capped / 10) * 10;
  const nextStep = Math.min(currentStep + 10, 50);

  return {
    nextTarget: nextStep,
    current: capped,
    target: nextStep
  };
}

export async function syncGiveawayTickets(admin: SupabaseClient, userId?: string | null) {
  const { data, error } = await admin.rpc("sync_giveaway_tickets", { p_user_id: userId ?? null });

  if (error) {
    throw new Error("Falta ejecutar el SQL de sorteos en Supabase.");
  }

  return data as { ok?: boolean; inserted?: number } | null;
}

export async function getUserGiveaways(admin: SupabaseClient, userId: string) {
  await syncGiveawayTickets(admin, userId);

  const [giveawaysResult, ticketsResult, referralsResult] = await Promise.all([
    admin
      .from("giveaways")
      .select("*")
      .eq("status", "active")
      .order("draw_date", { ascending: true })
      .order("draw_time", { ascending: true }),
    admin
      .from("giveaway_tickets")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("assigned_at", { ascending: true }),
    admin.from("referral_events").select("id", { count: "exact", head: true }).eq("referrer_user_id", userId).eq("status", "valid")
  ]);

  if (giveawaysResult.error || ticketsResult.error) {
    throw new Error("Falta ejecutar el SQL de sorteos en Supabase.");
  }

  const giveaways = (giveawaysResult.data ?? []) as Giveaway[];
  const tickets = (ticketsResult.data ?? []) as GiveawayTicket[];
  const validReferrals = referralsResult.count ?? 0;
  const progress = referralProgress(validReferrals);

  return giveaways.map((giveaway) => ({
    giveaway,
    tickets: tickets.filter((ticket) => ticket.giveaway_id === giveaway.id),
    valid_referrals: validReferrals,
    referral_next_target: progress.nextTarget,
    referral_progress_current: progress.current,
    referral_progress_target: progress.target
  }));
}

export async function getAdminGiveawayData(admin: SupabaseClient): Promise<AdminGiveawayData> {
  const [giveaways, giveawayTickets, giveawayResults, giveawayLogs] = await Promise.all([
    admin.from("giveaways").select("*").order("draw_date", { ascending: false }).limit(80),
    admin
      .from("giveaway_tickets")
      .select("*")
      .order("assigned_at", { ascending: false })
      .limit(600),
    admin.from("giveaway_results").select("*").order("created_at", { ascending: false }).limit(80),
    admin.from("giveaway_logs").select("*").order("created_at", { ascending: false }).limit(120)
  ]);

  if (giveaways.error || giveawayTickets.error || giveawayResults.error || giveawayLogs.error) {
    return {
      giveaways: [],
      giveawayTickets: [],
      giveawayResults: [],
      giveawayLogs: []
    };
  }

  return {
    giveaways: (giveaways.data ?? []) as Giveaway[],
    giveawayTickets: (giveawayTickets.data ?? []) as GiveawayTicket[],
    giveawayResults: (giveawayResults.data ?? []) as GiveawayResult[],
    giveawayLogs: (giveawayLogs.data ?? []) as GiveawayLog[]
  };
}

export function parseOfficialNumbers(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item >= 0 && item <= 9999).slice(0, 20);
  }

  if (typeof value !== "string") return [];

  return value
    .split(/[\s,;.-]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 9999)
    .slice(0, 20);
}

export function normalizeGiveawayPayload(payload: Record<string, unknown>) {
  const drawDate = String(payload.draw_date ?? "").trim();
  if (!drawDate) throw new Error("Falta fecha del sorteo.");

  const name = String(payload.name ?? "").trim();
  if (!name) throw new Error("Falta nombre del sorteo.");

  const prizeLabel = String(payload.prize_label ?? "").trim();
  if (!prizeLabel) throw new Error("Falta premio del sorteo.");

  return {
    slug: String(payload.slug ?? name.toLowerCase().replace(/[^a-z0-9]+/g, "-")).replace(/^-+|-+$/g, ""),
    name,
    type: payload.type === "annual" || payload.type === "custom" ? payload.type : "monthly",
    prize_label: prizeLabel,
    prize_currency: String(payload.prize_currency ?? "USD").trim().toUpperCase(),
    prize_amount: Number(payload.prize_amount ?? 0),
    prize_ars_equivalent: payload.prize_ars_equivalent === "" || payload.prize_ars_equivalent === null ? null : Number(payload.prize_ars_equivalent ?? 0),
    draw_date: drawDate,
    draw_time: String(payload.draw_time ?? "22:00").trim() || "22:00",
    status: payload.status === "paused" || payload.status === "closed" || payload.status === "completed" ? payload.status : "active",
    starts_at: String(payload.starts_at ?? new Date().toISOString()),
    closes_at: payload.closes_at ? String(payload.closes_at) : null,
    selection_method: String(payload.selection_method ?? "quiniela_mendoza_nocturna"),
    max_numbers_per_user: Number(payload.max_numbers_per_user ?? 12),
    allow_free: payload.allow_free !== false,
    allow_tracking: payload.allow_tracking !== false,
    allow_premium: payload.allow_premium === true,
    allow_referrals: payload.allow_referrals !== false,
    free_chances: Number(payload.free_chances ?? 1),
    tracking_chances: Number(payload.tracking_chances ?? 6),
    premium_chances: Number(payload.premium_chances ?? 0),
    referral_step: Number(payload.referral_step ?? 10),
    referral_bonus_chances: Number(payload.referral_bonus_chances ?? 1),
    referral_bonus_max: Number(payload.referral_bonus_max ?? 5),
    legal_text: String(payload.legal_text ?? "Bases y condiciones pendientes de revision legal."),
    legal_version: String(payload.legal_version ?? "1.0")
  };
}

export async function upsertGiveaway(admin: SupabaseClient, payload: Record<string, unknown>) {
  const normalized = normalizeGiveawayPayload(payload);
  const { data, error } = await admin.from("giveaways").upsert(normalized, { onConflict: "slug" }).select("*").single();

  if (error) {
    throw new Error(error.message);
  }

  await syncGiveawayTickets(admin, null);

  return data as Giveaway;
}

export async function updateGiveawayStatus(admin: SupabaseClient, giveawayId: string, status: Giveaway["status"]) {
  const { error } = await admin.from("giveaways").update({ status }).eq("id", giveawayId);
  if (error) throw new Error(error.message);

  await admin.from("giveaway_logs").insert({
    giveaway_id: giveawayId,
    action: "status_changed",
    detail: { status }
  });
}

export async function updateGiveawayLegalText(
  admin: SupabaseClient,
  giveawayId: string,
  legalText: string,
  legalVersion: string
) {
  const normalizedText = legalText.trim();
  const normalizedVersion = legalVersion.trim() || "1.0";

  if (!normalizedText) {
    throw new Error("Las bases y condiciones no pueden quedar vacias.");
  }

  const { data, error } = await admin
    .from("giveaways")
    .update({
      legal_text: normalizedText,
      legal_version: normalizedVersion
    })
    .eq("id", giveawayId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  await admin.from("giveaway_logs").insert({
    giveaway_id: giveawayId,
    action: "legal_updated",
    detail: { legal_version: normalizedVersion }
  });

  return data as Giveaway;
}

export async function findWinnerByOfficialNumbers(
  admin: SupabaseClient,
  giveawayId: string,
  officialNumbers: number[],
  officialDrawDate?: string | null
) {
  if (!officialNumbers.length) {
    throw new Error("Cargá al menos un numero oficial.");
  }

  await syncGiveawayTickets(admin, null);

  const { data: tickets, error } = await admin
    .from("giveaway_tickets")
    .select("*")
    .eq("giveaway_id", giveawayId)
    .eq("status", "active");

  if (error) throw new Error(error.message);

  const activeTickets = ((tickets ?? []) as GiveawayTicket[]).sort((a, b) => a.assigned_at.localeCompare(b.assigned_at));
  const winner = officialNumbers
    .map((number, index) => ({
      number,
      prizePosition: index + 1,
      ticket: activeTickets.find((ticket) => ticket.ticket_number === number) ?? null
    }))
    .find((item) => item.ticket);

  if (!winner?.ticket) {
    await admin.from("giveaway_logs").insert({
      giveaway_id: giveawayId,
      action: "official_result_without_match",
      detail: { official_numbers: officialNumbers, participant_ticket_count: activeTickets.length }
    });

    return null;
  }

  const { data: result, error: resultError } = await admin
    .from("giveaway_results")
    .insert({
      giveaway_id: giveawayId,
      source: "quiniela_mendoza_nocturna",
      official_draw_date: officialDrawDate || null,
      official_numbers: officialNumbers,
      winning_number: winner.number,
      winning_prize_position: winner.prizePosition,
      winner_user_id: winner.ticket.user_id,
      winning_ticket_id: winner.ticket.id,
      method: "official_exact",
      participant_ticket_count: activeTickets.length
    })
    .select("*")
    .single();

  if (resultError) throw new Error(resultError.message);

  await Promise.all([
    admin.from("giveaway_tickets").update({ status: "winner" }).eq("id", winner.ticket.id),
    admin.from("giveaways").update({ status: "completed" }).eq("id", giveawayId),
    admin.from("giveaway_logs").insert({
      giveaway_id: giveawayId,
      user_id: winner.ticket.user_id,
      ticket_id: winner.ticket.id,
      action: "winner_found_by_official_result",
      detail: { winning_number: winner.number, prize_position: winner.prizePosition }
    })
  ]);

  return result as GiveawayResult;
}

export async function runAutomaticGiveawayFallback(admin: SupabaseClient, giveawayId: string) {
  await syncGiveawayTickets(admin, null);

  const { data: tickets, error } = await admin
    .from("giveaway_tickets")
    .select("*")
    .eq("giveaway_id", giveawayId)
    .eq("status", "active")
    .order("assigned_at", { ascending: true });

  if (error) throw new Error(error.message);

  const activeTickets = (tickets ?? []) as GiveawayTicket[];
  if (!activeTickets.length) throw new Error("No hay tickets activos para sortear.");

  const seed = `${giveawayId}:${new Date().toISOString()}:${randomUUID()}`;
  const hash = createHash("sha256").update(seed).digest("hex");
  const randomIndex = parseInt(hash.slice(0, 12), 16) % activeTickets.length;
  const ticket = activeTickets[randomIndex];

  const { data: result, error: resultError } = await admin
    .from("giveaway_results")
    .insert({
      giveaway_id: giveawayId,
      source: "automatico_auditable",
      official_numbers: [],
      winning_number: ticket.ticket_number,
      winner_user_id: ticket.user_id,
      winning_ticket_id: ticket.id,
      method: "automatic_fallback",
      participant_ticket_count: activeTickets.length,
      seed,
      random_index: randomIndex
    })
    .select("*")
    .single();

  if (resultError) throw new Error(resultError.message);

  await Promise.all([
    admin.from("giveaway_tickets").update({ status: "winner" }).eq("id", ticket.id),
    admin.from("giveaways").update({ status: "completed" }).eq("id", giveawayId),
    admin.from("giveaway_logs").insert({
      giveaway_id: giveawayId,
      user_id: ticket.user_id,
      ticket_id: ticket.id,
      action: "winner_found_by_automatic_fallback",
      detail: { seed, random_index: randomIndex, participant_ticket_count: activeTickets.length, winning_number: ticket.ticket_number }
    })
  ]);

  return result as GiveawayResult;
}

export async function getGiveawayExportRows(admin: SupabaseClient, giveawayId: string) {
  const [ticketsResult, subscriptionsResult, referralsResult, giveawayResult] = await Promise.all([
    admin
      .from("giveaway_tickets")
      .select("*, profiles(email, full_name, is_premium)")
      .eq("giveaway_id", giveawayId)
      .order("ticket_number", { ascending: true }),
    admin.from("subscriptions").select("*").in("status", ["trial", "active", "grace"]),
    admin.from("referral_events").select("referrer_user_id,status").eq("status", "valid"),
    admin.from("giveaways").select("*").eq("id", giveawayId).maybeSingle()
  ]);

  if (ticketsResult.error || giveawayResult.error) {
    throw new Error("No se pudo exportar el sorteo.");
  }

  const subscriptions = ((subscriptionsResult.data ?? []) as Subscription[]).reduce<Record<string, string>>((acc, item) => {
    acc[item.user_id] = item.plan;
    return acc;
  }, {});
  const referrals = ((referralsResult.data ?? []) as Array<{ referrer_user_id: string }>).reduce<Record<string, number>>((acc, item) => {
    acc[item.referrer_user_id] = (acc[item.referrer_user_id] ?? 0) + 1;
    return acc;
  }, {});
  const giveaway = giveawayResult.data as Giveaway | null;

  return {
    giveaway,
    rows: ((ticketsResult.data ?? []) as GiveawayParticipantRow[]).map((ticket) => ({
      sorteo: giveaway?.name ?? ticket.giveaway_id,
      usuario: ticket.user_id,
      email: ticket.profiles?.email ?? "",
      plan: subscriptions[ticket.user_id] ?? "free",
      numero: formatTicketNumber(ticket.ticket_number),
      origen: ticket.origin,
      fecha_asignacion: ticket.assigned_at,
      estado: ticket.status,
      referidos_validos: referrals[ticket.user_id] ?? 0
    }))
  };
}

export function toCsv(rows: Array<Record<string, string | number>>) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escapeCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

  return [headers.join(","), ...rows.map((row) => headers.map((header) => escapeCell(row[header] ?? "")).join(","))].join("\n");
}
