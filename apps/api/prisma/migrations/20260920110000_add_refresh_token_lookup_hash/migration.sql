-- Add a deterministic lookup key so refresh validation does not bcrypt-scan
-- every active token. Existing rows remain valid for forced re-login fallback.
ALTER TABLE "refresh_tokens" ADD COLUMN "tokenLookupHash" TEXT;

CREATE UNIQUE INDEX "refresh_tokens_tokenLookupHash_key"
  ON "refresh_tokens"("tokenLookupHash");

CREATE INDEX "refresh_tokens_tokenLookupHash_idx"
  ON "refresh_tokens"("tokenLookupHash");
