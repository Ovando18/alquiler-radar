# Guia de configuração e deploy

Ordem recomendada: **Supabase → Scraper → Web → Hotmart → Primeiro admin → Testes**.

---

## 1. Supabase

1. Crie um projeto na região **EU (Frankfurt ou Paris)**, perto do scraper.
2. **SQL Editor →** cole e rode `supabase/migrations/001_schema.sql`.
3. **Authentication → Providers → Email**: deixe ativo. *Confirm email* pode ficar ligado.
4. **Authentication → URL Configuration**
   - Site URL: `https://app.seudominio.com`
   - Redirect URLs: `https://app.seudominio.com/auth/callback` e `http://localhost:3000/auth/callback`
5. **(Venda) Código de 6 dígitos** — o Supabase só permite editar os templates depois de configurar SMTP próprio (item 7).
   Em **Authentication → Emails → "Magic link or OTP"** e **"Confirm sign up"**, inclua o código e depois defina `NEXT_PUBLIC_AUTH_OTP_CODE=true` no Netlify (com novo deploy):
   ```html
   <h2>Seu acesso ao AlquilerRadar</h2>
   <p>Código: <strong style="font-size:22px;letter-spacing:4px">{{ .Token }}</strong></p>
   <p>Ou clique: <a href="{{ .ConfirmationURL }}">entrar</a></p>
   ```
   Faça o mesmo no template **Confirm signup** (usado no primeiro acesso).
6. **Authentication → Settings**: tempo de expiração do OTP 600–3600 s.
7. **SMTP próprio (recomendado em produção)**: o SMTP padrão do Supabase tem limite baixo de envios por hora. Configure Resend, Postmark ou SES em *Project Settings → Auth → SMTP*.
8. Opcional: ative a extensão `pg_cron` e agende a limpeza do cache:
   ```sql
   select cron.schedule('purge-cache', '15 * * * *', 'select public.purge_expired_cache()');
   ```

Anote: `Project URL`, `anon key`, `service_role key` (API) e a **connection string** do pooler (Database → Connection string → *Transaction*, porta 6543).

---

## 2. Microserviço de scraping (FastAPI)

### Chaves anti-bloqueio

| Provedor | Onde | Variável | Parâmetros enviados automaticamente |
|---|---|---|---|
| ZenRows (padrão) | app.zenrows.com → API key | `ZENROWS_API_KEY` | `js_render=true`, `antibot=true`, `premium_proxy=true`, `proxy_country=es` |
| ScraperAPI (fallback) | dashboard.scraperapi.com | `SCRAPERAPI_KEY` | `render=true`, `country_code=es`, `premium=true` (ou `ultra_premium=true`) |

- `SCRAPING_PROVIDER=zenrows|scraperapi` escolhe o primário; com as duas chaves e `SCRAPING_FALLBACK_ENABLED=true`, o outro é usado se o primário falhar ou devolver a página de desafio (DataDome/Cloudflare).
- **Idealista, Fotocasa, Milanuncios e Habitaclia são marcados como `protected`**: sem chave, o portal aparece como *bloqueado* no frontend. O servidor **nunca** faz requisição direta a eles.
- Pisos.com, Yaencontre, Spotahome e HousingAnywhere usam o provedor quando há chave; sem chave, tentam HTTPX direto (e Playwright se `PLAYWRIGHT_FALLBACK=true`).

**Custo de créditos:** uma busca nova com 8 portais × 1 página com JS rendering + premium proxy consome bastante crédito por requisição (consulte a tabela de preços atual de cada provedor). O cache de 6 h (`CACHE_TTL_HOURS`) por portal e o seletor “Páginas por portal” no filtro são os principais controles de custo. O painel `/admin → Uso de scraping` mostra o volume.

### Deploy (Fly.io, região Madrid)

```bash
cd scraper
fly launch --no-deploy --name alquilerradar-scraper --region mad
fly secrets set SCRAPER_INTERNAL_TOKEN=$(openssl rand -hex 32) \
  ZENROWS_API_KEY=... SCRAPERAPI_KEY=... \
  DATABASE_URL='postgresql://postgres.xxxx:SENHA@aws-0-eu-west-3.pooler.supabase.com:6543/postgres'
fly deploy
curl https://alquilerradar-scraper.fly.dev/health
```

Railway / Render: aponte para `scraper/Dockerfile`, defina as mesmas variáveis e exponha a porta `$PORT`.
`GET /health` deve responder `"providers": ["zenrows", "scraperapi"]` e `"cache": "postgres"`.

---

## 3. Web (Next.js) na Vercel

1. Importe o repositório, **Root Directory = `web`**.
2. Variáveis (Production + Preview) — veja `web/.env.example`:

| Variável | Valor |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | do Supabase (**apenas server-side**) |
| `NEXT_PUBLIC_APP_URL` | `https://app.seudominio.com` |
| `HOTMART_HOTTOK` | Hotmart → Ferramentas → Webhook → *Hottok* |
| `NEXT_PUBLIC_HOTMART_CHECKOUT_URL` | link do checkout (o e-mail do usuário é anexado como `?email=`) |
| `HOTMART_OFFER_DAYS` | opcional, ex.: `{"k2pasun0":30,"x9trim":90,"z1anual":365}` |
| `NEXT_PUBLIC_SUPPORT_WHATSAPP` | `+5511999999999` |
| `RESEND_API_KEY` / `EMAIL_FROM` | opcional — e-mail de boas-vindas com a marca |
| `SCRAPER_API_URL` / `SCRAPER_INTERNAL_TOKEN` | URL do Fly e o **mesmo** token |
| `SINGLE_SESSION_ENFORCED` | `true` |

