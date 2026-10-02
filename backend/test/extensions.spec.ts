import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup-app';
import { openShop } from './open-shop';

describe('Bán hàng, F&B, bán lẻ, khách, hoàn tiền và tồn kho', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const as = (t: string) => ({ Authorization: `Bearer ${t}` });
  let owner: string;
  let restaurant: string;
  let shop: string;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    configureApp(app);
    await app.init();
    owner = (await openShop(http(), { tenantName: 'ext-cafe@x.vn', preset: 'fnb_cafe', email: 'ext-cafe@x.vn' })).body.accessToken;
    restaurant = (await openShop(http(), { tenantName: 'ext-rest@x.vn', preset: 'fnb_restaurant', email: 'ext-rest@x.vn' })).body.accessToken;
    shop = (await openShop(http(), { tenantName: 'ext-shop@x.vn', preset: 'retail_shop', email: 'ext-shop@x.vn' })).body.accessToken;
  });
  afterAll(() => app.close());

  it('sửa danh mục, nhập SKU, khóa nhân viên và hiện số liệu', async () => {
    const cat = (await http().post('/api/categories').set(as(owner)).send({ name: 'Đồ uống' }).expect(201)).body;
    const renamed = (await http().patch(`/api/categories/${cat.id}`).set(as(owner)).send({ name: 'Đồ uống lạnh' }).expect(200)).body;
    expect(renamed.name).toBe('Đồ uống lạnh');

    const product = (await http().post('/api/products').set(as(owner)).send({
      name: 'Trà đào', priceVnd: 39000, categoryId: cat.id, sku: 'TD',
      variants: [{ name: 'L', priceVnd: 45000, sku: 'TD-L' }],
    }).expect(201)).body;
    expect(product.sku).toBe('TD');
    expect(product.variants[0].sku).toBe('TD-L');
    await http().post('/api/products').set(as(owner)).send({ name: 'Trùng mã', priceVnd: 1, sku: 'TD' }).expect(409);

    await http().delete(`/api/categories/${cat.id}`).set(as(owner)).expect(200);
    const after = (await http().get('/api/products?includeInactive=true').set(as(owner))).body;
    expect(after.find((p: any) => p.id === product.id).categoryId).toBeNull();

    const staff = (await http().post('/api/users').set(as(owner)).send({
      fullName: 'Lan', email: 'lan-ext@x.vn', password: 'Password1', role: 'staff',
    }).expect(201)).body;
    const promoted = (await http().patch(`/api/users/${staff.id}`).set(as(owner)).send({ role: 'manager' }).expect(200)).body;
    expect(promoted.role).toBe('manager');
    await http().patch(`/api/users/${staff.id}`).set(as(owner)).send({ active: false }).expect(200);
    await http().post('/api/auth/login').send({ email: 'lan-ext@x.vn', password: 'Password1' }).expect(401);

    const summary = (await http().get('/api/orders/summary').set(as(owner)).expect(200)).body;
    expect(summary).toMatchObject({ todayRevenueVnd: 0, todayPaidCount: 0, openCount: 0, paidCount: 0 });
  });

  it('khách hàng gắn vào đơn', async () => {
    const customer = (await http().post('/api/customers').set(as(owner)).send({ name: 'An', phone: '0901' }).expect(201)).body;
    const found = (await http().get('/api/customers?q=0901').set(as(owner)).expect(200)).body;
    expect(found.map((c: any) => c.id)).toContain(customer.id);
    const product = (await http().post('/api/products').set(as(owner)).send({ name: 'Nước', priceVnd: 10000 }).expect(201)).body;
    const order = (await http().post('/api/orders').set(as(owner)).send({
      lines: [{ productId: product.id, qty: 1 }], customerId: customer.id,
    }).expect(201)).body;
    expect(order.customer).toMatchObject({ id: customer.id, name: 'An' });
    const other = (await openShop(http(), { tenantName: 'Khác', preset: 'fnb_cafe', email: 'ext-other@x.vn' })).body.accessToken;
    await http().post('/api/orders').set(as(other)).send({ lines: [{ productId: product.id, qty: 1 }], customerId: customer.id }).expect(400);
  });

  it('bàn, bếp, công thức, tách và gộp bill', async () => {
    const area = (await http().post('/api/fnb/areas').set(as(restaurant)).send({ name: 'Sân' }).expect(201)).body;
    const table = (await http().post('/api/fnb/tables').set(as(restaurant)).send({ areaId: area.id, name: 'Bàn A', seats: 4 }).expect(201)).body;
    const a = (await http().post('/api/products').set(as(restaurant)).send({ name: 'Phở', priceVnd: 60000 }).expect(201)).body;
    const b = (await http().post('/api/products').set(as(restaurant)).send({ name: 'Trà đá', priceVnd: 5000 }).expect(201)).body;
    await http().post('/api/fnb/recipes').set(as(restaurant)).send({
      productId: a.id, items: [{ name: 'Bánh phở', qty: 200, unit: 'g' }],
    }).expect(201);
    expect((await http().get('/api/fnb/recipes').set(as(restaurant)).expect(200)).body.recipes).toHaveLength(1);

    const order = (await http().post('/api/orders').set(as(restaurant)).send({
      lines: [{ productId: a.id, qty: 1 }, { productId: b.id, qty: 2 }],
    }).expect(201)).body;
    await http().post(`/api/fnb/tables/${table.id}/assign`).set(as(restaurant)).send({ orderId: order.id }).expect(201);
    const floor = (await http().get('/api/fnb/tables').set(as(restaurant)).expect(200)).body;
    expect(floor.tables.find((t: any) => t.id === table.id)).toMatchObject({ status: 'occupied', orderId: order.id });

    const kds = (await http().get('/api/fnb/kds').set(as(restaurant)).expect(200)).body;
    const ticket = kds.tickets.find((t: any) => t.orderId === order.id);
    expect(ticket.lines.map((l: any) => l.name).sort()).toEqual(['Phở', 'Trà đá']);
    await http().patch(`/api/fnb/kds/${ticket.id}`).set(as(restaurant)).send({ status: 'cooking' }).expect(200);

    const tra = order.lines.find((l: any) => l.name === 'Trà đá');
    const split = (await http().post('/api/fnb/bills/split').set(as(restaurant)).send({
      orderId: order.id, lines: [{ lineId: tra.id, qty: 2 }],
    }).expect(201)).body;
    expect(split.source.totalVnd).toBe(60000);
    expect(split.created.totalVnd).toBe(10000);
    expect(split.created.lines).toHaveLength(1);

    const merged = (await http().post('/api/fnb/bills/merge').set(as(restaurant)).send({
      targetOrderId: split.source.id, sourceOrderId: split.created.id,
    }).expect(201)).body;
    expect(merged.totalVnd).toBe(70000);
    expect(merged.lines).toHaveLength(2);
    const source = (await http().get(`/api/orders/${split.created.id}`).set(as(restaurant))).body;
    expect(source.status).toBe('void');
  });

  it('quét mã, đổi trả, hoàn tiền, trừ kho và audit', async () => {
    const product = (await http().post('/api/products').set(as(shop)).send({
      name: 'Áo', priceVnd: 100000, sku: 'AO',
      variants: [{ name: 'M', priceVnd: 120000, sku: 'AO-M' }],
    }).expect(201)).body;
    const variant = product.variants[0];
    const found = (await http().get('/api/retail/lookup?code=AO-M').set(as(shop)).expect(200)).body;
    expect(found.variant.id).toBe(variant.id);
    await http().get('/api/retail/lookup?code=AO-M').set(as(owner)).expect(403);

    await http().post('/api/inventory/receive').set(as(shop)).send({ productId: product.id, variantId: variant.id, qty: 5 }).expect(201);
    const order = (await http().post('/api/orders').set(as(shop)).send({
      lines: [{ productId: product.id, variantId: variant.id, qty: 2 }],
    }).expect(201)).body;
    await http().post(`/api/orders/${order.id}/pay`).set(as(shop)).send({
      idempotencyKey: 'pay-shop-1', payments: [{ method: 'cash', amountVnd: 240000 }],
    }).expect(201);
    let stock = (await http().get('/api/inventory').set(as(shop)).expect(200)).body;
    expect(stock.items.find((i: any) => i.variantId === variant.id).qty).toBe(3);

    const slip = (await http().post('/api/retail/returns').set(as(shop)).send({
      orderId: order.id,
      idempotencyKey: 'ret-shop-1',
      lines: [{ orderLineId: order.lines[0].id, qty: 1 }],
    }).expect(201)).body;
    expect(slip.totalVnd).toBe(120000);
    expect(slip.lines).toHaveLength(1);
    const again = (await http().post('/api/retail/returns').set(as(shop)).send({
      orderId: order.id,
      idempotencyKey: 'ret-shop-1',
      lines: [{ orderLineId: order.lines[0].id, qty: 1 }],
    }).expect(201)).body;
    expect(again.id).toBe(slip.id);
    stock = (await http().get('/api/inventory').set(as(shop))).body;
    expect(stock.items.find((i: any) => i.variantId === variant.id).qty).toBe(4);

    const paid = (await http().get(`/api/orders/${order.id}`).set(as(shop))).body;
    expect(paid.status).toBe('paid');
    expect(paid.refundedVnd).toBe(120000);
    await http().post(`/api/orders/${order.id}/void`).set(as(shop)).expect(409);

    const summary = (await http().get('/api/orders/summary').set(as(shop))).body;
    expect(summary.todayPaidCount).toBe(1);
    expect(summary.todayRevenueVnd).toBe(120000);

    const audit = (await http().get('/api/audit').set(as(shop)).expect(200)).body;
    expect(audit.map((a: any) => a.action)).toEqual(expect.arrayContaining(['order.created', 'order.paid', 'order.refunded', 'stock.received']));
  });

  it('rạp: bán vé theo ghế, không bán trùng, hoàn thì trả ghế', async () => {
    await http().get('/api/cinema/catalog').set(as(owner)).expect(403);
    const cinema = (await openShop(http(), { tenantName: 'Rạp', preset: 'cinema_hall', email: 'ext-rap@x.vn' })).body.accessToken;

    const movie = (await http().post('/api/cinema/movies').set(as(cinema)).send({
      title: 'Mai', durationMin: 100, priceVnd: 90000, vipPriceVnd: 120000,
    }).expect(201)).body;
    const room = (await http().post('/api/cinema/rooms').set(as(cinema)).send({
      name: 'Phòng 1', rows: 2, cols: 2, vipRows: 1,
    }).expect(201)).body;
    expect(room.seats).toBe(4);
    const show = (await http().post('/api/cinema/showtimes').set(as(cinema)).send({
      movieId: movie.id, roomId: room.id, startsAt: new Date().toISOString(),
    }).expect(201)).body;

    const map = (await http().get(`/api/cinema/showtimes/${show.id}`).set(as(cinema)).expect(200)).body;
    const seats = map.rows.flatMap((r: any) => r.seats);
    const a1 = seats.find((s: any) => s.label === 'A1');
    const a2 = seats.find((s: any) => s.label === 'A2');
    const b1 = seats.find((s: any) => s.label === 'B1');
    expect(a1.priceVnd).toBe(90000);
    expect(b1.priceVnd).toBe(120000);

    const first = (await http().post('/api/cinema/checkout').set(as(cinema)).send({
      showtimeId: show.id, seatIds: [a2.id], idempotencyKey: 'cinema-a2',
    }).expect(201)).body;
    const replay = (await http().post('/api/cinema/checkout').set(as(cinema)).send({
      showtimeId: show.id, seatIds: [a2.id], idempotencyKey: 'cinema-a2',
    }).expect(201)).body;
    expect(replay.id).toBe(first.id);

    const sold = (await http().post('/api/cinema/checkout').set(as(cinema)).send({
      showtimeId: show.id, seatIds: [a1.id, b1.id], idempotencyKey: 'cinema-ab',
    }).expect(201)).body;
    expect(sold.totalVnd).toBe(210000);
    expect(sold.lines.map((l: any) => l.name).sort()).toEqual(['Mai · A1', 'Mai · B1']);
    await http().post('/api/cinema/checkout').set(as(cinema)).send({
      showtimeId: show.id, seatIds: [a1.id], idempotencyKey: 'cinema-again',
    }).expect(409);

    const a1Line = sold.lines.find((l: any) => l.name === 'Mai · A1');
    await http().post(`/api/orders/${sold.id}/refund`).set(as(cinema)).send({
      idempotencyKey: 'cinema-refund-a1', lines: [{ lineId: a1Line.id, qty: 1 }],
    }).expect(201);
    const again = (await http().post('/api/cinema/checkout').set(as(cinema)).send({
      showtimeId: show.id, seatIds: [a1.id], idempotencyKey: 'cinema-a1-resale',
    }).expect(201)).body;
    expect(again.lines[0].name).toBe('Mai · A1');
    expect(again.totalVnd).toBe(90000);
  });
});
