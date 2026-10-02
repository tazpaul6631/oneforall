import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
export const FEATURE_KEY = 'requiredFeature';
export const OPS_ONLY = 'opsOnly';

/** Route không cần đăng nhập. Mặc định MỌI route đều cần JWT. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Route chỉ dùng được khi tenant đã bật feature này. */
export const RequireFeature = (feature: string) => SetMetadata(FEATURE_KEY, feature);

/** Route của người vận hành, không gắn với một cửa hàng. */
export const OpsOnly = () => SetMetadata(OPS_ONLY, true);

export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().user;
});
