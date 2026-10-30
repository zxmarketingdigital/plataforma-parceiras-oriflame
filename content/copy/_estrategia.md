# Estratégia de copy: LP + Diagnóstico do Empreendedor (Atelier Nórdico)

Estratégia para o redator. Não é copy final. PT-PT, "você/o seu", sem "tu" e sem brasileirismos (registo, maquilhagem, telemóvel, equipa, ecrã).

## 1. Big idea, promessa e mecanismo

**Big idea:** antes de decidir se a Oriflame é para si, veja os seus próprios números.

**Promessa central:** em 3 minutos, uma estimativa honesta do que a Oriflame pode representar na sua vida (poupança, rendimento extra ou negócio), feita com o seu tempo e a sua rede, e não com os de outra pessoa.

**Mecanismo (porque é diferente de "junte-se a mim"):** o convite habitual pede uma decisão antes de dar informação, e por isso a pessoa desconfia. O diagnóstico inverte a ordem: primeiro dá informação (3 cenários com os pressupostos à vista, um relatório em PDF e um plano de 30 dias) e só depois propõe o passo. Três ideias para repetir:
- **Personalizado:** usa as respostas dela (horas, contactos, consumo, país).
- **Transparente:** mostra como se chega a cada número e chama-lhe simulação.
- **Sem compromisso:** recebe o relatório mesmo que decida não avançar.

Inimigo implícito: a pressão e o "vais ficar rica". O tom anti-hype é a vantagem competitiva.

## 2. Os 3 caminhos

| Chave | Quem é | Ângulo | Tom do CTA |
|---|---|---|---|
| `comprar` | já gosta dos produtos, quer pagar menos | "Os produtos de que já gosta, com preço de parceira." Sem vender a ninguém. Benefício imediato e pessoal | "Ver quanto posso poupar" |
| `poupar` / rendimento | quer um extra mensal compatível com a vida que tem | "Um extra que cabe nas horas que tem." Partilhar com quem já conhece, ao seu ritmo | "Calcular o meu extra" |
| `negocio` | quer construir equipa e rendimento crescente | "Um negócio próprio, com acompanhamento desde o primeiro dia." Liderança e método, sem investimento de stock (confirmar condições por país) | "Ver o potencial do negócio" |

Nota: o spec usa "poupar até 30%". Esse número e o "registo gratuito" só entram na copy se estiverem em `config/plano-oriflame.json` ou nas condições oficiais do país. Caso contrário, escrever "desconto de parceira" sem percentagem.

Todos os CTAs levam ao diagnóstico (o objetivo vem pré-selecionado pelo caminho clicado).

## 3. Secções da LP (ordem, função, emoção)

1. **hero**: parar o scroll e mudar a pergunta de "quero vender?" para "quanto vale para mim?". Emoção: curiosidade com alívio ("não me vão pressionar"). O aviso de parceira independente fica visível logo abaixo do CTA.
2. **caminhos**: a pessoa reconhece-se num dos três. Emoção: identificação e permissão ("posso só comprar").
3. **passos** (4): tirar o medo do desconhecido. Sugestão: 01 Faça o diagnóstico · 02 Receba o relatório e o plano · 03 Converse com {leader_name}, se quiser · 04 Registe-se com o código e comece ao seu ritmo. Emoção: controlo.
4. **diagnostico_cta**: vender o diagnóstico como produto gratuito. Os 3 bullets são os 3 entregáveis (cenários a 12 meses, relatório PDF, plano de 30 dias) e a microcopy fica em "~3 minutos · sem compromisso · simulação, não garantia". Emoção: valor recebido antes de dar nada.
5. **lider**: dar rosto humano e transferir confiança. Fala da líder na 1ª pessoa: quem é, porque começou e como acompanha. O `fallback_bio` é genérico e sem factos inventados (sem anos, ganhos ou cargos). Emoção: "há uma pessoa real do outro lado".
6. **faq** (7 itens): matar objeções sem defensividade. Tem custo? Sou obrigada a vender? Isto é a loja oficial? (Não, parceira independente.) Os números são garantidos? (Não, é simulação, e explicar porquê.) Quanto tempo exige? O que acontece aos meus dados? (RGPD, apagar quando quiser.) Posso fazer de outro país? Emoção: segurança.
7. **cta_final**: fechar com a decisão mais pequena possível: "3 minutos para saber, não para decidir". Emoção: leveza.

## 4. Headline

1. **"Antes de decidir, veja os seus números." ← recomendada** (em `title_em`: "os seus números")
2. "Quanto pode a Oriflame valer para si? Descubra em 3 minutos."
3. "Comprar, ganhar um extra ou criar negócio: comece pelo que procura."
4. "Sem pressão, sem promessas. Só os seus números."
5. "O seu tempo, a sua rede, a sua estimativa."

**Subtítulo recomendado:** "Responda a 7 perguntas e receba uma simulação a 12 meses em três cenários, um relatório e um plano de 30 dias feitos para si. Gratuito e sem compromisso."

