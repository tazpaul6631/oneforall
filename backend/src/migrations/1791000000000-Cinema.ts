import { MigrationInterface, QueryRunner } from 'typeorm';

export class Cinema1791000000000 implements MigrationInterface {
  name = 'Cinema1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE "cinema_movies" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "productId" varchar NOT NULL, "vipVariantId" varchar, "title" varchar NOT NULL, "durationMin" integer NOT NULL)`);
    await queryRunner.query(`CREATE INDEX "IDX_cinema_movies_tenant" ON "cinema_movies" ("tenantId")`);

    await queryRunner.query(`CREATE TABLE "cinema_rooms" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "name" varchar NOT NULL)`);
    await queryRunner.query(`CREATE INDEX "IDX_cinema_rooms_tenant" ON "cinema_rooms" ("tenantId")`);

    await queryRunner.query(`CREATE TABLE "cinema_seats" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "roomId" varchar NOT NULL, "rowLabel" varchar NOT NULL, "number" integer NOT NULL, "kind" varchar NOT NULL DEFAULT ('standard'))`);
    await queryRunner.query(`CREATE INDEX "IDX_cinema_seats_tenant" ON "cinema_seats" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_cinema_seats_room" ON "cinema_seats" ("roomId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_cinema_seat" ON "cinema_seats" ("tenantId", "roomId", "rowLabel", "number")`);

    await queryRunner.query(`CREATE TABLE "cinema_showtimes" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "movieId" varchar NOT NULL, "roomId" varchar NOT NULL, "startsAt" datetime NOT NULL)`);
    await queryRunner.query(`CREATE INDEX "IDX_cinema_showtimes_tenant" ON "cinema_showtimes" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_cinema_showtimes_start" ON "cinema_showtimes" ("tenantId", "startsAt")`);

    await queryRunner.query(`CREATE TABLE "cinema_tickets" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "showtimeId" varchar NOT NULL, "seatId" varchar NOT NULL, "status" varchar NOT NULL, "orderId" varchar, "orderLineId" varchar, "holdKey" varchar, "holdUntil" datetime)`);
    await queryRunner.query(`CREATE INDEX "IDX_cinema_tickets_tenant" ON "cinema_tickets" ("tenantId")`);
    await queryRunner.query(`CREATE INDEX "IDX_cinema_tickets_show" ON "cinema_tickets" ("showtimeId")`);
    await queryRunner.query(`CREATE INDEX "IDX_cinema_tickets_order" ON "cinema_tickets" ("orderId")`);
    await queryRunner.query(`CREATE UNIQUE INDEX "UQ_cinema_ticket" ON "cinema_tickets" ("tenantId", "showtimeId", "seatId")`);

    await queryRunner.query(`CREATE TABLE "cinema_sales" ("id" varchar PRIMARY KEY NOT NULL, "tenantId" varchar NOT NULL, "idempotencyKey" varchar NOT NULL, "orderId" varchar NOT NULL, "createdAt" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_cinema_sale" UNIQUE ("tenantId", "idempotencyKey"))`);
    await queryRunner.query(`CREATE INDEX "IDX_cinema_sales_tenant" ON "cinema_sales" ("tenantId")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "cinema_sales"`);
    await queryRunner.query(`DROP TABLE "cinema_tickets"`);
    await queryRunner.query(`DROP TABLE "cinema_showtimes"`);
    await queryRunner.query(`DROP TABLE "cinema_seats"`);
    await queryRunner.query(`DROP TABLE "cinema_rooms"`);
    await queryRunner.query(`DROP TABLE "cinema_movies"`);
  }
}
