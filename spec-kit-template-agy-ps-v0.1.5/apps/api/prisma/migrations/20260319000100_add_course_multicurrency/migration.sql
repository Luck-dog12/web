ALTER TABLE "Course" ADD COLUMN "priceCentsUsd" INTEGER;
ALTER TABLE "Course" ADD COLUMN "priceCentsEur" INTEGER;

UPDATE "Course"
SET "priceCentsUsd" = CASE WHEN "currency" = 'USD' THEN "priceCents" ELSE NULL END,
    "priceCentsEur" = CASE WHEN "currency" = 'EUR' THEN "priceCents" ELSE NULL END;
