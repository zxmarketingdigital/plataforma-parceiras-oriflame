import type { Copy, Locale } from "@/core/i18n";
import { fill } from "@/core/i18n";
import type { PublicLeader } from "./public-leader";

export type TrackingParams = Partial<Record<"utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term", string>>;

export type LandingProps = {
  copy: Copy;
  lang: Locale;
  leader: PublicLeader;
  diagnosticHref: string;
  tracking: TrackingParams;
};

export function withLeader(text: string, leader: PublicLeader): string {
  return fill(text, { leader_name: leader.name });
}
