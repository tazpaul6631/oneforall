import { INestApplication } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup-app';
import { openShop } from './open-shop';

describe('Giai đoạn 2: sản phẩm → đơn hàng → thanh toán', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const as = (t: string) => ({ Authorization: `Bearer ${t}` });
  const events: { name: string; orderId: string }[] = [];
  let owner: string, staff: string, other: string;
  let productId: string, variantL: string, categoryId: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    const bus = app.get(EventEmitter2);
    for (const n of ['order.created', 'order.paid', 'order.voided']) bus.on(n, (e) => events.push({ name: n, orderId: e.orderId }));

    owner = (await openShop(http(), { tenantName: 'Quán 1', preset: 'fnb_cafe', email: 'o1@x.vn' })).body.accessToken;
    other = (await openShop(http(), { tenantName: 'Quán 2', preset: 'fnb_cafe', email: 'o2@x.vn' })).body.accessToken;
    await http().post('/api/users').set(as(owner)).send({ fullName: 'Thu ngân', email: 's1@x.vn', password: 'Password1', role: 'staff' });
    staff = (await http().post('/api/auth/login').send({ email: 's1@x.vn', password: 'Password1' })).body.accessToken;
  });
  afterAll(() => app.close());

  it('quản lý danh mục và sản phẩm (nhân viên chỉ được xem)', async () => {
    categoryId = (await http().post('/api/categories').set(as(owner)).send({ name: 'Cà phê' }).expect(201)).body.id;
    const p = (await http().post('/api/products').set(as(owner)).send({
      name: 'Cà phê sữa', priceVnd: 29000, categoryId,
      variants: [{ name: 'M', priceVnd: 29000 }, { name: 'L', priceVnd: 35000 }],
    }).expect(201)).body;
    productId = p.id;
    variantL = p.variants.find((v: any) => v.name === 'L').id;
    await http().post('/api/products').set(as(staff)).send({ name: 'X', priceVnd: 1 }).expect(403);
    await http().post('/api/products').set(as(owner)).send({ name: 'Giá lẻ', priceVnd: 10.5 }).expect(400);
    const list = (await http().get('/api/products').set(as(staff)).expect(200)).body;
    expect(list).toHaveLength(1);
  });

  it('tenant khác không thấy sản phẩm, không dùng được sản phẩm của tenant này', async () => {
    expect((await http().get('/api/products').set(as(other)).expect(200)).body).toEqual([]);
    await http().post('/api/orders').set(as(other)).send({ lines: [{ productId, qty: 1 }] }).expect(400);
  });

  it('preview: giá lấy từ DB, thuế theo cấu hình tenant', async () => {
    await http().patch('/api/platform/settings').set(as(staff)).send({ taxRatePercent: 8 }).expect(403);
    await http().patch('/api/platform/settings').set(as(owner)).send({ taxRatePercent: 8, taxMode: 'exclusive' }).expect(200);
    const r = (await http().post('/api/orders/preview').set(as(staff))
      .send({ lines: [{ productId, variantId: variantL, qty: 2, unitPriceVnd: 1 }], discount: { type: 'percent', value: 10 } }).expect(201)).body;
    // 2 x 35.000 = 70.000; giảm 10% = 7.000; thuế 8% của 63.000 = 5.040
    expect(r).toMatchObject({ subtotalVnd: 70000, discountVnd: 7000, taxVnd: 5040, totalVnd: 68040 });
  });

  let orderId: string;
  it('tạo đơn: server tự tính tiền, bỏ qua giá client gửi', async () => {
    const o = (await http().post('/api/orders').set(as(staff))
      .send({ lines: [{ productId, variantId: variantL, qty: 2, unitPriceVnd: 1 }], discount: { type: 'percent', value: 10 } }).expect(201)).body;
    orderId = o.id;
    expect(o).toMatchObject({ seq: 1, status: 'open', totalVnd: 68040 });
    expect(o.lines[0]).toMatchObject({ name: 'Cà phê sữa (L)', unitPriceVnd: 35000, qty: 2, lineTotalVnd: 70000 });
    expect(events.filter((e) => e.name === 'order.created')).toHaveLength(1);
    const o2 = (await http().post('/api/orders').set(as(staff)).send({ lines: [{ productId, qty: 1 }] }).expect(201)).body;
    expect(o2.seq).toBe(2);
    await http().post(`/api/orders/${o2.id}/void`).set(as(staff)).expect(403);
    await http().post(`/api/orders/${o2.id}/void`).set(as(owner)).expect(201);
  });

  it('thanh toán: thiếu tiền bị từ chối, đủ tiền có tiền thừa, gửi lại cùng key không thu thêm', async () => {
    const pay = (key: string, payments: any[]) => http().post(`/api/orders/${orderId}/pay`).set(as(staff)).send({ idempotencyKey: key, payments });

    await pay('key-aaaaaaaa', [{ method: 'cash', amountVnd: 60000 }]).expect(400);
    const paid = (await pay('key-bbbbbbbb', [{ method: 'transfer', amountVnd: 18040 }, { method: 'cash', amountVnd: 60000 }]).expect(201)).body;
    expect(paid).toMatchObject({ status: 'paid', changeVnd: 10000 });
    expect(paid.payments).toHaveLength(2);

    const replay = (await pay('key-bbbbbbbb', [{ method: 'transfer', amountVnd: 18040 }, { method: 'cash', amountVnd: 60000 }]).expect(201)).body;
    expect(replay.payments).toHaveLength(2);
    await pay('key-cccccccc', [{ method: 'cash', amountVnd: 70000 }]).expect(409);

    expect(events.filter((e) => e.name === 'order.paid')).toHaveLength(1);
    await http().post(`/api/orders/${orderId}/void`).set(as(owner)).expect(409);
  });

  it('cô lập đơn hàng giữa các tenant, và danh sách lọc theo trạng thái', async () => {
    await http().get(`/api/orders/${orderId}`).set(as(other)).expect(404);
    await http().post(`/api/orders/${orderId}/pay`).set(as(other)).send({ idempotencyKey: 'key-zzzzzzzz', payments: [] }).expect(404);
    expect((await http().get('/api/orders').set(as(other)).expect(200)).body).toEqual([]);
    const paid = (await http().get('/api/orders?status=paid').set(as(owner)).expect(200)).body;
    expect(paid.map((o: any) => o.seq)).toEqual([1]);
    expect((await http().get('/api/orders').set(as(owner)).expect(200)).body.map((o: any) => o.seq)).toEqual([2, 1]);
  });
});
