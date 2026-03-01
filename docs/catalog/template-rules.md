# Catalog template rules

## External IDs
- Sample Types: `s<number>` (example: `s1`)
- Parameters: `p<number>` (example: `p1`)
- Tests: `t<number>` (example: `t1`)
- Panels: `g<number>` (example: `g1`)

## Validate/apply behavior
- **Mode `UPSERT_PATCH`**: create missing rows; patch only provided non-empty fields on existing rows.
- **Mode `CREATE_ONLY`**: skip existing rows, only insert new rows.
- Empty cells are ignored during patch updates.
- `__CLEAR__` can be used for nullable fields to explicitly clear values.

## Reference range expressions
Accepted formats:
- `a-b`
- `<n`
- `>n`
- `≤n`
- `≥n`

If expression parsing fails and no numeric low/high fallback is provided, validation returns `UNPARSEABLE_RANGE`.
