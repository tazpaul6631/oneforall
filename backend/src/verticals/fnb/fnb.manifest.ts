import { VerticalManifest } from '../../platform/manifest/vertical-manifest';

export const fnbManifest: VerticalManifest = {
  key: 'fnb',
  features: ['fnb.table_map', 'fnb.kds', 'fnb.recipe', 'fnb.split_bill'],
  menu: [
    { label: 'Sơ đồ bàn', route: '/fnb/tables', icon: 'pi pi-th-large', feature: 'fnb.table_map' },
    { label: 'Màn hình bếp', route: '/fnb/kds', icon: 'pi pi-desktop', feature: 'fnb.kds' },
    { label: 'Công thức', route: '/fnb/recipes', icon: 'pi pi-book', feature: 'fnb.recipe' },
  ],
  presets: {
    fnb_cafe: {
      label: 'Quán cà phê',
      description: 'Bán mang đi, gọi tại quầy, có công thức pha chế.',
      color: 'orange',
      features: ['fnb.recipe'],
    },
    fnb_restaurant: {
      label: 'Nhà hàng',
      description: 'Sơ đồ bàn, gửi bếp, tách gộp bill, công thức.',
      color: 'red',
      features: ['fnb.table_map', 'fnb.kds', 'fnb.recipe', 'fnb.split_bill'],
    },
  },
};
