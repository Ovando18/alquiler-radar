# Ambiente de testes: GitHub + Netlify + Render

Arquitetura de teste: **Netlify** (site Next.js) → **Render** (scraper Python) → **Supabase** (banco + login).
O Netlify não executa o serviço Python (FastAPI); por isso ele vai no Render.

## 1. Supabase (≈10 min)
1. Crie um projeto em supabase.com (região EU).
2. SQL Editor → rode `supabase/migrations/001_schema.sql`.
3. Rode o SQL do **primeiro admin** (docs/DEPLOY.md §5) com o seu e-mail.
4. Templates de e-mail: **não precisa mexer para testar**. O login usa o link do template padrão (o Supabase só libera a edição após configurar SMTP próprio).
   Com o SMTP padrão, os e-mails só chegam para membros da sua conta Supabase — suficiente para testar como admin.
5. Anote: Project URL, anon key, service_role key, connection string do pooler (porta 6543).

## 2. Scraper no Render (≈10 min)
1. render.com → **New → Blueprint** → selecione o repositório (o `render.yaml` já configura tudo).
2. Preencha `ZENROWS_API_KEY` (o plano de teste do ZenRows serve), `SCRAPERAPI_KEY` (opcional) e `DATABASE_URL`.
3. Depois do deploy, abra `https://SEU-SCRAPER.onrender.com/health` → deve mostrar `"cache": "postgres"`.
4. Copie o valor gerado de `SCRAPER_INTERNAL_TOKEN` (Environment).

## 3. Site no Netlify (≈10 min)
1. app.netlify.com → **Add new site → Import an existing project → GitHub** → escolha o repositório.
   O `netlify.toml` já define base `web`, build `npm run build` e publish `.next`.
2. Antes do primeiro deploy, em **Site configuration → Environment variables**, crie (escopo *Builds + Functions*):

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key (**marque como secret**) |
| `NEXT_PUBLIC_APP_URL` | `https://SEU-SITE.netlify.app` |
| `SCRAPER_API_URL` | `https://SEU-SCRAPER.onrender.com` |
| `SCRAPER_INTERNAL_TOKEN` | o mesmo do Render (**secret**) |
| `SEARCH_TIMEOUT_MS` | `25000` |
| `HOTMART_HOTTOK` | qualquer texto por enquanto (ex.: `teste123`) |
| `NEXT_PUBLIC_HOTMART_CHECKOUT_URL` | link do checkout (ou `#`) |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | seu número |
| `SINGLE_SESSION_ENFORCED` | `true` |
| `NEXT_PUBLIC_AUTH_OTP_CODE` | `false` (login por link; mude para `true` só depois do SMTP próprio + `{{ .Token }}` nos templates) |

3. Deploy. Toda alteração de variável exige **novo deploy** (Deploys → Trigger deploy).
4. No Supabase → Authentication → URL Configuration: Site URL = URL do Netlify; Redirect URL = `https://SEU-SITE.netlify.app/auth/callback`.

## 4. Roteiro de testes
- [ ] Login com o e-mail admin → clicar em *Sign in* no e-mail (mesmo navegador) → `/buscar`.
- [ ] `/admin` → **Liberar acesso** para um segundo e-mail; entre com ele em outra janela anônima.
- [ ] Webhook: `HOTTOK=teste123 ./scripts/test-webhook.sh https://SEU-SITE.netlify.app PURCHASE_APPROVED outro@email.com` → aparece em `/admin → Webhooks`.
- [ ] Mesmo comando com `PURCHASE_REFUNDED` → o usuário cai no paywall.
- [ ] Busca Alicante / Elche / T2 / até 1.000 € → badges por portal.
- [ ] **Repita a mesma busca**: os portais que estouraram o tempo na 1ª vez vêm do cache.
- [ ] Favoritar, nota, salvar busca, exportar Excel e CSV.

### Limite de tempo do Netlify
As funções do Netlify têm tempo máximo de execução menor que o de uma busca nova nos 8 portais com JS rendering.
Por isso o scraper limita cada portal a ~24 s (`PORTAL_TIMEOUT_S`) e o site espera 25 s (`SEARCH_TIMEOUT_MS`).
Portais lentos aparecem como **timeout** na primeira busca, mas o scraper termina em segundo plano e grava o cache;
a segunda busca igual responde na hora. Para produção, prefira a Vercel (até 120 s) ou uma fila assíncrona.

### Plano gratuito do Render
O plano *free* hiberna após 15 min sem uso (a 1ª requisição demora ~50 s para acordar). O `render.yaml` usa *starter*;
troque `plan: starter` por `plan: free` se quiser testar sem custo, sabendo dessa limitação.
