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
  related_alert_type: AlertCondition;
  is_visible: boolean;
  created_at: string;
};

export type Subscription = {
  id: string;
  user_id: string;
  mercado_pago_payment_id: string | null;
  status: "pending" | "active" | "paused" | "cancelled" | "expired";
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
