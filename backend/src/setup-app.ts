import { INestApplication, ValidationPipe } from '@nestjs/common';

/** WebView của APK gọi API từ các origin này, không phải từ domain. */
const CAPACITOR_ORIGINS = ['https://localhost', 'capacitor://localhost'];

/** Production không khai báo CORS_ORIGIN thì chỉ cùng domain (qua Nginx) được gọi API. */
export function corsOrigin(env: NodeJS.ProcessEnv = process.env): boolean | string[] {
  const raw = env.CORS_ORIGIN?.trim();
  if (raw) {
    const listed = raw.split(',').map((s) => s.trim()).filter(Boolean);
    return [...listed, ...CAPACITOR_ORIGINS.filter((o) => !listed.includes(o))];
  }
  return env.NODE_ENV === 'production' ? false : true;
}

export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.enableCors({ origin: corsOrigin() });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
}
