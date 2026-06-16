Add an authenticated endpoint for customers to create support tickets.

# Create ticket

Create a ticket, store the first customer message, and enqueue a support notification.

## Required dependencies

Database migration:

```sql
-- File: src/db/migrations/008_create_ticket.sql
CREATE TABLE ticket (
  ticket_id text PRIMARY KEY,
  ticket_number text NOT NULL UNIQUE,
  customer_id text NOT NULL,
  subject text NOT NULL,
  priority text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE ticket_message (
  ticket_message_id text PRIMARY KEY,
  ticket_id text NOT NULL REFERENCES ticket(ticket_id),
  author_kind text NOT NULL,
  author_id text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL
);

CREATE TABLE notification_outbox (
  notification_outbox_id text PRIMARY KEY,
  kind text NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  processed_at timestamptz
);
```

The `zod` package must be installed and used for endpoint and outbox schemas.

Notification outbox payload contract:

```ts
// File: src/tickets/TicketNotification.ts
const SupportTicketCreatedNotificationPayload = z.object({
    ticketId: z.string(),
    ticketNumber: z.string(),
    customerId: z.string(),
    subject: z.string(),
    priority: z.enum(['low', 'normal', 'high']),
})
```

## Entry

`POST /api/v1/tickets`

```ts
// File: src/tickets/TicketHttp.ts
const CreateTicketRequest = z.object({
    subject: z.string(),
    body: z.string(),
    priority: z.enum(['low', 'normal', 'high']).optional(),
})

const CreateTicketResponse = z.object({
    ticketId: z.string(),
    ticketNumber: z.string(),
})
```

Response status: `201`

## Flow

```flow
-> require authenticated customer
-> decode request body with `CreateTicketRequest`
  -> if decode fails
    <- respond 422
-> trim subject
-> trim body
-> if subject is empty
  <- respond 422
-> if body is empty
  <- respond 422
-> default `priority` to `normal` if not provided
-> start database transaction
-> generateTicketId
-> generateTicketNumber
-> insert `ticket` { ticket_id: ticketId, ticket_number: ticketNumber, customer_id: customerId, subject: trimmedSubject, priority: priority, status: 'open' }
  -> if ticket number unique constraint fails
    -> generateTicketNumber
    -> retry insert `ticket` once
      -> if retry fails
        <- respond 500
-> generateTicketMessageId
-> insert `ticket_message` { ticket_message_id: ticketMessageId, ticket_id: ticketId, author_kind: 'customer', author_id: customerId, body: trimmedBody }
-> generateNotificationOutboxId
-> insert `notification_outbox` { notification_outbox_id: notificationOutboxId, kind: 'support.ticket_created', payload: SupportTicketCreatedNotificationPayload.parse({ ticketId, ticketNumber, customerId, subject: trimmedSubject, priority }) }
<- respond 201 { ticketId: ticketId, ticketNumber: ticketNumber }
```

## Behaviors

- when request is valid, should create one open ticket
- when request is valid, should create one initial customer message
- when request is valid, should enqueue one support ticket created notification
- when priority is omitted, should default priority to `normal`
- when subject has surrounding whitespace, should store trimmed subject
- when body has surrounding whitespace, should store trimmed body
- when customer is not authenticated, should respond 401
- when request body fails schema decoding, should respond 422
- when subject is empty after trimming, should respond 422
- when body is empty after trimming, should respond 422
- when ticket number collides once, should retry with a new ticket number
- when any insert fails, should rollback all ticket, message, and outbox writes
- when ticket creation succeeds, should not send notification inline

## Out of scope

- notification delivery
- ticket assignment
- abuse/rate limiting is intentionally not handled here; repeated valid requests may create repeated tickets because gateway-level throttling owns that concern

## References

- `src/http/routes/account.ts` - use the authenticated endpoint declaration and handler wiring pattern
- `src/http/errors.ts` - use existing 401, 422, and 500 response mapping style
- `src/db/migrations/004_create_notification_outbox.ts` - use migration style for JSONB outbox payloads and nullable `processed_at`
- `src/db/transaction.ts` - use the existing transaction boundary pattern around all writes
- `src/id/ticket.ts` - use existing ticket id and ticket number generation style

## Implementation notes

- Store notification payload JSON keys as snake_case in PostgreSQL.
