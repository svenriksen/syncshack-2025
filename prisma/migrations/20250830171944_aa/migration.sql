/*
  Warnings:

  - The values [sapling,young,mature,withered] on the enum `TreeType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."TreeType_new" AS ENUM ('pine', 'bamboo', 'maple', 'bonsai', 'sakura');
ALTER TABLE "public"."Garden" ALTER COLUMN "type" TYPE "public"."TreeType_new" USING ("type"::text::"public"."TreeType_new");
ALTER TYPE "public"."TreeType" RENAME TO "TreeType_old";
ALTER TYPE "public"."TreeType_new" RENAME TO "TreeType";
DROP TYPE "public"."TreeType_old";
COMMIT;
