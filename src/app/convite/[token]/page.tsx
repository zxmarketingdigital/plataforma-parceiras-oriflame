import { headers } from "next/headers";
import { isLocale, pickLocale } from "@/core/locale";
import { InvitationForm } from "@/components/painel/auth-forms";

export default async function InvitationPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ lang?: string }> }) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const locale = isLocale(query.lang) ? query.lang : pickLocale((await headers()).get("accept-language"));
  return <InvitationForm locale={locale} token={token} />;
}
