import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: 'retail/pos', component: () => import('./BarcodePosView.vue'), meta: { feature: 'retail.barcode' } },
  { path: 'retail/returns', component: () => import('./ReturnsView.vue'), meta: { feature: 'retail.return' } },
];
export default routes;
