import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExtendSales1790910000000 implements MigrationInterface {
  name = 'ExtendSales1790910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD "customerId" varchar`);
    await queryRunner.query(`ALTER TABLE "orders" ADD "refundedVnd" integer NOT NULL DEFAULT (0)`);
    await queryRunner.query(`ALTER TABLE "order_lines" ADD "refundedQty" integer NOT NULL DEFAULT (0)`);
    await queryRunner.query(`ALTER TABLE "product_variants" ADD "sku" varchar`);

    await queryRunner.query(`CREATE TABLE "customers" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "name" varchar NOT NULL, "phone" varchar, "email" varchar, "note" varchar, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`);
    await queryRunner.query(`CREATE INDEX "IDX_customers_tenant" ON "customers" ("tenantId")`);

    await queryRunner.query(`CREATE TABLE "refunds" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "orderId" varchar NOT NULL, "amountVnd" integer NOT NULL, "reason" varchar, "idempotencyKey" varchar NOT NULL, "createdBy" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_refund_key" UNIQUE ("tenantId", "idempotencyKey"))`);
    await queryRunner.query(`CREATE INDEX "IDX_refunds_tenant" ON "refunds" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_refunds_order" ON "refunds" ("orderId")`);
    await queryRunner.query(`CREATE TABLE "refund_lines" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "refundId" varchar NOT NULL, "orderLineId" varchar NOT NULL, "qty" integer NOT NULL, "amountVnd" integer NOT NULL)`);
    await queryRunner.query(`CREATE INDEX "IDX_refund_lines_tenant" ON "refund_lines" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_refund_lines_refund" ON "refund_lines" ("refundId")`);

    await queryRunner.query(`CREATE TABLE "stock_levels" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "productId" varchar NOT NULL, "variantId" varchar, "qty" integer NOT NULL DEFAULT (0))`);
    await queryRunner.query(`CREATE INDEX "IDX_stock_levels_tenant" ON "stock_levels" ("tenantId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_stock_level" ON "stock_levels" ("tenantId", "productId", IFNULL("variantId", ''))`);
    await queryRunner.query(`CREATE TABLE "stock_moves" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "productId" varchar NOT NULL, "variantId" varchar, "delta" integer NOT NULL, "reason" varchar NOT NULL, "refType" varchar NOT NULL, "refId" varchar NOT NULL, "note" varchar, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`);
    await queryRunner.query(`CREATE INDEX "IDX_stock_moves_tenant" ON "stock_moves" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_stock_moves_ref" ON "stock_moves" ("tenantId", "refType", "refId", "reason")`);

    await queryRunner.query(`CREATE TABLE "audit_logs" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "actorId" varchar, "action" varchar NOT NULL, "entityType" varchar NOT NULL, "entityId" varchar NOT NULL, "detail" text, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_tenant" ON "audit_logs" ("tenantId")`);

    await queryRunner.query(`CREATE TABLE "fnb_areas" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "name" varchar NOT NULL, "sortOrder" integer NOT NULL DEFAULT (0))`);
    await queryRunner.query(`CREATE INDEX "IDX_fnb_areas_tenant" ON "fnb_areas" ("tenantId")`);
    await queryRunner.query(`CREATE TABLE "fnb_tables" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "areaId" varchar NOT NULL, "name" varchar NOT NULL, "seats" integer NOT NULL DEFAULT (4), "status" varchar NOT NULL DEFAULT ('free'), "orderId" varchar)`);
    await queryRunner.query(`CREATE INDEX "IDX_fnb_tables_tenant" ON "fnb_tables" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_fnb_tables_area" ON "fnb_tables" ("areaId")`);
    await queryRunner.query(`CREATE INDEX "IDX_fnb_tables_order" ON "fnb_tables" ("orderId")`);
    await queryRunner.query(`CREATE TABLE "fnb_tickets" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "orderId" varchar NOT NULL, "status" varchar NOT NULL DEFAULT ('queued'), "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`);
    await queryRunner.query(`CREATE INDEX "IDX_fnb_tickets_tenant" ON "fnb_tickets" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_fnb_tickets_order" ON "fnb_tickets" ("orderId")`);
    await queryRunner.query(`CREATE TABLE "fnb_ticket_lines" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "ticketId" varchar NOT NULL, "name" varchar NOT NULL, "qty" integer NOT NULL)`);
    await queryRunner.query(`CREATE INDEX "IDX_fnb_ticket_lines_tenant" ON "fnb_ticket_lines" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_fnb_ticket_lines_ticket" ON "fnb_ticket_lines" ("ticketId")`);
    await queryRunner.query(`CREATE TABLE "fnb_recipes" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "productId" varchar NOT NULL, "name" varchar NOT NULL, CONSTRAINT "UQ_fnb_recipe_product" UNIQUE ("tenantId", "productId"))`);
    await queryRunner.query(`CREATE INDEX "IDX_fnb_recipes_tenant" ON "fnb_recipes" ("tenantId")`);
    await queryRunner.query(`CREATE TABLE "fnb_recipe_items" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "recipeId" varchar NOT NULL, "name" varchar NOT NULL, "qty" integer NOT NULL, "unit" varchar NOT NULL)`);
    await queryRunner.query(`CREATE INDEX "IDX_fnb_recipe_items_tenant" ON "fnb_recipe_items" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_fnb_recipe_items_recipe" ON "fnb_recipe_items" ("recipeId")`);

    await queryRunner.query(`CREATE TABLE "retail_returns" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "orderId" varchar NOT NULL, "refundId" varchar NOT NULL, "totalVnd" integer NOT NULL, "note" varchar, "idempotencyKey" varchar NOT NULL, "createdBy" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_retail_return_key" UNIQUE ("tenantId", "idempotencyKey"))`);
    await queryRunner.query(`CREATE INDEX "IDX_retail_returns_tenant" ON "retail_returns" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_retail_returns_order" ON "retail_returns" ("orderId")`);
    await queryRunner.query(`CREATE TABLE "retail_return_lines" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "returnId" varchar NOT NULL, "orderLineId" varchar NOT NULL, "name" varchar NOT NULL, "qty" integer NOT NULL, "amountVnd" integer NOT NULL)`);
    await queryRunner.query(`CREATE INDEX "IDX_retail_return_lines_tenant" ON "retail_return_lines" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_retail_return_lines_return" ON "retail_return_lines" ("returnId")`);
    await queryRunner.query(`INSERT INTO "tenant_features" ("id", "tenantId", "featureKey") SELECT 'inv-' || "id", "id", 'core.inventory' FROM "tenants" WHERE NOT EXISTS (SELECT 1 FROM "tenant_features" tf WHERE tf."tenantId" = "tenants"."id" AND tf."featureKey" = 'core.inventory')`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "retail_return_lines"`);
    await queryRunner.query(`DROP TABLE "retail_returns"`);
    await queryRunner.query(`DROP TABLE "fnb_recipe_items"`);
    await queryRunner.query(`DROP TABLE "fnb_recipes"`);
    await queryRunner.query(`DROP TABLE "fnb_ticket_lines"`);
    await queryRunner.query(`DROP TABLE "fnb_tickets"`);
    await queryRunner.query(`DROP TABLE "fnb_tables"`);
    await queryRunner.query(`DROP TABLE "fnb_areas"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "stock_moves"`);
    await queryRunner.query(`DROP TABLE "stock_levels"`);
    await queryRunner.query(`DROP TABLE "refund_lines"`);
    await queryRunner.query(`DROP TABLE "refunds"`);
    await queryRunner.query(`DROP TABLE "customers"`);
    await queryRunner.query(`ALTER TABLE "product_variants" DROP COLUMN "sku"`);
    await queryRunner.query(`ALTER TABLE "order_lines" DROP COLUMN "refundedQty"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "refundedVnd"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "customerId"`);
  }
}
