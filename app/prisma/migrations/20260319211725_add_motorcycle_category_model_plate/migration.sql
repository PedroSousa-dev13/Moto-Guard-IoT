-- AlterTable: add category, model, plate, updated_at to motorcycles
-- updated_at uses NOW() as default for existing rows
ALTER TABLE "motorcycles"
ADD COLUMN "category"   TEXT,
ADD COLUMN "model"      TEXT,
ADD COLUMN "plate"      TEXT,
ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW();
