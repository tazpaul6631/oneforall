import { VerticalManifest } from '../../platform/manifest/vertical-manifest';

export const retailManifest: VerticalManifest = {
  key: 'retail',
  features: ['retail.barcode', 'retail.return'],
  menu: [
    { label: 'Bán hàng (mã vạch)', route: '/retail/pos', icon: 'pi pi-qrcode', feature: 'retail.barcode' },
    { label: 'Đổi trả', route: '/retail/returns', icon: 'pi pi-replay', feature: 'retail.return' },
  ],
  presets: {
    retail_shop: {
      label: 'Cửa hàng bán lẻ',
      description: 'Quét mã vạch, size/màu, đổi trả hàng.',
      color: 'indigo',
      features: ['retail.barcode', 'retail.return'],
    },
  },
};
