"use client";

import { createContext, useContext } from "react";
import type { Locale } from "@/core/locale";
import { getPanelLabels, type PanelLabels } from "./labels";
import type { PanelPermission, PanelUser } from "./types";

export interface PanelContextValue {
  user: PanelUser;
  permissions: PanelPermission[];
  locale: Locale;
  labels: PanelLabels;
}

const PanelContext = createContext<PanelContextValue | null>(null);

export function PanelContextProvider({ value, children }: { value: Omit<PanelContextValue, "labels">; children: React.ReactNode }) {
  return <PanelContext.Provider value={{ ...value, labels: getPanelLabels(value.locale) }}>{children}</PanelContext.Provider>;
}

export function usePanel(): PanelContextValue {
  const value = useContext(PanelContext);
  if (!value) throw new Error("PanelContext is required");
  return value;
}

export function hasPermission(permissions: PanelPermission[], permission: PanelPermission): boolean {
  return permissions.includes(permission);
}
