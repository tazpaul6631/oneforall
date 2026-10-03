import Aura from '@primeuix/themes/aura';
import { createPinia } from 'pinia';
import 'primeicons/primeicons.css';
import PrimeVue from 'primevue/config';
import ToastService from 'primevue/toastservice';
import { createApp } from 'vue';
import { setUnauthorizedHandler, tokenStorage } from '@/api/http';
import { activateSession } from '@/platform/bootstrap';
import { router } from '@/router';
import { useSession } from '@/stores/session';
import App from './App.vue';
import './style.css';

async function main() {
  const app = createApp(App);
  const pinia = createPinia();
  app.use(pinia);
  app.use(PrimeVue, { theme: { preset: Aura, options: { darkModeSelector: 'none' } } });
  app.use(ToastService);

  const session = useSession();
  setUnauthorizedHandler(() => session.logout());

  // Nạp bootstrap và route vertical TRƯỚC khi router chạy lần điều hướng đầu tiên.
  if (tokenStorage.get()) {
    try {
      await session.loadBootstrap();
      await activateSession(router);
    } catch {
      try {
        await session.loadOperator();
      } catch {
        tokenStorage.clear();
      }
    }
  }

  app.use(router);
  app.mount('#app');
}
main();