CREATE TYPE "public"."order_payment_method" AS ENUM('card', 'advance', 'cod');--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "currency" SET DEFAULT 'PKR';--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_method" "order_payment_method" DEFAULT 'card' NOT NULL;