import captacao from "@/modules/captacao/module.json";
import diagnostico from "@/modules/diagnostico/module.json";
import crm from "@/modules/crm/module.json";
import redator from "../../agents/redator-relatorio.json";

// Registo estático de módulos e agentes. Um módulo novo entra aqui e no seu module.json.
export const MODULES = [captacao, diagnostico, crm];
export const AGENTS = [redator];
