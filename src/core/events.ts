import type { Db } from "./db/client";

// Catálogo de eventos do núcleo. Um módulo novo liga-se ouvindo estes tipos (ver src/core/modules.ts).
export type EventType = "lead.criado" | "diagnostico.concluido" | "lead.etapa_alterada" | "lead.dono_alterado" | "lead.apagado";

export async function emit(db: Db, orgId: string, type: EventType, payload: Record<string, unknown>, source: string): Promise<void> {
  await db.query("INSERT INTO events (org_id, type, payload, source) VALUES ($1, $2, $3, $4)", [orgId, type, payload, source]);
}
