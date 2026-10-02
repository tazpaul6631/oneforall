<script setup lang="ts">
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Password from 'primevue/password';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api/http';
import { activateSession } from '@/platform/bootstrap';
import { useSession } from '@/stores/session';

interface Preset { key: string; label: string; description: string }

const router = useRouter();
const session = useSession();
const mode = ref<'login' | 'register'>('login');
const presets = ref<Preset[]>([]);
const loading = ref(false);
const error = ref('');
const notice = ref('');
const f = reactive({ email: '', password: '', tenantName: '', fullName: '', preset: '' });
const isDev = import.meta.env.DEV;

onMounted(async () => {
  try {
    presets.value = await api<Preset[]>('/platform/presets');
    f.preset = presets.value[0]?.key ?? '';
  } catch {
    error.value = 'Không kết nối được máy chủ. Hãy kiểm tra backend đang chạy ở cổng 3000.';
  }
});

const canSubmit = computed(() =>
  mode.value === 'login'
    ? !!f.email && !!f.password
    : !!f.email && f.password.length >= 8 && !!f.tenantName && !!f.fullName && !!f.preset,
);

async function submit() {
  if (!canSubmit.value || loading.value) return;
  loading.value = true;
  error.value = '';
  try {
    if (mode.value === 'login') {
      await session.login(f.email, f.password);
      if (session.operator) {
        router.replace('/ops');
        return;
      }
      await activateSession(router);
      router.replace('/');
    } else {
      const created = await session.registerTenant({ ...f });
      if (created.status === 'pending') {
        notice.value = 'Cửa hàng đã được tạo. Bạn đăng nhập được sau khi tài khoản được kích hoạt.';
        mode.value = 'login';
        return;
      }
    }
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

function fillDemo(email: string) {
  mode.value = 'login';
  f.email = email;
  f.password = 'Demo@12345';
}
</script>

<template>
  <div class="page">
    <section class="intro">
      <h1>OneStore</h1>
      <p>Một nền tảng cho quán cà phê, nhà hàng, cửa hàng bán lẻ và rạp chiếu phim. Mỗi tài khoản thấy đúng màn hình và quy trình của mô hình mình dùng.</p>
    </section>

    <section class="card">
      <div class="tabs" role="tablist">
        <button role="tab" :aria-selected="mode === 'login'" :class="{ on: mode === 'login' }" @click="mode = 'login'; error = ''">Đăng nhập</button>
        <button role="tab" :aria-selected="mode === 'register'" :class="{ on: mode === 'register' }" @click="mode = 'register'; error = ''">Tạo cửa hàng</button>
      </div>

      <form class="form" @submit.prevent="submit">
        <template v-if="mode === 'register'">
          <label>Tên cửa hàng<InputText v-model="f.tenantName" fluid autocomplete="organization" /></label>
          <fieldset class="presets">
            <legend>Mô hình kinh doanh</legend>
            <label v-for="p in presets" :key="p.key" class="preset" :class="{ on: f.preset === p.key }">
              <input type="radio" v-model="f.preset" :value="p.key" />
              <strong>{{ p.label }}</strong>
              <span>{{ p.description }}</span>
            </label>
          </fieldset>
          <label>Họ tên chủ cửa hàng<InputText v-model="f.fullName" fluid autocomplete="name" /></label>
        </template>

        <label>Email<InputText v-model="f.email" type="email" fluid autocomplete="email" /></label>
        <label>
          Mật khẩu
          <Password v-model="f.password" :feedback="false" toggle-mask fluid :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" />
          <small v-if="mode === 'register'">Ít nhất 8 ký tự</small>
        </label>

        <Message v-if="notice" severity="success" size="small">{{ notice }}</Message>
        <Message v-if="error" severity="error" size="small">{{ error }}</Message>
        <Button type="submit" :label="mode === 'login' ? 'Đăng nhập' : 'Tạo cửa hàng'" :loading="loading" :disabled="!canSubmit" fluid />
      </form>

      <div v-if="isDev && mode === 'login'" class="demo">
        <span>Tài khoản mẫu (sau khi chạy <code>npm run seed</code>):</span>
        <div>
          <Button size="small" severity="secondary" outlined label="Quán cà phê" @click="fillDemo('cafe@demo.vn')" />
          <Button size="small" severity="secondary" outlined label="Nhà hàng" @click="fillDemo('nhahang@demo.vn')" />
          <Button size="small" severity="secondary" outlined label="Cửa hàng" @click="fillDemo('shop@demo.vn')" />
          <Button size="small" severity="secondary" outlined label="Rạp chiếu phim" @click="fillDemo('rap@demo.vn')" />
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page { min-height: 100vh; display: grid; grid-template-columns: minmax(280px, 1fr) minmax(360px, 480px); align-items: center; gap: 4rem; padding: 2rem 6vw; box-sizing: border-box; }
.intro { max-width: 30rem; justify-self: end; }
.intro h1 { font-size: 2.75rem; margin-bottom: 1rem; }
.intro p { font-size: 1.1rem; line-height: 1.65; color: var(--p-text-muted-color); margin: 0; }
.card { background: var(--p-surface-0); border: 1px solid var(--p-content-border-color); border-radius: 12px; padding: 1.5rem; }
.tabs { display: flex; gap: 1.5rem; border-bottom: 1px solid var(--p-content-border-color); margin-bottom: 1.25rem; }
.tabs button { background: none; border: 0; padding: 0.5rem 0 0.75rem; font: inherit; font-weight: 500; color: var(--p-text-muted-color); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; }
.tabs button.on { color: var(--p-text-color); border-color: var(--p-primary-color); }
.form { display: flex; flex-direction: column; gap: 1rem; }
.form label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.9rem; font-weight: 500; }
.form small { font-weight: 400; color: var(--p-text-muted-color); }
.presets { border: 0; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.presets legend { font-size: 0.9rem; font-weight: 500; margin-bottom: 0.35rem; padding: 0; }
.preset { position: relative; border: 1px solid var(--p-content-border-color); border-radius: 8px; padding: 0.65rem 0.85rem; cursor: pointer; gap: 0.1rem !important; }
.preset span { font-weight: 400; font-size: 0.82rem; color: var(--p-text-muted-color); }
.preset input { position: absolute; opacity: 0; }
.preset.on { border-color: var(--p-primary-color); background: var(--p-primary-50); }
.preset:has(input:focus-visible) { outline: 2px solid var(--p-primary-color); outline-offset: 2px; }
.demo { margin-top: 1.25rem; padding-top: 1rem; border-top: 1px dashed var(--p-content-border-color); font-size: 0.82rem; color: var(--p-text-muted-color); display: flex; flex-direction: column; gap: 0.5rem; }
.demo div { display: flex; gap: 0.5rem; flex-wrap: wrap; }
@media (max-width: 860px) {
  .page { grid-template-columns: 1fr; gap: 1.5rem; padding: 1.5rem; }
  .intro { justify-self: start; }
  .intro h1 { font-size: 2rem; }
}
</style>
