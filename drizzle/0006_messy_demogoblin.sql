CREATE TYPE "public"."order_fulfillment_status" AS ENUM('pending', 'confirmed', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "stock_deducted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "fulfillment_status" "order_fulfillment_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "courier" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "tracking_number" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "shipped_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "orders_fulfillment_status_idx" ON "orders" USING btree ("fulfillment_status");--> statement-breakpoint
-- Existing rows: a paid order already took its stock out and is ready to pack, so
-- its fulfilment starts at `confirmed`; the states Stripe closed are terminal.
UPDATE "orders" SET "fulfillment_status" = 'confirmed' WHERE "status" = 'paid';--> statement-breakpoint
UPDATE "orders" SET "fulfillment_status" = 'cancelled' WHERE "status" IN ('cancelled', 'failed', 'expired');--> statement-breakpoint
-- Lines of paid orders are marked as deducted so a cancellation can return them.
-- An order that was paid for stock which had already run out is indistinguishable
-- here, so on cancellation it would credit those units back once.
UPDATE "order_items" SET "stock_deducted" = true WHERE "order_id" IN (SELECT "id" FROM "orders" WHERE "status" = 'paid');