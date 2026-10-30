export type SupportedLanguage = "pt" | "es" | "en" | "fr";
export type SupportedCountry = "PT" | "ES" | "FR" | "GB";

export interface ChatCopy {
  header: { title: string; status: string };
  greeting: string[];
  contact_step: {
    intro: string;
    name_label: string;
    email_label: string;
    whatsapp_label: string;
    country_label: string;
    consent_text: string;
    submit: string;
    errors: {
      name: string;
      email: string;
      whatsapp: string;
      consent: string;
      generic: string;
    };
  };
  after_contact: string;
  reactions: string[];
  calculating: string;
  result: {
    intro: string;
    scenarios: Record<ScenarioKey, string>;
    per_month: string;
    month12_label: string;
    avg_label: string;
    rank_label: string;
    assumptions_title: string;
    disclaimer: string;
    example_table_notice: string;
    analysis_title: string;
    plan_title: string;
    week_label: string;
    pdf_ready: string;
    pdf_pending: string;
    pdf_download: string;
    cta_signup: string;
    cta_whatsapp: string;
    whatsapp_prefill: string;
    restart: string;
  };
  errors: { network: string; rate_limit: string };
}

export interface ApiOption {
  value: string;
  label: string;
}

export interface ApiQuestion {
  key: string;
  text: string;
  options: ApiOption[];
}

export interface ContactFields {
  name: string;
  email: string;
  whatsapp: string;
  country: SupportedCountry;
  consent: boolean;
  website: string;
}

export type UTMValues = Partial<Record<"utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term", string>>;

export interface DiagnosticSession {
  id: string;
  token: string;
}

export interface Answer {
  key: string;
  value: string;
  label: string;
}

export type ScenarioKey = "conservador" | "provavel" | "ambicioso";

export interface Scenario {
  monthly: number[];
  month12: number;
  avg_monthly: number;
  rank_label: string;
  inputs?: {
    clients_per_month: number;
    avg_order: number;
    recruits_per_month: number;
  };
}

export interface ResultPlanWeek {
  week: number;
  title: string;
  actions: string[];
}

export interface DiagnosticResult {
  scenarios: Record<ScenarioKey, Scenario>;
  currency: string;
  is_example?: boolean;
  example_notice?: string | null;
  assumptions: string[];
  disclaimer?: string;
  profile: string;
  profile_label: string;
  analysis: string;
  plan30: ResultPlanWeek[];
  cta: {
    signup_url?: string;
    whatsapp_url?: string | null;
    leader: { name: string; brand_name: string; photo_url?: string | null };
  };
  pdf_status?: string;
}

export interface PublicLeader {
  name: string;
  slug: string;
  photo_url?: string | null;
  whatsapp_e164?: string | null;
  bio?: string | null;
  country?: string | null;
}

export type FlowPhase = "loading" | "contact" | "questions" | "finishing" | "result";
export type RetryOperation = "questions" | "start" | "country" | "answer" | "finish" | null;
