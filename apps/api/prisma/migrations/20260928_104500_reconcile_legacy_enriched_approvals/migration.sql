-- LOT 9B-C - corrective legacy reconciliation.
-- The previous cleanup migration may already be applied in developer
-- databases. Keep it immutable and repair its edge cases here.

-- Listings already bound to a reservation/completed transaction are not
-- repairable through the editable-listing flow. Restore only rows that the
-- previous migration requeued, preserving their transaction-bound state.
UPDATE "Listing"
SET
  "status" = 'APPROVED',
  "moderationReason" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  "status" = 'PENDING'
  AND "availabilityStatus" IN ('RESERVED', 'COMPLETED')
  AND "moderationReason" =
    'Publication enrichie à compléter avant republication.';

-- Requeue only repairable APPROVED listings whose enriched assets are not
-- equivalent to the runtime publication contract.
UPDATE "Listing" AS listing
SET
  "status" = 'PENDING',
  "moderationReason" =
    'Publication enrichie à compléter avant republication.',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  listing."status" = 'APPROVED'
  AND listing."availabilityStatus" = 'AVAILABLE'
  AND (
    (
      SELECT COUNT(*)
      FROM "ListingImage" AS image
      WHERE image."listingId" = listing."id"
    ) NOT BETWEEN 5 AND 8
    OR (
      listing."operationType" = 'TRADE'
      AND (
        SELECT
          COUNT(*) <> COUNT(
            DISTINCT NULLIF(
              LOWER(
                BTRIM(
                  wish."label",
                  E' \t\n\r\f\v' ||
                  U&'\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
                )
              ),
              ''
            )
          )
          OR COUNT(
            DISTINCT NULLIF(
              LOWER(
                BTRIM(
                  wish."label",
                  E' \t\n\r\f\v' ||
                  U&'\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
                )
              ),
              ''
            )
          ) NOT BETWEEN 5 AND 10
          OR BOOL_OR(
            wish."label" <>
            BTRIM(
              wish."label",
              E' \t\n\r\f\v' ||
              U&'\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'
            )
          )
        FROM "ListingTradeWish" AS wish
        WHERE wish."listingId" = listing."id"
      )
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
