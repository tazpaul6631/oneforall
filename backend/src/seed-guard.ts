/** Tài khoản demo chỉ dùng lúc phát triển. Máy khách hàng không được seed. */
export function assertSeedAllowed(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV === 'production' && env.SEED_DEMO !== '1') {
    throw new Error('Không seed tài khoản demo trên production.');
  }
}
