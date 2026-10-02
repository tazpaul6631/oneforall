import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClsService } from 'nestjs-cls';
import { DataSource } from 'typeorm';
import { AuthService } from './core/auth/auth.service';
import { ProductService } from './core/product/product.service';
import { assertSeedAllowed } from './seed-guard';
import { CinemaService } from './verticals/cinema/cinema.service';
import { FnbService } from './verticals/fnb/fnb.service';

type SeedItem = { name: string; priceVnd: number; sku?: string; variants?: { name: string; priceVnd: number; sku?: string }[] };
type Seed = { category: string; items: SeedItem[] }[];
const MENU: Record<string, Seed> = {
  fnb_cafe: [
    {
      category: 'Cà phê', items: [
        { name: 'Cà phê sữa', priceVnd: 29000, variants: [{ name: 'M', priceVnd: 29000 }, { name: 'L', priceVnd: 35000 }] },
        { name: 'Bạc xỉu', priceVnd: 32000 }]
    },
    { category: 'Trà & bánh', items: [{ name: 'Trà đào cam sả', priceVnd: 39000 }, { name: 'Bánh croissant', priceVnd: 35000 }] },
  ],
  fnb_restaurant: [
    { category: 'Món chính', items: [{ name: 'Cơm gà xối mỡ', priceVnd: 65000 }, { name: 'Bún bò Huế', priceVnd: 69000 }] },
    { category: 'Đồ uống', items: [{ name: 'Nước suối', priceVnd: 15000 }, { name: 'Trà đá', priceVnd: 5000 }] },
  ],
  retail_shop: [
    { category: 'Áo', items: [{ name: 'Áo thun basic', priceVnd: 199000, sku: 'AT', variants: ['S', 'M', 'L'].map((name) => ({ name, priceVnd: 199000, sku: `AT-${name}` })) }] },
    { category: 'Quần', items: [{ name: 'Quần jeans slim', priceVnd: 459000, sku: 'QJ', variants: ['29', '30', '31'].map((name) => ({ name, priceVnd: 459000, sku: `QJ-${name}` })) }] },
  ],
};

const PASSWORD = 'Demo@12345';
const DEMOS = [
  { tenantName: 'Cà phê Góc Phố', preset: 'fnb_cafe', fullName: 'Chủ quán cà phê', email: 'cafe@demo.vn' },
  { tenantName: 'Nhà hàng Hương Biển', preset: 'fnb_restaurant', fullName: 'Chủ nhà hàng', email: 'nhahang@demo.vn' },
  { tenantName: 'Shop Thời Trang Mây', preset: 'retail_shop', fullName: 'Chủ shop', email: 'shop@demo.vn' },
  { tenantName: 'Rạp Thiên Văn', preset: 'cinema_hall', fullName: 'Chủ rạp', email: 'rap@demo.vn' },
];

async function main() {
  assertSeedAllowed();
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  const auth = app.get(AuthService);
  for (const d of DEMOS) {
    try {
      await auth.registerTenant({ ...d, password: PASSWORD });
      const ds = app.get(DataSource);
      const [{ tenantId }] = await ds.query('SELECT tenantId FROM users WHERE email = ?', [d.email]);
      await ds.query(`UPDATE tenants SET status = 'active', activeUntil = NULL WHERE id = ?`, [tenantId]);
      await app.get(ClsService).run(async () => {
        app.get(ClsService).set('tenantId', tenantId);
        const products = app.get(ProductService);
        for (const g of MENU[d.preset] ?? []) {
          const cat = await products.createCategory({ name: g.category });
          for (const i of g.items) await products.create({ ...i, categoryId: cat.id });
        }
        if (d.preset === 'cinema_hall') {
          const cinema = app.get(CinemaService);
          const movie = await cinema.createMovie({ title: 'Mai', durationMin: 100, priceVnd: 90000, vipPriceVnd: 120000 });
          const room = await cinema.createRoom({ name: 'Phòng 1', rows: 5, cols: 8, vipRows: 1 });
          const later = (hours: number) => new Date(Date.now() + hours * 3600_000).toISOString();
          await cinema.createShowtime({ movieId: movie.id, roomId: room.id, startsAt: later(3) });
          await cinema.createShowtime({ movieId: movie.id, roomId: room.id, startsAt: later(6) });
        }
        if (d.preset === 'fnb_restaurant') {
          const fnb = app.get(FnbService);
          const area = await fnb.createArea({ name: 'Tầng trệt' });
          await fnb.createTable({ areaId: area.id, name: 'Bàn 1', seats: 4 });
          await fnb.createTable({ areaId: area.id, name: 'Bàn 2', seats: 4 });
          await fnb.createTable({ areaId: area.id, name: 'Bàn 3', seats: 2 });
          const com = (await products.list()).find((p) => p.name === 'Cơm gà xối mỡ');
          if (com) {
            await fnb.saveRecipe({
              productId: com.id,
              items: [{ name: 'Cơm', qty: 200, unit: 'g' }, { name: 'Gà', qty: 150, unit: 'g' }],
            });
          }
        }
      });
      console.log(`+ ${d.email}  (${d.preset})`);
    } catch (e: any) {
      console.log(`- ${d.email}: ${e.message}`);
    }
  }
  console.log(`Mật khẩu chung: ${PASSWORD}`);
  await app.close();
}
main();
