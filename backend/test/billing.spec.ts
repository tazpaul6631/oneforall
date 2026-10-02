import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup-app';

describe('Cho thuê: chờ kích hoạt, hết hạn, khóa', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  let ops: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    ops = (await http().post('/api/auth/login').send({
      email: 'ops@test.vn', password: 'Password1',
    }).expect(201)).body.accessToken;
  });
  afterAll(() => app.close());

  const auth = () => ({ Authorization: `Bearer ${ops}` });

  async function register(email: string, preset = 'fnb_cafe') {
    const res = await http().post('/api/auth/register-tenant').send({
      tenantName: email, preset, fullName: 'Chủ', email, password: 'Password1',
    }).expect(201);
    expect(res.body).toEqual({ status: 'pending' });
    const row = (await http().get('/api/ops/tenants').set(auth()).expect(200)).body
      .find((t: { ownerEmail: string }) => t.ownerEmail === email);
    return row as { id: string; status: string; ownerEmail: string };
  }

  it('quán mới không đăng nhập được cho đến khi được kích hoạt', async () => {
    const cafe = await register('cafe-a@thue.vn');
    const other = await register('cafe-b@thue.vn');
    expect(cafe.status).toBe('pending');
    await http().post('/api/auth/login').send({ email: 'cafe-a@thue.vn', password: 'Password1' }).expect(403);
    await http().post(`/api/ops/tenants/${cafe.id}/activate`).set(auth()).send({ days: 30 }).expect(201);
    const token = (await http().post('/api/auth/login').send({ email: 'cafe-a@thue.vn', password: 'Password1' }).expect(201)).body.accessToken;
    await http().post(`/api/ops/tenants/${other.id}/activate`).set(auth()).send({ days: 30 }).expect(201);
    const tokenB = (await http().post('/api/auth/login').send({ email: 'cafe-b@thue.vn', password: 'Password1' }).expect(201)).body.accessToken;

    await http().post('/api/products').set('Authorization', `Bearer ${token}`).send({ name: 'Bạc xỉu', priceVnd: 32000 }).expect(201);
    const seen = (await http().get('/api/products').set('Authorization', `Bearer ${tokenB}`).expect(200)).body;
    expect(seen.map((p: { name: string }) => p.name)).not.toContain('Bạc xỉu');
    await http().get('/api/ops/tenants').set('Authorization', `Bearer ${token}`).expect(403);
    await http().get('/api/me/bootstrap').set(auth()).expect(403);
  });

  it('khóa, hết hạn rồi gia hạn; đặt lại mật khẩu chủ quán', async () => {
    const shop = await register('shop-thue@thue.vn', 'retail_shop');
    await http().post(`/api/ops/tenants/${shop.id}/suspend`).set(auth()).expect(400);
    await http().post(`/api/ops/tenants/${shop.id}/activate`).set(auth()).send({ days: 30 }).expect(201);
    await http().post(`/api/ops/tenants/${shop.id}/suspend`).set(auth()).expect(201);
    await http().post('/api/auth/login').send({ email: shop.ownerEmail, password: 'Password1' }).expect(403);

    await http().post(`/api/ops/tenants/${shop.id}/activate`).set(auth()).send({ days: 30 }).expect(201);
    await app.get(DataSource).query(`UPDATE tenants SET activeUntil = '2000-01-01 00:00:00' WHERE id = ?`, [shop.id]);
    await http().post('/api/auth/login').send({ email: shop.ownerEmail, password: 'Password1' }).expect(403);

    await http().post(`/api/ops/tenants/${shop.id}/activate`).set(auth()).send({ days: 30 }).expect(201);
    await http().post(`/api/ops/tenants/${shop.id}/reset-password`).set(auth()).send({ password: 'MatKhauMoi1' }).expect(201);
    await http().post('/api/auth/login').send({ email: shop.ownerEmail, password: 'Password1' }).expect(401);
    const token = (await http().post('/api/auth/login').send({ email: shop.ownerEmail, password: 'MatKhauMoi1' }).expect(201)).body.accessToken;
    const products = (await http().get('/api/products').set('Authorization', `Bearer ${token}`).expect(200)).body;
    expect(products).toEqual([]);
  });
});
