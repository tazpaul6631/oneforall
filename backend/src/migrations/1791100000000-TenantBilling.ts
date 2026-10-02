import { MigrationInterface, QueryRunner } from 'typeorm';

export class TenantBilling1791100000000 implements MigrationInterface {
  name = 'TenantBilling1791100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "tenants" ADD "status" varchar NOT NULL DEFAULT ('active')`);
    await queryRunner.query(`ALTER TABLE "tenants" ADD "activeUntil" datetime`);
    await queryRunner.query(`CREATE TABLE "operators" ("id" varchar PRIMARY KEY NOT NULL, "email" varchar NOT NULL, "passwordHash" varchar NOT NULL, "fullName" varchar NOT NULL, "active" boolean NOT NULL DEFAULT (1), "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_operators_email" UNIQUE ("email"))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "operators"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "activeUntil"`);
    await queryRunner.query(`ALTER TABLE "tenants" DROP COLUMN "status"`);
  }
}
