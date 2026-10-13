DROP INDEX "products_slug_key";--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_slug_key" UNIQUE("slug");