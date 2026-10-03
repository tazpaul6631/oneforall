import { MigrationInterface, QueryRunner } from 'typeorm';

export class Modifiers1791200000000 implements MigrationInterface {
  name = 'Modifiers1791200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "modifier_groups" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "name" varchar NOT NULL, "required" boolean NOT NULL DEFAULT (0), "minSelect" integer NOT NULL DEFAULT (0), "maxSelect" integer NOT NULL DEFAULT (1), "sortOrder" integer NOT NULL DEFAULT (0))`);
    await queryRunner.query(`CREATE INDEX "IDX_modifier_groups_tenant" ON "modifier_groups" ("tenantId")`);
    await queryRunner.query(`CREATE TABLE "modifier_options" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "groupId" varchar NOT NULL, "name" varchar NOT NULL, "extraVnd" integer NOT NULL, "sortOrder" integer NOT NULL DEFAULT (0))`);
    await queryRunner.query(`CREATE INDEX "IDX_modifier_options_tenant" ON "modifier_options" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_modifier_options_group" ON "modifier_options" ("groupId")`);
    await queryRunner.query(`CREATE TABLE "product_modifier_groups" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "productId" varchar NOT NULL, "groupId" varchar NOT NULL)`);
    await queryRunner.query(`CREATE INDEX "IDX_product_modifier_groups_tenant" ON "product_modifier_groups" ("tenantId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_product_modifier_group" ON "product_modifier_groups" ("tenantId", "productId", "groupId")`);
    await queryRunner.query(`ALTER TABLE "order_lines" ADD "note" varchar`);
    await queryRunner.query(`CREATE TABLE "order_line_options" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "orderLineId" varchar NOT NULL, "name" varchar NOT NULL, "extraVnd" integer NOT NULL)`);
    await queryRunner.query(`CREATE INDEX "IDX_order_line_options_tenant" ON "order_line_options" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_order_line_options_line" ON "order_line_options" ("orderLineId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "order_line_options"`);
    await queryRunner.query(`ALTER TABLE "order_lines" DROP COLUMN "note"`);
    await queryRunner.query(`DROP TABLE "product_modifier_groups"`);
    await queryRunner.query(`DROP TABLE "modifier_options"`);
    await queryRunner.query(`DROP TABLE "modifier_groups"`);
  }
}
