import { redirect } from "next/navigation";
import { currentUser } from "@/core/auth/session";
import { isLocale } from "@/core/locale";
import { permissionsOf } from "@/core/permissions";
import { PanelShell } from "@/components/painel/panel-shell";

export default async function AuthenticatedPanelLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/painel/login");
  return <PanelShell user={user} permissions={permissionsOf(user)} initialLocale={isLocale(user.locale) ? user.locale : "pt"}>{children}</PanelShell>;
}
