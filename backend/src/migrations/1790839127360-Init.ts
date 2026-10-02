import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1790839127360 implements MigrationInterface {
    name = 'Init1790839127360'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tenants" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar NOT NULL, "preset" varchar NOT NULL, "settings" text NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`CREATE TABLE "tenant_features" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "featureKey" varchar NOT NULL, CONSTRAINT "UQ_9c9fa06c769786adc512e65f994" UNIQUE ("tenantId", "featureKey"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7c57aa735c08d8b6ac7edc7709" ON "tenant_features" ("tenantId") `);
        await queryRunner.query(`CREATE TABLE "categories" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "name" varchar NOT NULL, "sortOrder" integer NOT NULL DEFAULT (0))`);
        await queryRunner.query(`CREATE INDEX "IDX_46a85229c9953b2b94f768190b" ON "categories" ("tenantId") `);
        await queryRunner.query(`CREATE TABLE "products" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "categoryId" varchar, "name" varchar NOT NULL, "sku" varchar, "priceVnd" integer NOT NULL, "active" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`CREATE INDEX "IDX_6804855ba1a19523ea57e0769b" ON "products" ("tenantId") `);
        await queryRunner.query(`CREATE TABLE "product_variants" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "productId" varchar NOT NULL, "name" varchar NOT NULL, "priceVnd" integer NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "IDX_cb549293071d118e0d19a89eb2" ON "product_variants" ("tenantId") `);
        await queryRunner.query(`CREATE TABLE "orders" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "seq" integer NOT NULL, "status" varchar NOT NULL DEFAULT ('open'), "subtotalVnd" integer NOT NULL, "discountVnd" integer NOT NULL DEFAULT (0), "taxVnd" integer NOT NULL DEFAULT (0), "totalVnd" integer NOT NULL, "taxRatePercent" integer NOT NULL DEFAULT (0), "taxMode" varchar NOT NULL DEFAULT ('inclusive'), "discountType" varchar, "discountValue" integer, "changeVnd" integer NOT NULL DEFAULT (0), "note" varchar, "paidKey" varchar, "createdBy" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), "paidAt" datetime, CONSTRAINT "UQ_4c7aaf769b94405c89c86b1e67e" UNIQUE ("tenantId", "seq"))`);
        await queryRunner.query(`CREATE INDEX "IDX_208a358e9fe8abe6e1d8245980" ON "orders" ("tenantId") `);
        await queryRunner.query(`CREATE TABLE "order_lines" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "orderId" varchar NOT NULL, "productId" varchar NOT NULL, "variantId" varchar, "name" varchar NOT NULL, "unitPriceVnd" integer NOT NULL, "qty" integer NOT NULL, "lineTotalVnd" integer NOT NULL)`);
        await queryRunner.query(`CREATE INDEX "IDX_a7bf61fe4034918d9b3efb5e72" ON "order_lines" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_307e8091afc1a959953d06d5ad" ON "order_lines" ("orderId") `);
        await queryRunner.query(`CREATE TABLE "payments" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "orderId" varchar NOT NULL, "method" varchar NOT NULL, "amountVnd" integer NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`CREATE INDEX "IDX_98a04cdcbac4f6a2c55c7d1935" ON "payments" ("tenantId") `);
        await queryRunner.query(`CREATE INDEX "IDX_af929a5f2a400fdb6913b4967e" ON "payments" ("orderId") `);
        await queryRunner.query(`CREATE TABLE "users" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "email" varchar NOT NULL, "passwordHash" varchar NOT NULL, "fullName" varchar NOT NULL, "role" varchar NOT NULL DEFAULT ('staff'), "active" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')))`);
        await queryRunner.query(`CREATE INDEX "IDX_c58f7e88c286e5e3478960a998" ON "users" ("tenantId") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
        await queryRunner.query(`DROP INDEX "IDX_cb549293071d118e0d19a89eb2"`);
        await queryRunner.query(`CREATE TABLE "temporary_product_variants" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "productId" varchar NOT NULL, "name" varchar NOT NULL, "priceVnd" integer NOT NULL, CONSTRAINT "FK_f515690c571a03400a9876600b5" FOREIGN KEY ("productId") REFERENCES "products" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`);
        await queryRunner.query(`INSERT INTO "temporary_product_variants"("id", "tenantId", "productId", "name", "priceVnd") SELECT "id", "tenantId", "productId", "name", "priceVnd" FROM "product_variants"`);
        await queryRunner.query(`DROP TABLE "product_variants"`);
        await queryRunner.query(`ALTER TABLE "temporary_product_variants" RENAME TO "product_variants"`);
        await queryRunner.query(`CREATE INDEX "IDX_cb549293071d118e0d19a89eb2" ON "product_variants" ("tenantId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_cb549293071d118e0d19a89eb2"`);
        await queryRunner.query(`ALTER TABLE "product_variants" RENAME TO "temporary_product_variants"`);
        await queryRunner.query(`CREATE TABLE "product_variants" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "productId" varchar NOT NULL, "name" varchar NOT NULL, "priceVnd" integer NOT NULL)`);
        await queryRunner.query(`INSERT INTO "product_variants"("id", "tenantId", "productId", "name", "priceVnd") SELECT "id", "tenantId", "productId", "name", "priceVnd" FROM "temporary_product_variants"`);
        await queryRunner.query(`DROP TABLE "temporary_product_variants"`);
        await queryRunner.query(`CREATE INDEX "IDX_cb549293071d118e0d19a89eb2" ON "product_variants" ("tenantId") `);
        await queryRunner.query(`DROP INDEX "IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP INDEX "IDX_c58f7e88c286e5e3478960a998"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP INDEX "IDX_af929a5f2a400fdb6913b4967e"`);
        await queryRunner.query(`DROP INDEX "IDX_98a04cdcbac4f6a2c55c7d1935"`);
        await queryRunner.query(`DROP TABLE "payments"`);
        await queryRunner.query(`DROP INDEX "IDX_307e8091afc1a959953d06d5ad"`);
        await queryRunner.query(`DROP INDEX "IDX_a7bf61fe4034918d9b3efb5e72"`);
        await queryRunner.query(`DROP TABLE "order_lines"`);
        await queryRunner.query(`DROP INDEX "IDX_208a358e9fe8abe6e1d8245980"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP INDEX "IDX_cb549293071d118e0d19a89eb2"`);
        await queryRunner.query(`DROP TABLE "product_variants"`);
        await queryRunner.query(`DROP INDEX "IDX_6804855ba1a19523ea57e0769b"`);
        await queryRunner.query(`DROP TABLE "products"`);
        await queryRunner.query(`DROP INDEX "IDX_46a85229c9953b2b94f768190b"`);
        await queryRunner.query(`DROP TABLE "categories"`);
        await queryRunner.query(`DROP INDEX "IDX_7c57aa735c08d8b6ac7edc7709"`);
        await queryRunner.query(`DROP TABLE "tenant_features"`);
        await queryRunner.query(`DROP TABLE "tenants"`);
    }

}
