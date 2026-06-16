Add reservation lifecycle for a community tool-lending app.

# Reserve tool

Reserve one available tool for member pickup.

## Required dependencies

Database migration:

```sql
-- File: src/db/migrations/012_create_tool_reservation.sql
CREATE TYPE tool_reservation_status AS ENUM ('pending_pickup', 'checked_out', 'expired', 'cancelled');

CREATE TABLE tool_reservation (
  tool_reservation_id text PRIMARY KEY,
  tool_id text NOT NULL REFERENCES tool(tool_id),
  member_id text NOT NULL REFERENCES member(member_id),
  status tool_reservation_status NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE INDEX tool_reservation_pending_tool_unique
  ON tool_reservation (tool_id)
  WHERE status = 'pending_pickup';
```

## Entry

`POST /api/v1/tool-reservations`

```ts
// File: src/reservations/ToolReservationHttp.ts
const ReserveToolRequest = z.object({
  toolId: Tool.ToolId,
})

const ReserveToolResponse = z.object({
  reservationId: ToolReservation.ToolReservationId,
  expiresAt: z.string().datetime(),
})
```

Response status: `201`

## Flow

```flow
-> HttpAuth.requireMember
-> decode request body with `ReserveToolRequest`
  -> if decode fails
    <- respond 422
-> Member.getActiveMemberOrNull(auth.memberId)
  -> if null
    <- respond 403
-> Database.transaction
  -> Tool.lockById(request.toolId)
    -> if null
      <- respond 404
    -> if tool.status is not `available`
      <- respond 409
  -> ToolReservation.generateToolReservationId
  -> Clock.now
  -> ToolReservation.createPending({ reservationId, toolId: tool.toolId, memberId: member.memberId, expiresAt })
    -> if pending reservation unique constraint fails
      <- respond 409
  -> Tool.markReserved(tool.toolId)
<- respond 201 { reservationId: reservation.reservationId, expiresAt: reservation.expiresAt }
```

## Behaviors

- when member is active and tool is available, should create a pending pickup reservation
- when reservation is created, should mark tool reserved
- when request body fails schema decoding, should respond 422
- when member is not authenticated, should respond 401
- when authenticated member is not active, should respond 403
- when tool does not exist, should respond 404
- when tool is reserved, should respond 409
- when tool is checked out, should respond 409
- when concurrent requests reserve the same tool, should create at most one pending reservation
- when reservation insert fails, should not update the tool status
- when tool status update fails, should not create the reservation

## Out of scope

- reservation waitlists
- member borrowing-limit enforcement is intentionally not handled here; `MemberPolicy.canReserveTool` will be added separately

## References

- `src/http/memberRoutes.ts` - use authenticated member endpoint declaration and handler shape
- `src/http/errors.ts` - use existing 401, 403, 404, 409, and 422 response mapping
- `src/tools/Tool.ts` - use `Tool.ToolId`, `Tool.lockById`, and tool status values
- `src/members/Member.ts` - use `Member.getActiveMemberOrNull` and active-member semantics
- `src/db/transaction.ts` - use existing transaction boundary style

## Implementation notes

- Reservation expiration is `createdAt + 24 hours`.
- `Tool.lockById` must use row-level locking before availability is checked.

# Check out reservation

Allow staff to check out a pending reservation.

## Required dependencies

Database migration:

```sql
-- File: src/db/migrations/013_create_tool_loan.sql
CREATE TABLE tool_loan (
  tool_loan_id text PRIMARY KEY,
  tool_id text NOT NULL REFERENCES tool(tool_id),
  member_id text NOT NULL REFERENCES member(member_id),
  tool_reservation_id text UNIQUE REFERENCES tool_reservation(tool_reservation_id),
  checked_out_by_staff_id text NOT NULL REFERENCES staff(staff_id),
  checked_out_at timestamptz NOT NULL,
  due_at timestamptz NOT NULL,
  returned_at timestamptz
);
```

## Entry

`POST /api/v1/tool-reservations/:reservationId/checkout`

```ts
// File: src/reservations/ToolReservationHttp.ts
const CheckoutReservationParams = z.object({
  reservationId: ToolReservation.ToolReservationId,
})

const CheckoutReservationResponse = z.object({
  loanId: ToolLoan.ToolLoanId,
  dueAt: z.string().datetime(),
})
```

Response status: `201`

## Flow

