# AGENT Goals

You are building a multi-tenant health platform with LIMS first.

## Primary goals
- Never violate contract-first rule.
- Never allow cross-tenant data access.
- Never allow workflow state changes outside commands.
- Make publishing deterministic and idempotent.
- Make admin experience real and useful for observability.

## How to work
- Build in vertical slices.
- Each slice must ship: backend + UI + docs + smoke tests.
