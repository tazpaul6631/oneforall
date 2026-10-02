import request from 'supertest';

type Http = ReturnType<typeof request>;

/** Tạo cửa hàng đang chờ, rồi tài khoản vận hành kích hoạt và trả về phiên đăng nhập của chủ quán. */
export async function openShop(
  http: Http,
  input: { tenantName: string; preset: string; email: string; fullName?: string; password?: string },
) {
  const password = input.password ?? 'Password1';
  const created = await http.post('/api/auth/register-tenant').send({
    tenantName: input.tenantName,
    preset: input.preset,
    fullName: input.fullName ?? 'Chủ',
    email: input.email,
    password,
  });
  if (created.status !== 201) return created;
  const ops = await http.post('/api/auth/login').send({
    email: process.env.OPERATOR_EMAIL,
    password: process.env.OPERATOR_PASSWORD,
  });
  if (ops.status !== 201) return ops;
  const auth = { Authorization: `Bearer ${ops.body.accessToken}` };
  const list = await http.get('/api/ops/tenants').set(auth);
  const email = input.email.trim().toLowerCase();
  const row = (list.body as { id: string; ownerEmail: string }[]).find((t) => t.ownerEmail === email);
  if (!row) return list;
  const granted = await http.post(`/api/ops/tenants/${row.id}/activate`).set(auth).send({ days: 30 });
  if (granted.status !== 201) return granted;
  return http.post('/api/auth/login').send({ email: input.email, password });
}
