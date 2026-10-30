# Contrato da copy (`content/copy/<lang>.json`)

Toda a copy vive aqui. A UI e a API só leem estas chaves; nenhum texto chumbado em componente.
Placeholders entre chavetas são trocados em runtime: `{leader_name}`, `{name}`, `{currency}`, `{country}`, `{month12}`, `{rank}`.

```jsonc
{
  "brand": { "name": "Atelier Nórdico", "tagline": "...", "independent_notice": "Parceira independente Oriflame. Não é a loja oficial." },
  "lp": {
    "nav": { "diagnostico": "...", "caminhos": "...", "como_funciona": "...", "faq": "...", "lang_label": "..." },
    "hero": { "eyebrow": "...", "title": "...", "title_em": "...", "subtitle": "...", "cta_primary": "...", "cta_secondary": "...", "microcopy": "..." },
    "caminhos": { "title": "...", "intro": "...", "items": [ { "key": "comprar", "title": "...", "text": "...", "cta": "..." }, { "key": "poupar", ... }, { "key": "negocio", ... } ] },
    "passos": { "title": "...", "intro": "...", "items": [ { "n": "01", "title": "...", "text": "..." } ] },   // 4 itens
    "diagnostico_cta": { "title": "...", "text": "...", "bullets": ["...","...","..."], "cta": "...", "microcopy": "..." },
    "lider": { "eyebrow": "...", "title": "...", "fallback_bio": "...", "cta_whatsapp": "..." },  // {leader_name}
    "faq": { "title": "...", "items": [ { "q": "...", "a": "..." } ] },   // 6-8 itens
    "cta_final": { "title": "...", "text": "...", "cta": "..." },
    "footer": { "legal": "...", "privacy": "...", "made_by": "Plataforma ZX LAB" }
  },
  "chat": {
    "header": { "title": "...", "status": "..." },               // {leader_name}
    "greeting": ["...", "..."],                                   // 1-3 balões
    "contact_step": { "intro": "...", "name_label": "...", "email_label": "...", "whatsapp_label": "...", "country_label": "...", "consent_text": "...", "submit": "...", "errors": { "name": "...", "email": "...", "whatsapp": "...", "consent": "...", "generic": "..." } },
    "after_contact": "...",                                       // {name}
    "questions": {
      "pais":       { "text": "...", "options": { "PT": "...", "ES": "...", "FR": "...", "GB": "..." } },
      "objetivo":   { "text": "...", "options": { "comprar": "...", "rendimento": "...", "negocio": "..." } },
      "horas":      { "text": "...", "options": { "2-5": "...", "5-10": "...", "10+": "..." } },
      "contactos":  { "text": "...", "options": { "<50": "...", "50-150": "...", "150+": "..." } },
      "experiencia":{ "text": "...", "options": { "nenhuma": "...", "alguma": "...", "muita": "..." } },
      "redes":      { "text": "...", "options": { "pouco": "...", "ativo": "...", "muito": "..." } },
      "consumo":    { "text": "...", "options": { "<30": "...", "30-80": "...", "80+": "..." } }
    },
    "reactions": ["...", "...", "..."],                           // balão curto entre perguntas, rotativo
    "calculating": "...",
    "result": {
      "intro": "...", "scenarios": { "conservador": "...", "provavel": "...", "ambicioso": "..." },
      "per_month": "...", "month12_label": "...", "avg_label": "...", "rank_label": "...",
      "assumptions_title": "...", "disclaimer": "...", "example_table_notice": "...",
      "analysis_title": "...", "plan_title": "...", "week_label": "...",
      "pdf_ready": "...", "pdf_pending": "...", "pdf_download": "...",
      "cta_signup": "...", "cta_whatsapp": "...", "whatsapp_prefill": "...", "restart": "..."
    },
    "errors": { "network": "...", "rate_limit": "..." }
  },
  "report_fallback": {
    "perfis": {
      "consumidora":  { "label": "...", "analysis": "...", "plan30": [ { "week": 1, "title": "...", "actions": ["...","..."] } ] },  // 4 semanas
      "rendimento_extra": { ... },
      "construtora_negocio": { ... }
    },
    "email": { "subject": "...", "body": "..." }                 // {name} {leader_name}
  },
  "assumptions": {                                                // frases do motor; {x} trocado por número
    "clients": "...", "ticket": "...", "recruits": "...", "retention": "...", "ramp": "...", "personal": "..."
  },
}
// Os rótulos do PAINEL ficam fora daqui, em content/copy/painel/<lang>.json (são de quem constrói o painel).
```

Perfil = `consumidora` se objetivo=comprar; `rendimento_extra` se objetivo=rendimento; `construtora_negocio` se objetivo=negocio.
