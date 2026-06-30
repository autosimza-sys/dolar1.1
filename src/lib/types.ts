export type RateType = "main" | "travel" | "indicator";

export type Channel = "email" | "whatsapp";

export type AlertCondition =
  | "above"
  | "below"
  | "mep_below"
  | "mep_above_blue"
  | "gap_above"
  | "rate_up"
  | "rate_down"
  | "fixed_term_better"
  | "dollar_vs_fixed_term"
  | "travel_opportunity"
  | "clp_strong_move"
  | "brl_strong_move"
  | "eur_strong_move"
  | "official_market_open"
  | "official_market_close"
  | "informal_market_open"
  | "informal_market_close";

export type Profile = {
  id: string;
  email: string;
  phone: string | null;
  full_name: string | null;
  is_premium: boolean;
  referral_code?: string | null;
  referred_by_code?: string | null;
  trial_used?: boolean;
  login_count?: number;
  last_login_at?: string | null;
  created_at: string;
};

export type Rate = {
  id?: string;
  code: string;
  name: string;
  country: string;
  flag: string;
  type: RateType;
  buy_price: number | null;
  sell_price: number | null;
  variation: number;
  source: string | null;
  is_visible: boolean;
  updated_at: string;
};

export type UserAlert = {
  id: string;
  user_id: string;
  rate_code: string;
  condition_type: AlertCondition;
  target_value: number;
  channel: Channel;
  is_active: boolean;
  created_at: string;
};

export type AlertLog = {
  id: string;
  alert_id: string;
  user_id: string;
  message: string;
  sent_at: string;
};

export type EducationCard = {
  id: string;
  title: string;
  content: string;
  category: "dolar" | "plazo fijo" | "inflacion" | "ahorro" | "viajes" | "errores comunes";
  level?: "jovenes" | "ahorristas" | "expertos";
  related_alert_type: AlertCondition;
  is_visible: boolean;
  created_at: string;
};

export type Subscription = {
  id: string;
  user_id: string;
  mercado_pago_payment_id: string | null;
  status: "pending" | "trial" | "active" | "grace" | "paused" | "suspended" | "cancelled" | "expired";
  plan: "free" | "essential_monthly" | "tracking_monthly" | "premium_monthly";
  started_at: string | null;
  expires_at: string | null;
};

export type FavoriteRate = {
  id: string;
  user_id: string;
  rate_code: string;
  created_at: string;
};

export type NotificationJob = {
  id: string;
  alert_id: string;
  user_id: string;
  channel: Channel;
  recipient: string;
  message: string;
  status: "pending" | "processing" | "sent" | "failed" | "skipped";
  attempts: number;
  last_error: string | null;
  created_at: string;
  processed_at: string | null;
};

export type SourceUpdateLog = {
  id: string;
  source: string;
  status: "success" | "partial" | "failed";
  updated_codes: string[];
  errors: string[];
  started_at: string;
  finished_at: string;
};

