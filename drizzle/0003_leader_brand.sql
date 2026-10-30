-- Marca da líder: nome comercial, slogan por idioma e logótipo. Tudo opcional: sem marca, a página usa o nome da líder.
-- brand_name e logo_url são validados na app (≤ 60 caracteres e o mesmo validador do photo_url);
-- brand_tagline guarda um texto por idioma, {"pt": "...", "es": "..."}, até 120 caracteres cada (validado na app).
-- Sem GRANT novo: 0001 deu a app_rw UPDATE na tabela inteira e 0002 só restringe por coluna a tabela users,
-- por isso as três colunas novas já ficam ao alcance de app_rw e da política leader_profiles_scope.
ALTER TABLE leader_profiles
  ADD COLUMN brand_name text,
  ADD COLUMN brand_tagline jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN logo_url text;