Eyebrow: "Diagnóstico do Empreendedor · com {leader_name}". O CTA secundário ("Conhecer os caminhos") faz scroll para os caminhos.

## 5. Tom do chat

- **A líder fala na 1ª pessoa**, no header e nos balões ("Olá! Sou a {leader_name}."). O status é "responde em ~3 min" ou "online". Mesmo sendo automático, é ela quem conduz, porque é isso que transfere a confiança da secção líder.
- **Greeting em 2 balões:** quem é + o que vai acontecer ("7 perguntas rápidas, no fim recebe a sua estimativa").
- **Contact step:** justificar cada dado ("para lhe enviar o relatório"). O WhatsApp é opcional na fala mas obrigatório no campo, com o motivo "caso queira tirar dúvidas comigo". O consentimento é claro e curto.
- **Reações entre perguntas:** curtas, validantes, sem julgamento e sem elogio vazio ("Anotado.", "Faz todo o sentido.", "Obrigada, isso ajuda muito."). Nunca reagir a "pouco tempo" ou "poucos contactos" como se fosse mau: "Muitas pessoas começam assim."
- **calculating:** "Estou a fazer as contas com as suas respostas…"
- **Resultado sem soar a promessa:**
  - Abrir com o enquadramento antes dos números: "Isto é uma simulação, não uma garantia. Mostra o que é possível com os pressupostos abaixo."
  - Mostrar o cenário **provável** em destaque e o conservador e o ambicioso ao lado, nunca o ambicioso primeiro.
  - Pressupostos imediatamente visíveis, em linguagem simples (clientes/mês, ticket médio, retenção, rampa), e não escondidos num acordeão.
  - O verbo é sempre condicional ("poderia", "se mantiver"). Proibido: "vai ganhar", "garantido", "facilmente".
  - Enquanto a tabela for de exemplo, mostrar a nota `example_table_notice` sempre.
  - CTAs em ordem suave: 1) falar com {leader_name} no WhatsApp; 2) registar-me com o código. A mensagem pré-preenchida é na 1ª pessoa da lead e sem números.

## 6. Perfis do relatório

**consumidora** (objetivo = comprar)
- Análise: o que já gasta em cosmética e o que mudaria com o desconto de parceira, mais a ideia de que partilhar com 2 ou 3 amigas é opcional e pode cobrir o próprio consumo. Zero pressão para vender.
- Arco de 30 dias: S1 registar e explorar o catálogo · S2 primeira encomenda própria e testar produtos · S3 partilhar com quem pergunta (opcional) · S4 rever a poupança e decidir se quer continuar só a comprar.

**rendimento_extra** (objetivo = rendimento)
- Análise: as horas e a rede que indicou e o que isso permite de forma realista; o cenário provável como referência; onde está a alavanca (clientes recorrentes antes de clientes novos).
- Arco: S1 lista de 20 contactos naturais e rotina de 30 min/dia · S2 primeiras conversas e catálogo partilhado · S3 primeiras encomendas e acompanhamento · S4 balanço com {leader_name} e meta do mês 2.

**construtora_negocio** (objetivo = negócio)
- Análise: o potencial depende de duplicar (recrutar e formar), não só de vender; o que a experiência e as redes dela aceleram; ser honesta sobre a rampa lenta dos primeiros meses.
- Arco: S1 base de clientes própria e estudo do plano · S2 presença nas redes e primeiros convites · S3 primeiras pessoas na equipa e o primeiro onboarding · S4 sessão de planeamento a 90 dias com {leader_name}.

Regra comum: nenhum valor monetário no texto fixo (os números vêm só do motor) e fecho sempre com "o próximo passo é uma conversa, não um compromisso".

## 7. Adaptação cultural

- **ES (Espanha):** **"tú"** em toda a peça (LP e chat), que é o padrão do marketing de beleza em Espanha e soa natural (em PT o "tu" seria intrusivo, em ES não). Vocabulário peninsular ("móvil", "maquillaje", "ordenador"), nunca latino-americano.
- **EN (Reino Unido):** ortografia britânica (colour, organise, programme), "mobile" e não "cell". O tom é ainda mais contido e cético em relação ao MLM: reforçar "independent", "no pressure", "estimate, not a promise". Evitar "boss babe", "financial freedom" e "side hustle" de forma exagerada; "a little extra each month" funciona melhor. Mencionar que não há stock obrigatório só se for verdade no plano GB.
- **FR (França):** **"vous"** em tudo. Tom elegante e sóbrio, menos exclamações. Vocabulário: "partenaire indépendante", "simulation", "sans engagement" (expressão-chave e muito confiável em França). Cuidado reforçado com a promessa de rendimento: a França é sensível à "vente directe/réseau", por isso enfatizar transparência e RGPD ("vos données").
- **Todos:** moeda pelo `{currency}` (EUR / GBP), formato numérico local (1 234,56 € vs £1,234.56) e telefone sempre internacional com seletor de país.
