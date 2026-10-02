export function jwtSecret(): string {
  const s = process.env.JWT_SECRET;
  if (process.env.NODE_ENV === 'production') {
    if (!s || s === 'doi-chuoi-nay-truoc-khi-len-production' || s.length < 32) {
      throw new Error('JWT_SECRET production phải là chuỗi ngẫu nhiên dài');
    }
  }
  return s ?? 'dev-secret-change-me';
}
