import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup-app';
import { openShop } from './open-shop';

describe('Giai đoạn 1: tenant, feature, cô lập dữ liệu', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  let tokenA: string; // nhà hàng
  let tokenB: string; // cửa hàng bán lẻ

  const register = (tenantName: string, preset: string, email: string) =>
    http().post('/api/auth/register-tenant').send({ tenantName, preset, fullName: 'Chủ', email, password: 'Password1' });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    tokenA = (await openShop(http(), { tenantName: 'Nhà hàng A', preset: 'fnb_restaurant', email: 'a@x.vn' })).body.accessToken;
    tokenB = (await openShop(http(), { tenantName: 'Shop B', preset: 'retail_shop', email: 'b@x.vn' })).body.accessToken;
  });
  afterAll(() => app.close());

  it('401 khi chưa đăng nhập', () => http().get('/api/me/bootstrap').expect(401));

  it('danh sách preset công khai', async () => {
    const r = await http().get('/api/platform/presets').expect(200);
    expect(r.body.map((p: any) => p.key)).toEqual(
      expect.arrayContaining(['fnb_cafe', 'fnb_restaurant', 'retail_shop']),
    );
  });

  it('mỗi tenant nhận menu riêng theo gói', async () => {
    const a = (await http().get('/api/me/bootstrap').set('Authorization', `Bearer ${tokenA}`).expect(200)).body;
    const b = (await http().get('/api/me/bootstrap').set('Authorization', `Bearer ${tokenB}`).expect(200)).body;
    const routes = (x: any) => x.menu.map((m: any) => m.route);
    expect(routes(a)).toContain('/fnb/tables');
    expect(routes(a)).not.toContain('/retail/pos');
    expect(routes(b)).toContain('/retail/pos');
    expect(routes(b)).not.toContain('/fnb/tables');
    expect(a.theme.primary).toBe('red');
    expect(b.theme.primary).toBe('indigo');
  });

  it('FeatureGuard: tenant có feature thì vào được, không có thì 403', async () => {
    await http().get('/api/fnb/tables').set('Authorization', `Bearer ${tokenA}`).expect(200);
    await http().get('/api/fnb/tables').set('Authorization', `Bearer ${tokenB}`).expect(403);
    await http().get('/api/retail/returns').set('Authorization', `Bearer ${tokenA}`).expect(403);
  });

  it('cô lập dữ liệu: mỗi tenant chỉ thấy người dùng của mình', async () => {
    await http().post('/api/users').set('Authorization', `Bearer ${tokenA}`)
      .send({ fullName: 'Thu ngân A', email: 'nv-a@x.vn', password: 'Password1', role: 'staff' }).expect(201);
    const a = (await http().get('/api/users').set('Authorization', `Bearer ${tokenA}`).expect(200)).body;
    const b = (await http().get('/api/users').set('Authorization', `Bearer ${tokenB}`).expect(200)).body;
    expect(a.map((u: any) => u.email).sort()).toEqual(['a@x.vn', 'nv-a@x.vn']);
    expect(b.map((u: any) => u.email)).toEqual(['b@x.vn']);
    expect(JSON.stringify([a, b])).not.toContain('passwordHash');
  });

  it('nhân viên không được xem hay tạo người dùng', async () => {
    const t = (await http().post('/api/auth/login').send({ email: 'nv-a@x.vn', password: 'Password1' }).expect(201)).body.accessToken;
    await http().get('/api/users').set('Authorization', `Bearer ${t}`).expect(403);
    await http().post('/api/users').set('Authorization', `Bearer ${t}`)
      .send({ fullName: 'Nhân viên mới', email: 'x@x.vn', password: 'Password1', role: 'staff' }).expect(403);
  });

  it('email trùng → 409, sai mật khẩu → 401, preset lạ → 400', async () => {
    await register('Trùng', 'fnb_cafe', 'a@x.vn').expect(409);
    await http().post('/api/auth/login').send({ email: 'a@x.vn', password: 'sai-mat-khau' }).expect(401);
    await register('Lạ', 'khong-ton-tai', 'c@x.vn').expect(400);
  });
});
