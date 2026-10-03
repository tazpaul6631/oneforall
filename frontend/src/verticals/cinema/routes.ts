import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  { path: 'cinema/box', component: () => import('./BoxOfficeView.vue'), meta: { feature: 'cinema.seat_map' } },
  { path: 'cinema/showtimes', component: () => import('./ShowtimesView.vue'), meta: { feature: 'cinema.showtime' } },
];
export default routes;