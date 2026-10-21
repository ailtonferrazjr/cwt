---
tags: [backend, feature, api]
domains: [orders]
related: [order-list-pagination]
---

# add-order-filters

**Branch:** `add-order-filters`
**Created:** 2026-02-20 11:00:00
**Completed:** 2026-02-21 16:42:10

## Problem

The orders API has no way to filter by status or date range, so the admin
UI loads every order and filters in the browser. This gets slow past a few
thousand orders.

## Context

- Existing endpoint: `GET /api/orders` returns all orders
- The admin UI needs status (open/closed) and a created-at range
- Builds on the pagination work in `order-list-pagination`

## Plan

1. Accept `?status=open&createdAfter=2026-01-01` on the controller
2. Validate the query with Zod
3. Pass filters through to the repository
4. Build the Prisma `where` clause from the filters
5. Cover filter combinations with tests

## Changes

- `orders.controller.ts`: parse and forward query params
- `orders.schemas.ts`: filter schema with date coercion
- `orders.repository.ts`: `findMany` accepts a filter object
- Unit tests for each filter and their combinations

## Testing

- Manual: every filter combination through the admin UI
- Unit: 8 cases, including empty ranges and invalid dates
- Integration: verified against a seed of 1,000 orders

## Learnings

- Prisma date filters need explicit timezone handling (`gte` vs `gt`)
- Validate date strings before they reach the query builder

## Related Worktrees

- [order-list-pagination](../completed/2026-02-10-order-list-pagination.md): cursor pagination for the same endpoint

---

## Commits

- `a1b2c3d feat(orders): add status and date range filters`
- `e4f5a6b test(orders): cover filter combinations`
