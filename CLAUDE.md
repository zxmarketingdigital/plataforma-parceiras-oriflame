# Instalação guiada — Plataforma de Parceiras

Quem abre esta pasta no Claude Code é a dona da plataforma (parceira Oriflame), não uma programadora. Fala em português de Portugal, simples, um passo de cada vez, e confirma cada passo antes de avançar. Quando ela escrever "instalar" (ou pedir ajuda para pôr a plataforma no ar), segue o roteiro abaixo.

## Regras
- Nunca mostrar, copiar para o chat nem commitar o conteúdo do `.env` (senhas, chaves). Para conferir, mostrar só o nome da variável e se está preenchida.
- Comandos no servidor correm por `ssh` a partir daqui, depois de ela dar o IP e o utilizador. Se ela preferir correr à mão, dar o comando pronto num bloco.
- Antes de qualquer passo que apague dados (`docker compose down -v`, reinstalar a base), avisar e esperar um "sim".
- Suporte: https://suporte.zxlab.com.br/hub · contato@zxlab.com.br

## Roteiro

### 0. Ver a demo no computador (opcional, 5 min)
Se ela tiver Docker Desktop ou OrbStack: `docker compose -f compose.dev.yml up --build`, abrir http://localhost:3000 e o painel em http://localhost:3000/painel/login com as credenciais de `scripts/demo-credentials.md`. Dados fictícios. Parar com `docker compose -f compose.dev.yml down`.

### 1. Servidor
- VPS Ubuntu 22.04/24.04 com pelo menos 2 GB de RAM (Hetzner, Contabo, DigitalOcean, Hostinger VPS). Alojamento partilhado não serve.
- Pedir o IP e o acesso SSH. Testar: `ssh <utilizador>@<ip> 'uname -a'`.
- Instalar o Docker, se faltar: `curl -fsSL https://get.docker.com | sh`.

### 2. Domínio
- Escolher o endereço (ex.: `parceiras.oseudominio.com`) e criar um registo **A** a apontar para o IP da VPS, no painel onde o domínio está registado.
- Confirmar antes de seguir: `dig +short <dominio>` tem de devolver o IP. Sem isto o certificado HTTPS falha.

### 3. Código no servidor
- O repositório é privado: no servidor, `gh auth login` com a conta GitHub que recebeu o acesso (ou `git clone` com um token de leitura).
- `git clone https://github.com/zxmarketingdigital/plataforma-parceiras-oriflame.git && cd plataforma-parceiras-oriflame`

### 4. Instalar
- `./install.sh` pergunta o domínio e o e-mail para o certificado, gera as senhas, arranca tudo e cria a conta de dona (nome, e-mail, senha, nome da organização e o slug do link dela, ex.: `/pt/maria`).
- Abrir `https://<dominio>/painel/login` e entrar.

### 5. E-mail (obrigatório para o relatório chegar às leads)
- No `.env`, `SMTP_URL` tem de apontar para um serviço de envio real (Brevo, Resend, Amazon SES, ou o SMTP do alojamento de e-mail). Formato: `smtp://utilizador:senha@servidor:587`.
- `MAIL_FROM` com um remetente do domínio dela, já verificado no serviço de envio.
- Aplicar: `docker compose up -d`. Testar fazendo um diagnóstico com o e-mail dela.

### 6. IA do relatório (recomendado)
- `ANTHROPIC_API_KEY` no `.env` (chave criada em https://console.anthropic.com). Sem chave, o relatório usa um texto fixo, e o resto funciona igual.

### 7. Anti-spam (recomendado antes de divulgar)
- Criar um widget Cloudflare Turnstile para o domínio e preencher `TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET`. `docker compose up -d`.

### 8. Configurar no painel
- Equipa → Perfil: código de patrocinadora, WhatsApp, foto e apresentação (é o que aparece na página dela e nos botões do resultado). Confirmar que o link de inscrição abre a página da Oriflame com o código dela (o parâmetro `?sponsor=` de França e Reino Unido não está confirmado pela Oriflame: testar uma inscrição).
- Equipa: convidar as líderes; cada uma recebe o seu link e vê só a sua árvore.
- Plano: a tabela segue as condições públicas de outubro de 2026. Rever se a Oriflame mudar o plano.

### 9. Manutenção
- Atualizar: `./update.sh` (faz backup antes). Backup manual: `./backup.sh` (guarda os 14 mais recentes em `backups/`). Copiar os backups para fora do servidor de vez em quando.

## Problemas comuns
- Site não abre com HTTPS: o domínio ainda não aponta para o IP (passo 2) ou as portas 80/443 estão fechadas na firewall da VPS.
- E-mail não chega: `SMTP_URL`/`MAIL_FROM` (passo 5); ver `docker compose logs worker --tail 50`.
- Ver o estado de tudo: `docker compose ps` e `docker compose logs app --tail 50`.
