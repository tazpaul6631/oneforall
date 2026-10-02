// Chỉ dùng cho TypeORM CLI (sinh/chạy migration). Ứng dụng dùng cấu hình trong app.module.ts.
import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';

export default new DataSource({
  type: 'better-sqlite3',
  database: process.env.DB_PATH ?? 'data/app.db',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
});
