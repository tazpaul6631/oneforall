import { createRouter, createWebHistory } from 'vue-router';
import { useSession } from '@/stores/session';

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
    { path: '/ops', name: 'ops', component: () => import('@/views/OpsView.vue'), meta: { operator: true } },
    {
      path: '/',
      name: 'shell',
      component: () => import('@/layout/AppShell.vue'),
      children: [
        { path: '', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { feature: 'core.dashboard' } },
        { path: 'pos', component: () => import('@/views/PosView.vue'), meta: { feature: 'core.order' } },
        { path: 'orders', component: () => import('@/views/OrdersView.vue'), meta: { feature: 'core.order' } },
        { path: 'products', component: () => import('@/views/ProductsView.vue'), meta: { feature: 'core.product' } },
        { path: 'inventory', component: () => import('@/views/InventoryView.vue'), meta: { feature: 'core.inventory' } },
        { path: 'customers', component: () => import('@/views/CustomersView.vue'), meta: { feature: 'core.customer' } },
        { path: 'staff', component: () => import('@/views/StaffView.vue'), meta: { feature: 'core.staff' } },
        { path: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { feature: 'core.settings' } },
        { path: 'forbidden', name: 'forbidden', component: () => import('@/views/ForbiddenView.vue') },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
});

router.beforeEach((to) => {
  const session = useSession();
  if (to.meta.public) {
    if (!session.isAuthed) return true;
    return session.operator ? { name: 'ops' } : '/';
  }
  if (!session.isAuthed) return { name: 'login' };
  if (session.operator) return to.meta.operator ? true : { name: 'ops' };
  if (to.meta.operator) return '/';
  if (to.meta.feature && !session.has(to.meta.feature)) return { name: 'forbidden' };
  return true;
});
