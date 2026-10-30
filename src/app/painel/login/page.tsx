import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser } from "@/core/auth/session";
import { isLocale, pickLocale } from "@/core/locale";
import { LoginForm } from "@/components/painel/auth-forms";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const user = await currentUser();
  const params = await searchParams;
  if (user) redirect(`/painel?lang=${isLocale(params.lang) ? params.lang : user.locale}`);
  const locale = isLocale(params.lang) ? params.lang : pickLocale((await headers()).get("accept-language"));
  return <LoginForm locale={locale} />;
}
