"use client";

import { ErrorState } from "@/components/painel/shared";
import { usePanel } from "@/components/painel/panel-context";

export default function PanelError({ reset }: { reset: () => void }) { const { labels } = usePanel(); return <ErrorState text={labels.errors.generic} retry={reset} />; }
