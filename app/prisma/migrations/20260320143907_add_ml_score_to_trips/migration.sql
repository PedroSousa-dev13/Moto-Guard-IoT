-- AlterTable
ALTER TABLE "motorcycles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "trips" ADD COLUMN     "ml_model_version" TEXT,
ADD COLUMN     "ml_score" DOUBLE PRECISION;
