-- Fase 1: núcleo + captação + diagnóstico + CRM.
-- Corre como dono das tabelas (postgres). A app liga-se como app_rw, que fica sujeito ao RLS.

CREATE EXTENSION IF NOT EXISTS ltree;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE user_role AS ENUM ('owner', 'leader', 'assistant');
CREATE TYPE contact_intent AS ENUM ('comprar', 'aderir', 'ambos', 'indefinido');
CREATE TYPE contact_stage AS ENUM ('novo', 'em_contacto', 'interessado', 'inscrito', 'ativo', 'perdido');
CREATE TYPE diagnostic_status AS ENUM ('incompleto', 'concluido');
CREATE TYPE activity_type AS ENUM ('note', 'stage', 'owner', 'email', 'pdf', 'system');

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  password_hash text NOT NULL,
  name text NOT NULL,
  role user_role NOT NULL,
  parent_id uuid REFERENCES users(id),
  path ltree NOT NULL,
  active boolean NOT NULL DEFAULT true,
  locale text NOT NULL DEFAULT 'pt',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));
CREATE INDEX users_path_gist ON users USING gist (path);
CREATE UNIQUE INDEX users_one_owner_per_org ON users (org_id) WHERE role = 'owner';

CREATE TABLE leader_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  slug text NOT NULL,
  sponsor_code text,
  whatsapp_e164 text,
  photo_url text,
  country text,
  bio jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX leader_profiles_slug_uq ON leader_profiles (lower(slug));

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES users(id),
  name text NOT NULL,
  email text,
  whatsapp_e164 text,
  country text,
  locale text NOT NULL DEFAULT 'pt',
  intent contact_intent NOT NULL DEFAULT 'indefinido',
  stage contact_stage NOT NULL DEFAULT 'novo',
  lost_reason text,
  source text,
  utm jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_at timestamptz,
  consent_text text,
  consent_ip text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX contacts_org_email_uq ON contacts (org_id, lower(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX contacts_org_whatsapp_uq ON contacts (org_id, whatsapp_e164) WHERE whatsapp_e164 IS NOT NULL;
CREATE INDEX contacts_owner_idx ON contacts (owner_id);
CREATE INDEX contacts_stage_idx ON contacts (org_id, stage);

CREATE TABLE diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  status diagnostic_status NOT NULL DEFAULT 'incompleto',
  locale text NOT NULL DEFAULT 'pt',
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  profile text,
  scenarios jsonb,
  assumptions jsonb,
  plan_version text,
  analysis_text text,
  plan30 jsonb,
  ai_used boolean NOT NULL DEFAULT false,
  pdf_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX diagnostics_contact_idx ON diagnostics (contact_id);

CREATE TABLE activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  type activity_type NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activities_contact_idx ON activities (contact_id, created_at DESC);

CREATE TABLE events (
  id bigserial PRIMARY KEY,
  org_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX events_type_idx ON events (type, created_at DESC);

CREATE TABLE invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  invited_by uuid NOT NULL REFERENCES users(id),
  role user_role NOT NULL DEFAULT 'leader',
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE settings (
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, key)
);

-- RLS --------------------------------------------------------------------
-- app.user_path vazio/ausente vira NULL (nunca '' — ltree vazio é ancestral de tudo).
CREATE FUNCTION app_bypass() RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT coalesce(current_setting('app.bypass', true), '') = 'on' $$;
CREATE FUNCTION app_user_path() RETURNS ltree LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.user_path', true), '')::ltree $$;
CREATE FUNCTION app_org_id() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;

-- Dono do contacto visível ao utilizador da sessão (SECURITY DEFINER para não recursar no RLS de users).
CREATE FUNCTION app_owner_visible(p_owner uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
  SET search_path = public AS
  $$ SELECT EXISTS (SELECT 1 FROM users u WHERE u.id = p_owner AND u.path <@ app_user_path() AND u.org_id = app_org_id()) $$;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
CREATE POLICY users_scope ON users USING (app_bypass() OR (org_id = app_org_id() AND path <@ app_user_path()))
  WITH CHECK (app_bypass() OR (org_id = app_org_id() AND path <@ app_user_path()));

ALTER TABLE leader_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leader_profiles FORCE ROW LEVEL SECURITY;
CREATE POLICY leader_profiles_scope ON leader_profiles USING (app_bypass() OR app_owner_visible(user_id))
  WITH CHECK (app_bypass() OR app_owner_visible(user_id));

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;
CREATE POLICY contacts_scope ON contacts USING (app_bypass() OR app_owner_visible(owner_id))
  WITH CHECK (app_bypass() OR app_owner_visible(owner_id));

ALTER TABLE diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnostics FORCE ROW LEVEL SECURITY;
CREATE POLICY diagnostics_scope ON diagnostics USING (app_bypass() OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_id))
  WITH CHECK (app_bypass() OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_id));

ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities FORCE ROW LEVEL SECURITY;
CREATE POLICY activities_scope ON activities USING (app_bypass() OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_id))
  WITH CHECK (app_bypass() OR EXISTS (SELECT 1 FROM contacts c WHERE c.id = contact_id));

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites FORCE ROW LEVEL SECURITY;
CREATE POLICY invites_scope ON invites USING (app_bypass() OR app_owner_visible(invited_by))
  WITH CHECK (app_bypass() OR app_owner_visible(invited_by));

-- sessions, events, settings, organizations: só acedidas pela app em modo sistema ou com filtro de org explícito.
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY sessions_system ON sessions USING (app_bypass()) WITH CHECK (app_bypass());

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings FORCE ROW LEVEL SECURITY;
CREATE POLICY settings_scope ON settings USING (app_bypass() OR org_id = app_org_id()) WITH CHECK (app_bypass() OR org_id = app_org_id());

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE events FORCE ROW LEVEL SECURITY;
CREATE POLICY events_scope ON events USING (app_bypass() OR org_id = app_org_id()) WITH CHECK (app_bypass() OR org_id = app_org_id());

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY organizations_scope ON organizations USING (app_bypass() OR id = app_org_id()) WITH CHECK (app_bypass());

-- Papel da app (criado pelo docker/initdb ou pelo install.sh; aqui só os grants).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN
    CREATE ROLE app_rw LOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO app_rw;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rw;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rw;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_rw;