export type RateSource = {
  id: string;
  key: string;
  name: string;
  provider: string;
  endpoint: string | null;
  parser_type: string;
  priority: number;
  enabled: boolean;
  rate_codes: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RateSourceReading = {
  id: string;
  rate_code: string;
  source_key: string;
  source_name: string;
  buy_price: number | null;
  sell_price: number | null;
  midpoint: number | null;
  status: "accepted" | "rejected" | "fallback";
  reason: string | null;
  payload: Record<string, unknown> | null;
  fetched_at: string;
};

export type RateHistory = {
  id: string;
  rate_code: string;
  buy_price: number | null;
  sell_price: number | null;
  variation: number;
  source_count: number;
  confidence_score: number;
  created_at: string;
};

export type CommunityReportStatus = "approved" | "pending" | "suspicious" | "rejected";

export type CommunityReport = {
  id: string;
  operation_type: "buy" | "sell";
  currency: string;
  amount: number;
  rate: number;
  department: string;
  comment: string | null;
  status: CommunityReportStatus;
  moderation_reason: string | null;
  include_in_stats: boolean;
  created_at: string;
};

export type AnalyticsEvent = {
  id: string;
  event_name: string;
  path: string;
  referrer: string | null;
  device: string | null;
  browser: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  source: string | null;
  campaign: string | null;
  created_at: string;
};

export type PaymentEvent = {
  id: string;
  user_id: string;
  mercado_pago_id: string | null;
  plan: "free" | "essential_monthly" | "tracking_monthly" | "premium_monthly";
  status: string;
  payload: Record<string, unknown> | null;
  created_at: string;
};

export type ReferralEvent = {
  id: string;
  referrer_user_id: string;
  referred_user_id: string | null;
  referral_code: string;
  status: "pending" | "valid" | "suspicious" | "rejected";
  created_at: string;
  validated_at: string | null;
  valid_after: string | null;
};

export type ReferralCreditLedger = {
  id: string;
  user_id: string;
  referral_event_id: string | null;
  points: number;
  credit_amount: number;
  type: "earned" | "used" | "expired" | "manual";
  status: "active" | "used" | "expired" | "cancelled";
  description: string | null;
  created_at: string;
  expires_at: string | null;
  applied_at: string | null;
};

export type ReferralSummary = {
  referral_code: string;
  referral_link: string;
  points_active: number;
  credit_available: number;
  referrals_sent: number;
  referrals_valid: number;
  referrals_pending: number;
  next_expiration: string | null;
  level: string;
  history: Array<{
    id: string;
    description: string;
    points: number;
    credit_amount: number;
    status: string;
    created_at: string;
    expires_at: string | null;
  }>;
};

export type SupportMessageStatus = "new" | "resolved";

export type SupportMessage = {
  id: string;
  user_id: string | null;
  name: string;
  email: string;
  reason: string;
  message: string;
  status: SupportMessageStatus;
  created_at: string;
  resolved_at: string | null;
};

export type GiveawayStatus = "draft" | "active" | "paused" | "closed" | "completed";

export type GiveawayType = "monthly" | "annual" | "custom";

export type Giveaway = {
  id: string;
  slug: string;
  name: string;
  type: GiveawayType;
  prize_label: string;
  prize_currency: string;
  prize_amount: number;
  prize_ars_equivalent: number | null;
  draw_date: string;
  draw_time: string;
  status: GiveawayStatus;
  starts_at: string;
  closes_at: string | null;
  selection_method: string;
  max_numbers_per_user: number;
  allow_free: boolean;
  allow_tracking: boolean;
  allow_premium: boolean;
  allow_referrals: boolean;
  free_chances: number;
  tracking_chances: number;
  premium_chances: number;
  referral_step: number;
  referral_bonus_chances: number;
  referral_bonus_max: number;
  rules: Record<string, unknown> | null;
  legal_text: string;
  legal_version: string;
  created_at: string;
  updated_at: string;
};

export type GiveawayTicketOrigin =
  | "registro gratuito"
  | "Plan Seguimiento"
  | "referido"
  | "ajuste administrativo"
  | "sorteo automatico"
  | "otro";

export type GiveawayTicket = {
  id: string;
  giveaway_id: string;
  user_id: string;
  ticket_number: number;
  origin: GiveawayTicketOrigin;
  origin_detail: Record<string, unknown> | null;
  status: "active" | "void" | "winner";
  assigned_at: string;
};

export type GiveawayResult = {
  id: string;
  giveaway_id: string;
  source: string;
  official_draw_date: string | null;
  official_numbers: number[];
  winning_number: number | null;
  winning_prize_position: number | null;
  winner_user_id: string | null;
  winning_ticket_id: string | null;
  method: "official_exact" | "automatic_fallback" | "manual_admin";
  participant_ticket_count: number;
  seed: string | null;
  random_index: number | null;
  created_at: string;
};

export type GiveawayLog = {
  id: string;
  giveaway_id: string | null;
  user_id: string | null;
  ticket_id: string | null;
  action: string;
  detail: Record<string, unknown> | null;
  created_at: string;
};

export type UserGiveawaySummary = {
  giveaway: Giveaway;
  tickets: GiveawayTicket[];
  valid_referrals: number;
  referral_next_target: number;
  referral_progress_current: number;
  referral_progress_target: number;
};