```flow
-> HttpAuth.requireStaff
-> decode path params with `CheckoutReservationParams`
  -> if decode fails
    <- respond 404
-> Database.transaction
  -> ToolReservation.lockById(params.reservationId)
    -> if null
      <- respond 404
    -> if reservation.status is not `pending_pickup`
      <- respond 409
  -> Clock.now
  -> if reservation.expiresAt is before or equal to now
    -> ToolReservation.markExpired(reservation.reservationId)
    -> Tool.markAvailable(reservation.toolId)
    <- respond 409
  -> Tool.lockById(reservation.toolId)
    -> if tool.status is not `reserved`
      <- respond 409
  -> ToolLoan.generateToolLoanId
  -> calculate dueAt
  -> ToolLoan.create({ loanId, toolId: reservation.toolId, memberId: reservation.memberId, reservationId: reservation.reservationId, checkedOutByStaffId: staff.staffId, checkedOutAt: now, dueAt })
    -> if reservation unique constraint fails
      <- respond 409
  -> ToolReservation.markCheckedOut(reservation.reservationId)
  -> Tool.markCheckedOut(reservation.toolId)
<- respond 201 { loanId: loan.loanId, dueAt: loan.dueAt }
```

## Behaviors

- when reservation is pending and not expired, should create a loan
- when checkout succeeds, should mark reservation checked out
- when checkout succeeds, should mark tool checked out
- when actor is not authenticated staff, should respond 403
- when reservation id param is invalid, should respond 404
- when reservation does not exist, should respond 404
- when reservation is expired, should respond 409
- when expired reservation is checked out, should release the tool
- when reservation is already checked out, should respond 409
- when reservation is cancelled, should respond 409
- when loan insert fails, should not change reservation or tool status
- when reservation status update fails, should not create a loan or change tool status

## Out of scope

- payment or deposit collection
- overdue fee calculation is intentionally not handled here; checkout only opens the loan and due-date enforcement is owned by the overdue worker

## References

- `src/http/staffRoutes.ts` - use authenticated staff endpoint declaration and authorization pattern
- `src/http/errors.ts` - use existing 403, 404, and 409 response mapping
- `src/loans/ToolLoan.ts` - use `ToolLoan.create`, `ToolLoan.ToolLoanId`, and due-date persistence style
- `src/reservations/ToolReservation.ts` - use reservation status transition helpers
- `src/tools/Tool.ts` - use locked tool reads and status transition helpers
- `src/db/transaction.ts` - use existing transaction boundary style

## Implementation notes

- Loan due date is checkout time plus 7 calendar days.
- Expired reservation release during checkout must happen in the same transaction as the failed checkout response.

# Expire reservations

Release pending reservations after their expiration time.

## Required dependencies

Worker registration:

```ts
// File: src/workers/ExpireToolReservationsWorker.ts
declare const ExpireToolReservationsWorker: WorkerDefinition<{
  schedule: 'every-minute'
}>
```

## Entry

Scheduled worker every minute.

```ts
// File: src/reservations/ToolReservationWorker.ts
declare function expireToolReservations(input: {
  now: Date
  limit: number
}): Promise<{
  expiredCount: number
}>
```

## Flow

```flow
-> Database.transaction
  -> ToolReservation.findExpiredPendingForUpdateSkipLocked({ now: input.now, limit: input.limit })
  -> if no reservations found
    <- return { expiredCount: 0 }
  -> for each reservation
    -> ToolReservation.markExpired(reservation.reservationId)
    -> Tool.markAvailable(reservation.toolId)
<- return { expiredCount: expiredReservations.length }
```

## Behaviors

- when pending reservation is expired, should mark reservation expired
- when reservation expires, should mark tool available
- when no reservations are expired, should return expired count `0`
- when reservation is already checked out, should not change it
- when reservation is cancelled, should not change it
- when multiple workers run concurrently, each reservation should be processed at most once
- when more expired reservations exist than the limit, should process no more than the limit
- when any update in the batch fails, should rollback the batch

## Out of scope

- member notification about expired reservation
- partial batch success is intentionally not handled; a failed batch rolls back and will be retried by the next scheduled run

## References

- `src/workers/index.ts` - use existing worker registration pattern
- `src/db/batchJobs.ts` - use existing batch transaction and logging pattern
- `src/reservations/ToolReservation.ts` - use expired-pending query and status transition helpers
- `src/tools/Tool.ts` - use existing tool status transition helpers

## Implementation notes

- Use `FOR UPDATE SKIP LOCKED` in `ToolReservation.findExpiredPendingForUpdateSkipLocked`.
- Reservation expiration and tool release must happen in the same transaction.

---

# Context

- PostgreSQL row locking docs, `SELECT ... FOR UPDATE`: https://www.postgresql.org/docs/current/explicit-locking.html
- PostgreSQL `SKIP LOCKED` docs: https://www.postgresql.org/docs/current/sql-select.html