3. `/api/search` declara `maxDuration = 120`. Confira o limite de duração de funções do seu plano Vercel; se for menor, reduza `PORTAL_TIMEOUT_S` no scraper para caber.

---

## 4. Hotmart

1. **Ferramentas → Webhook (API e notificações) → Cadastrar webhook**
   - URL: `https://app.seudominio.com/api/webhooks/hotmart`
   - Versão: **2.0.0**
   - Produto: AlquilerRadar España
   - Eventos: *Compra aprovada*, *Compra completa*, *Compra reembolsada*, *Chargeback*, *Compra cancelada*, *Compra atrasada*, *Protesto*, *Cancelamento de assinatura*, *Reativação de assinatura*.
2. Copie o **Hottok** para `HOTMART_HOTTOK`.
3. **Duração por oferta** — o webhook resolve os dias nesta ordem:
   1. `HOTMART_OFFER_DAYS` (env) ou tabela `hotmart_offers` pelo `data.purchase.offer.code`;
   2. nome do plano (`anual` → 365, `trimestral` → 90, `semestral` → 180);
   3. padrão de 30 dias.
   Cadastre seus códigos reais:
   ```sql
   insert into hotmart_offers (offer_code, label, days) values ('k2pasun0','Mensal',30) on conflict do nothing;
   ```

| Evento | Ação |
|---|---|
| `PURCHASE_APPROVED`, `PURCHASE_COMPLETE`, `SUBSCRIPTION_REACTIVATION` | `status='ativo'`, `data_expiracao` += dias (a partir da expiração vigente, ou de hoje), e-mail de boas-vindas no 1º acesso |
| `PURCHASE_REFUNDED`, `PURCHASE_CHARGEBACK`, `PURCHASE_CANCELED`, `PURCHASE_PROTEST`, `SUBSCRIPTION_CANCELLATION`, `PURCHASE_DELAYED` | `status='suspenso'` e a sessão ativa é derrubada |
| Outros (boleto impresso etc.) | registrado em `webhook_logs` como `ignored` |

Reenvios do mesmo `transaction` não estendem o prazo duas vezes. Hottok inválido → **401** e o log fica como `unauthorized`.

---

## 5. Primeiro administrador

```sql
insert into public.authorized_users (email, name, role, origem, status, data_expiracao)
values ('voce@seudominio.com', 'Admin', 'admin', 'manual', 'ativo', now() + interval '100 years')
on conflict (email) do update set role = 'admin', status = 'ativo';
```
Entre em `/login` com esse e-mail; o item **Admin** aparece no cabeçalho.

---

## 6. Checklist de testes em produção

```bash
HOTTOK=seu-hottok ./scripts/test-webhook.sh https://app.seudominio.com PURCHASE_APPROVED teste@seudominio.com
```
- [ ] `/admin → Webhooks` mostra o evento `processed` e o usuário aparece como **Ativo / hotmart**.
- [ ] Login com esse e-mail → código de 6 dígitos → `/buscar`.
- [ ] Repita com `PURCHASE_REFUNDED` → o usuário é redirecionado para `/assinatura?motivo=suspended`.
- [ ] Hottok errado → HTTP 401.
- [ ] Login no navegador A e depois no B → A volta para `/login?motivo=sessao`.
- [ ] Busca “Alicante / Elche” → badges de status por portal; repetir a busca → badges “cache” e resposta imediata.
- [ ] Exportar Excel e CSV.

---

## 7. Manutenção dos scrapers

Portais mudam HTML e rotas sem aviso. O desenho minimiza o impacto:

1. Cada scraper tenta primeiro o **parser específico**; se vier vazio, cai para **JSON embutido** (`__NEXT_DATA__`, `__INITIAL_PROPS__`…) e **JSON-LD**.
2. Um portal quebrado aparece como `erro` ou com 0 resultados no badge; os demais seguem normalmente.
3. Para corrigir: salve o HTML real (via ZenRows playground) em `scraper/tests/fixtures/<portal>.html`, ajuste `parse_portal()` e os slugs de `build_urls()`, e rode `pytest`.
4. Os slugs de filtro na URL (ex.: `de-dos-dormitorios` no Idealista, `temporaryRent` no Fotocasa) estão concentrados no topo de cada módulo e **devem ser validados no navegador** na primeira configuração. Filtros que o portal ignorar continuam garantidos pelo `postfilter.py` sempre que o dado é conhecido.

## 8. Aspectos legais

- Leia os Termos de Uso de cada portal. Alguns proíbem extração automatizada; o **Idealista tem API oficial** (developers.idealista.com) que pode substituir o scraping desse portal.
- Exiba os anúncios com link e crédito à fonte (já é o comportamento padrão) e não republique fotos ou descrições fora do painel.
- Os anúncios podem conter dados pessoais de anunciantes particulares (RGPD/LGPD): o cache expira em 6 h e só o necessário fica guardado.
