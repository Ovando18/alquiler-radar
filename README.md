# AlquilerRadar España

SaaS de busca consolidada de imóveis para alugar na Espanha. Consulta 8 portais em paralelo, deduplica anúncios repetidos, libera e bloqueia o acesso automaticamente via Webhook da Hotmart e roteia todo o scraping por ZenRows / ScraperAPI.

```
Navegador ──► Next.js 14 (Vercel) ──────────────► Supabase (Auth OTP + Postgres + RLS)
               │  middleware: sessão, assinatura,          ▲
               │  sessão única, /admin                     │ cache + uso
               │                                           │
               ├─ /api/webhooks/hotmart ◄── Hotmart v2.0   │
               │                                           │
               └─ /api/search ──X-Internal-Token──► FastAPI (Fly.io/Railway, região EU)
                                                     └─ AntiBotFetcher ─► ZenRows ⇄ ScraperAPI ─► portais
```

## Estrutura

```
alquiler-radar/
├── supabase/migrations/001_schema.sql   # tabelas, funções, RLS, ofertas Hotmart
├── web/                                 # Next.js 14 App Router + Tailwind + shadcn/ui
│   └── src/
│       ├── middleware.ts                # login → assinatura ativa → sessão única → admin
│       ├── app/
│       │   ├── login/                   # e-mail → código de 6 dígitos ou magic link
│       │   ├── assinatura/              # paywall (checkout Hotmart + WhatsApp)
│       │   ├── auth/callback|signout    # troca do code do magic link, logout
│       │   ├── (app)/buscar             # buscador: filtros + resultados + exportação
│       │   ├── (app)/favoritos          # favoritos com notas pessoais
│       │   ├── (app)/buscas-salvas      # alertas / buscas salvas
│       │   ├── (app)/admin              # assinantes, logs de webhook, uso de scraping
│       │   └── api/
│       │       ├── webhooks/hotmart     # provisionamento automático
│       │       ├── search               # proxy autenticado → microserviço Python
│       │       ├── export               # .xlsx (exceljs) e .csv
│       │       ├── admin/users          # liberar / renovar / suspender / derrubar sessão
│       │       ├── session/claim        # reivindica a sessão única após login por OTP
│       │       └── fx                   # cotação EUR→BRL (AwesomeAPI, fallback BCE)
│       ├── components/ui                # primitivos shadcn/ui
│       ├── components/search            # painel de filtros, card, status das fontes
│       └── lib/                         # hotmart.ts (regras puras + testes), access.ts, locations.ts…
├── scraper/                             # FastAPI + HTTPX + BeautifulSoup4 (+ Playwright opcional)
│   ├── app/
│   │   ├── fetcher.py                   # AntiBotFetcher (ZenRows / ScraperAPI / direto / Playwright)
│   │   ├── service.py                   # cache por portal → scraping paralelo → pós-filtro → dedup
│   │   ├── parsing.py                   # JSON embutido, JSON-LD, números, datas, características
│   │   ├── dedup.py                     # agrupamento entre portais (union-find)
│   │   ├── postfilter.py                # garante filtros que o portal não aplica na URL
│   │   ├── db.py                        # search_cache + scraping_usage (asyncpg)
│   │   └── scrapers/                    # base.py + um módulo por portal
│   └── tests/                           # 24 testes (fixtures, fetcher, dedup, API)
├── scripts/test-webhook.sh              # simula um evento Hotmart
├── docs/DEPLOY.md                       # guia de configuração e deploy
└── docker-compose.yml
```

## Rodando localmente

```bash
# 1. Banco: crie um projeto no Supabase e rode supabase/migrations/001_schema.sql no SQL Editor
# 2. Scraper
cd scraper && cp .env.example .env   # preencha as chaves
python -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
.venv/bin/uvicorn app.main:app --reload --port 8000
# 3. Web
cd ../web && cp .env.example .env.local   # preencha
npm install && npm run dev
```

Testes: `cd web && npm test` (regras Hotmart e de acesso) · `cd scraper && .venv/bin/pytest` (parsers, anti-bot, dedup, resiliência, cache).

O guia completo está em [docs/DEPLOY.md](docs/DEPLOY.md).
