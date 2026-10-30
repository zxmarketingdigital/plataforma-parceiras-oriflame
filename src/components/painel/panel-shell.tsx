"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isLocale, LOCALES, type Locale } from "@/core/locale";
import { panelRequest } from "./api-client";
import { getPanelLabels } from "./labels";
import { PanelContextProvider, hasPermission } from "./panel-context";
import type { PanelPermission, PanelUser } from "./types";
import styles from "./panel.module.css";

const NAVIGATION: Array<{ href: string; key: "leads" | "metrics" | "team" | "settings" | "agents"; permission?: PanelPermission }> = [
  { href: "/painel", key: "leads" },
  { href: "/painel/metricas", key: "metrics" },
  { href: "/painel/equipa", key: "team", permission: "team.read" },
  { href: "/painel/definicoes", key: "settings", permission: "settings.write" },
  { href: "/painel/agentes", key: "agents", permission: "agents.read" },
];

export function PanelShell({ user, permissions, initialLocale, children }: { user: PanelUser; permissions: PanelPermission[]; initialLocale: Locale; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlLocale = searchParams.get("lang");
  const [locale, setLocale] = useState<Locale>(isLocale(urlLocale) ? urlLocale : initialLocale);
  const [exampleState, setExampleState] = useState<boolean>();
  const labels = getPanelLabels(locale);
  const settingsDirty = useRef(false);
  useEffect(() => { const onDirty = (event: Event) => { settingsDirty.current = (event as CustomEvent<boolean>).detail === true; }; window.addEventListener("panel:settings-dirty", onDirty); return () => window.removeEventListener("panel:settings-dirty", onDirty); }, []);
  function confirmLeave() { if (!settingsDirty.current) return true; if (!window.confirm(labels.confirmations.leave_unsaved)) return false; settingsDirty.current = false; return true; }
  function navigate(event: React.MouseEvent<HTMLAnchorElement>) { if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return; const target = new URL(event.currentTarget.href); if (target.pathname + target.search === window.location.pathname + window.location.search) return; if (!confirmLeave()) event.preventDefault(); }

  useEffect(() => {
    if (isLocale(urlLocale) && urlLocale !== locale) setLocale(urlLocale);
  }, [locale, urlLocale]);

  useEffect(() => {
    const controller = new AbortController();
    void panelRequest<{ plan_is_example?: boolean }>("/api/me", { signal: controller.signal })
      .then((data) => setExampleState(data.plan_is_example === true))
      .catch(() => setExampleState(undefined));
    const onPlanUpdated = (event: Event) => setExampleState((event as CustomEvent<{ plan_is_example?: boolean }>).detail?.plan_is_example === true);
    window.addEventListener("panel:plan-updated", onPlanUpdated);
    return () => { controller.abort(); window.removeEventListener("panel:plan-updated", onPlanUpdated); };
  }, []);

  function changeLocale(next: string) {
    if (!isLocale(next) || next === locale || !confirmLeave()) return;
    setLocale(next);
    const nextParams = new URLSearchParams(searchParams.toString());
    nextParams.set("lang", next);
    router.replace(`${pathname}?${nextParams.toString()}`);
  }

  async function logout() {
    if (!confirmLeave()) return;
    try { await panelRequest("/api/auth/logout", { method: "POST", body: "{}" }); }
    finally { router.replace("/painel/login"); router.refresh(); }
  }

  return (
    <PanelContextProvider value={{ user, permissions, locale }}>
      <div className={styles.shell}>
        <div className={styles.appGrid}>
          <aside className={styles.sidebar}>
            <Link className={styles.brand} href={`/painel?lang=${locale}`} onClick={navigate}>{labels.brand.name}</Link>
            <nav className={styles.nav} aria-label={labels.navigation.menu}>
              {NAVIGATION.filter((item) => !item.permission || hasPermission(permissions, item.permission)).map((item) => {
                const current = item.href === "/painel" ? pathname === "/painel" : pathname.startsWith(item.href);
                return <Link key={item.href} className={`${styles.navLink} ${current ? styles.navCurrent : ""}`} aria-current={current ? "page" : undefined} href={`${item.href}?lang=${locale}`} onClick={navigate}>{labels.navigation[item.key]}</Link>;
              })}
            </nav>
            <div className={styles.sidebarFooter}>
              <div className={styles.account}><strong>{user.name}</strong><br />{user.email}</div>
              <label className={styles.srOnly} htmlFor="panel-language">{labels.accessibility.select_language}</label>
              <select id="panel-language" className={styles.language} value={locale} onChange={(event) => changeLocale(event.target.value)}>
                {LOCALES.map((value) => <option key={value} value={value}>{labels.locales[value]}</option>)}
              </select>
              <button className={styles.buttonSecondary} type="button" onClick={() => void logout()}>{labels.navigation.logout}</button>
            </div>
          </aside>
          <main className={styles.main}>
            {exampleState === true && <div className={styles.example} role="status">{labels.example_banner.text}</div>}
            <div className={styles.content}>{children}</div>
          </main>
        </div>
      </div>
    </PanelContextProvider>
  );
}
