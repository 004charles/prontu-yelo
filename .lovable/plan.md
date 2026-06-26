## Objetivo

Construir um sistema interno que verifica continuamente se cada pagamento confirmado na **Prontu** tem um pedido correspondente no **Yelo (Tupuca)**. Quando faltar, gera um incidente crítico na dashboard da sala de operações, com ações de resolução.

> Nota sobre as credenciais: por segurança, **não vou usar as chaves coladas no chat** (a chave da Prontu inclusive já está expirada — `exp: 2025-01-12`). Vou pedir que sejam introduzidas via formulário seguro (`PRONTU_API_KEY`, `YELO_API_KEY`) antes da implementação real das chamadas.

## Stack

- TanStack Start (já configurado) + Lovable Cloud (Postgres + Auth + Realtime)
- Server functions para chamadas às APIs externas (chaves só no servidor)
- Server route público `/api/public/reconcile` para o cron de reconciliação
- Realtime via Supabase channels para atualizar a dashboard ao vivo

## Modelo de dados (Lovable Cloud)

- `payments` — espelho dos pagamentos SUCCESS da Prontu (`prontu_payment_id`, `reference`, `customer_name`, `customer_contact`, `amount`, `currency`, `paid_at`, `raw`)
- `orders` — espelho dos pedidos do Yelo (`yelo_order_id`, `reference`, `payment_ref`, `status`, `created_at`, `raw`)
- `incidents` — `payment_id`, `severity`, `status` (`open|acknowledged|resolved|escalated`), `assigned_to`, `notes`, `created_at`, `resolved_at`
- `incident_events` — auditoria de ações (criar pedido manual, forçar sync, contactar cliente, validar, resolver, escalar)
- `user_roles` (`admin`, `ops`) + função `has_role` (padrão seguro)
- RLS: apenas utilizadores autenticados com role `ops`/`admin` leem/escrevem

## Lógica de reconciliação

1. **Pull Prontu** — `GET /payments?status=SUCCESS&since=<last_cursor>` → upsert em `payments`
2. **Pull Yelo** — `GET /orders?since=<last_cursor>` → upsert em `orders` (chave de ligação: `payment_ref` == `prontu_payment_id` ou `reference`)
3. **Diff** — para cada `payment` SUCCESS sem `order` correspondente, criar/atualizar `incident` (open, severity=high)
4. **Auto-resolve** — se mais tarde o pedido aparecer, marcar incidente como `resolved` automaticamente com evento de auditoria
5. **Trigger** — server route `POST /api/public/reconcile` protegido por `CRON_SECRET`; chamado a cada 1 min via pg_cron (Lovable Cloud) + botão "Run now" na dashboard

## Dashboard `/ops` (rota protegida `_authenticated`)

- **KPIs** (últimas 24h): pagamentos verificados, pedidos criados, inconsistências detectadas, incidentes ativos, tempo médio de detecção
- **Lista de incidentes** (tempo real via Supabase channel em `incidents`): cliente, `payment_id`, valor, estado do pagamento, estado do pedido, tempo desde pagamento, prioridade
- **Detalhe do incidente** com ações:
  - Criar pedido manualmente no Yelo (`POST /orders` com payload reconstruído do pagamento)
  - Forçar sync (re-pull Prontu+Yelo para esse `payment_id`)
  - Contactar cliente (`tel:`/`mailto:` + log)
  - Validar manualmente o pagamento
  - Marcar como resolvido
  - Escalar para equipa técnica (muda severity + assignee)
- **Filtros**: severidade, status, intervalo de tempo, pesquisa por cliente/`payment_id`
- **Toast + som** quando novo incidente crítico entra (Realtime)

## Estrutura de ficheiros

```text
src/
  routes/
    _authenticated/
      route.tsx                 // gate (auth + role ops/admin)
      ops/
        index.tsx               // dashboard KPIs + lista
        incidents.$id.tsx       // detalhe + ações
    api/public/
      reconcile.ts              // POST cron-protegido
  lib/
    prontu.server.ts            // cliente Prontu (server-only)
    yelo.server.ts              // cliente Yelo (server-only)
    reconcile.server.ts         // lógica de diff
    incidents.functions.ts      // server fns: list/act on incidents
    ops.functions.ts            // server fns: KPIs, run-now
  components/ops/
    KpiCards.tsx
    IncidentTable.tsx
    IncidentDetail.tsx
    IncidentActions.tsx
supabase/migrations/...         // tabelas, RLS, has_role, pg_cron job
```

## Segurança

- `PRONTU_API_KEY`, `YELO_API_KEY`, `CRON_SECRET` via secrets (nunca no cliente)
- Acesso à dashboard só com role `ops`/`admin` (tabela `user_roles` + `has_role`)
- Endpoint público de cron exige `Authorization: Bearer <CRON_SECRET>`
- Toda a ação manual é registada em `incident_events` (audit trail)

## Entregáveis desta primeira iteração

1. Lovable Cloud ativado + migrations (tabelas, RLS, roles, pg_cron)
2. Clientes Prontu/Yelo com tipos e tratamento de erro (mockáveis enquanto não há chaves válidas)
3. Endpoint de reconciliação + agendamento
4. Dashboard `/ops` com KPIs, lista em tempo real e ações principais (criar pedido manual, forçar sync, resolver, escalar)
5. Página `/auth` + atribuição inicial de role `admin` ao primeiro utilizador

## Fora do âmbito (próxima iteração, se quiseres)

- Notificações por e-mail/Slack/Telegram para incidentes críticos
- Relatórios históricos / export CSV
- SLA tracking e métricas semanais

## Antes de implementar preciso de confirmar

1. **Endpoints reais da Prontu e do Yelo** para listar pagamentos SUCCESS e pedidos (o link `blob:` que partilhaste é local ao teu browser e não abre do meu lado). Idealmente o URL base + caminho + exemplo de resposta.
2. Confirmar que posso pedir as chaves via formulário seguro (em vez de usar as que colaste — a da Prontu está expirada).
3. Frequência do cron: **1 minuto** está bem, ou preferes 30s/5min?
