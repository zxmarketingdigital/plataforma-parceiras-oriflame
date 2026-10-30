-- Pela app, um utilizador só muda nome, idioma e o estado ativo (de quem está abaixo dele).
-- Papel, árvore (parent_id, path), organização, e-mail e senha ficam fora do alcance de app_rw,
-- mesmo na própria linha que o RLS deixa atualizar.
REVOKE UPDATE ON users FROM app_rw;
GRANT UPDATE (name, locale, active) ON users TO app_rw;

-- Um só e-mail de relatório por diagnóstico, mesmo com jobs concorrentes: o worker reserva esta linha antes de enviar.
CREATE UNIQUE INDEX activities_report_email_once ON activities ((payload->>'diagnostic_id'))
  WHERE type = 'email' AND payload->>'action' = 'relatorio_enviado';
