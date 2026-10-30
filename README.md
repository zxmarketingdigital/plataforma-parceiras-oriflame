# Plataforma de Parceiras (Fase 1)

Página de captação, **Diagnóstico do Empreendedor** (conversa de ~3 minutos com estimativa em 3 cenários a 12 meses, relatório em PDF e plano de 30 dias) e **painel** com CRM em kanban e hierarquia de líderes. Em português, espanhol, inglês e francês.

## Instalação guiada (recomendado)
Com o [Claude Code](https://claude.com/claude-code) instalado no seu computador:
```bash
gh repo clone zxmarketingdigital/plataforma-parceiras-oriflame && cd plataforma-parceiras-oriflame && claude
```
Escreva **"instalar"** e siga os passos. O Claude conduz a instalação de ponta a ponta: servidor, domínio, e-mail, IA e a sua conta de dona.

## Testar no seu computador (dados fictícios)
Precisa do Docker (Docker Desktop ou OrbStack).
```bash
docker compose -f compose.dev.yml up --build
```
- Site: http://localhost:3000 · Painel: http://localhost:3000/painel/login
- E-mails enviados: http://localhost:8025 (Mailpit)
- Credenciais da demo: `scripts/demo-credentials.md` (criado pelo seed no primeiro arranque)

## Instalar na sua VPS (manual)
1. Servidor Ubuntu/Debian com Docker e o domínio (registo A) a apontar para o IP do servidor.
2. `git clone <este repositório> && cd plataforma-parceiras-oriflame && ./install.sh`
3. Atualizar: `./update.sh` · Backup: `./backup.sh`

## Plano de ganhos
`config/plano-oriflame.json` usa as condições públicas da Oriflame de outubro de 2026 por país (desconto de membro: PT, FR e Reino Unido 20 %, Espanha 23 %). O Bónus de Equipa fica fora do cálculo, porque a Oriflame não publica a escada de percentagens. O diagnóstico mostra isso nos pressupostos. Pode ajustar a tabela no painel (Definições → Plano).

Esta plataforma é de uma parceira independente e não é um canal oficial da Oriflame.

Desenvolvido pela ZX LAB · Suporte: https://suporte.zxlab.com.br/hub · contato@zxlab.com.br
