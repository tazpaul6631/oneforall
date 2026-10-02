import { VerticalManifest } from '../platform/manifest/vertical-manifest';

export const coreManifest: VerticalManifest = {
  key: 'core',
  alwaysOn: ['core.dashboard', 'core.product', 'core.order', 'core.customer', 'core.inventory', 'core.staff', 'core.settings'],
  features: ['core.dashboard', 'core.product', 'core.order', 'core.customer', 'core.inventory', 'core.staff', 'core.settings'],
  menu: [
    { label: 'Tổng quan', route: '/', icon: 'pi pi-home', feature: 'core.dashboard' },
    { label: 'Bán hàng', route: '/pos', icon: 'pi pi-shopping-cart', feature: 'core.order' },
    { label: 'Đơn hàng', route: '/orders', icon: 'pi pi-receipt', feature: 'core.order' },
    { label: 'Sản phẩm', route: '/products', icon: 'pi pi-box', feature: 'core.product' },
    { label: 'Tồn kho', route: '/inventory', icon: 'pi pi-inbox', feature: 'core.inventory' },
    { label: 'Khách hàng', route: '/customers', icon: 'pi pi-users', feature: 'core.customer' },
    { label: 'Nhân viên', route: '/staff', icon: 'pi pi-id-card', feature: 'core.staff' },
    { label: 'Cài đặt', route: '/settings', icon: 'pi pi-cog', feature: 'core.settings' },
  ],
};
