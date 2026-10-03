<script setup lang="ts">
import Button from 'primevue/button';
import FloatLabel from 'primevue/floatlabel';
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
  <div
    class="grid min-h-dvh items-center gap-6 p-4 md:p-8 lg:grid-cols-[minmax(280px,1fr)_minmax(360px,480px)] lg:gap-16 lg:px-[6vw]">
    <section class="max-w-lg lg:justify-self-end">
      <h1 class="mb-3 text-3xl md:mb-4 md:text-5xl">OneStore</h1>
      <p class="m-0 text-base leading-relaxed text-muted md:text-lg">Một nền tảng cho quán cà phê, nhà hàng, cửa hàng
        bán lẻ và rạp chiếu phim. Mỗi tài khoản thấy đúng màn hình và quy trình của mô hình mình dùng.</p>
    </section>

    <section class="panel p-4 sm:p-6">
      <div class="mb-5 flex gap-6 border-b border-line" role="tablist">
        <button type="button" role="tab" raised
          class="-mb-px cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-0 pt-2 pb-3 font-[inherit] font-medium text-muted"
          :aria-selected="mode === 'login'" :class="mode === 'login' && 'border-primary text-ink'"
          @click="mode = 'login'; error = ''">Đăng nhập</button>
        <button type="button" role="tab" raised
          class="-mb-px cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-0 pt-2 pb-3 font-[inherit] font-medium text-muted"
          :aria-selected="mode === 'register'" :class="mode === 'register' && 'border-primary text-ink'"
          @click="mode = 'register'; error = ''">Tạo cửa hàng</button>
      </div>

      <form class="flex flex-col gap-4" @submit.prevent="submit">
        <template v-if="mode === 'register'">
          <FloatLabel variant="on">
            <InputText id="tenant-name" v-model="f.tenantName" fluid autocomplete="organization" />
            <label for="tenant-name">Tên cửa hàng</label>
          </FloatLabel>
          <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
            <legend class="mb-1 p-0 text-sm font-medium">Mô hình kinh doanh</legend>
            <label v-for="p in presets" :key="p.key"
              class="relative flex cursor-pointer flex-col gap-0.5 rounded-lg border border-line px-3 py-2.5"
              :class="f.preset === p.key && 'border-primary bg-primary-soft'">
              <input class="absolute opacity-0" type="radio" v-model="f.preset" :value="p.key" />
              <strong>{{ p.label }}</strong>
              <span class="text-[0.82rem] font-normal text-muted">{{ p.description }}</span>
            </label>
          </fieldset>
          <FloatLabel variant="on">
            <InputText id="owner-name" v-model="f.fullName" fluid autocomplete="name" />
            <label for="owner-name">Họ tên chủ cửa hàng</label>
          </FloatLabel>
        </template>

        <FloatLabel variant="on">
          <InputText id="login-email" v-model="f.email" type="email" fluid autocomplete="email" />
          <label for="login-email">Email</label>
        </FloatLabel>
        <label class="field">
          Mật khẩu
          <Password v-model="f.password" :feedback="false" toggle-mask fluid
            :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" />
          <small v-if="mode === 'register'" class="font-normal text-muted">Ít nhất 8 ký tự</small>
        </label>

        <Message v-if="notice" severity="success" size="small">{{ notice }}</Message>
        <Message v-if="error" severity="error" size="small">{{ error }}</Message>
        <Button type="submit" raised :label="mode === 'login' ? 'Đăng nhập' : 'Tạo cửa hàng'" :loading="loading"
          :disabled="!canSubmit" fluid />
      </form>

      <div v-if="isDev && mode === 'login'"
        class="mt-5 flex flex-col gap-2 border-t border-dashed border-line pt-4 text-[0.82rem] text-muted">
        <span>Tài khoản mẫu (sau khi chạy <code>npm run seed</code>):</span>
        <div class="flex flex-wrap gap-2">
          <Button size="small" severity="secondary" outlined raised label="Quán cà phê"
            @click="fillDemo('cafe@demo.vn')" />
          <Button size="small" severity="secondary" outlined raised label="Nhà hàng"
            @click="fillDemo('nhahang@demo.vn')" />
          <Button size="small" severity="secondary" outlined raised label="Cửa hàng"
            @click="fillDemo('shop@demo.vn')" />
          <Button size="small" severity="secondary" outlined raised label="Rạp chiếu phim"
            @click="fillDemo('rap@demo.vn')" />
        </div>
      </div>
    </section>
  </div>
</template>