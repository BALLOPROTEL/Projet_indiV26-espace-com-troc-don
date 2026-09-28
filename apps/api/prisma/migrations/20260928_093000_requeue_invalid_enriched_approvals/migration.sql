-- LOT 9B-C - legacy enriched publication safety.
-- Listings approved before image/trade-wish gates existed must be
-- reviewed again if they do not satisfy the enriched publication contract.

UPDATE "Listing" AS listing
SET
  "status" = 'PENDING',
  "moderationReason" = 'Publication enrichie à compléter avant republication.',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  listing."status" = 'APPROVED'
  AND (
    (
      SELECT COUNT(*)
      FROM "ListingImage" AS image
      WHERE image."listingId" = listing."id"
    ) NOT BETWEEN 5 AND 8
    OR (
      listing."operationType" = 'TRADE'
      AND (
        SELECT COUNT(
          DISTINCT LOWER(BTRIM(wish."label"))
        )
        FROM "ListingTradeWish" AS wish
        WHERE wish."listingId" = listing."id"
      ) NOT BETWEEN 5 AND 10
    )
    OR (
      listing."operationType" = 'DONATION'
      AND EXISTS (
        SELECT 1
        FROM "ListingTradeWish" AS wish
        WHERE wish."listingId" = listing."id"
      )
    )
  );
