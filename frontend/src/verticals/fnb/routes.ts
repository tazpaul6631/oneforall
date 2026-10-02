import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: 'fnb/tables', component: () => import('./TablesView.vue'), meta: { feature: 'fnb.table_map' } },
  { path: 'fnb/kds', component: () => import('./KdsView.vue'), meta: { feature: 'fnb.kds' } },
  { path: 'fnb/recipes', component: () => import('./RecipesView.vue'), meta: { feature: 'fnb.recipe' } },
];
export default routes;
