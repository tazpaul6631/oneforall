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
  <div class="flex min-h-dvh w-full flex-col">
    <div
      class="m-auto grid w-full min-w-0 max-w-md gap-5 pt-[max(1.25rem,var(--safe-top))] pr-[max(1rem,var(--safe-right))] pb-[max(1.25rem,var(--safe-bottom))] pl-[max(1rem,var(--safe-left))] md:max-w-lg md:gap-6 md:px-2 lg:max-w-5xl lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-center lg:gap-16 lg:px-10">
      <section class="min-w-0 lg:max-w-md lg:justify-self-end">
        <h1 class="text-[1.75rem] leading-tight md:text-4xl lg:text-5xl">OneStore</h1>
        <p class="m-0 mt-2 text-sm leading-relaxed text-muted md:mt-3 md:text-base">Một nền tảng cho quán cà phê, nhà
          hàng, cửa hàng bán lẻ và rạp chiếu phim. Mỗi tài khoản thấy đúng màn hình và quy trình của mô hình mình dùng.
        </p>
      </section>

      <section class="panel w-full min-w-0 p-4 shadow-sm sm:p-6">
        <div class="mb-4 grid grid-cols-2 border-b border-line" role="tablist">
          <button type="button" role="tab"
            class="-mb-px cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-2 pt-2 pb-3 text-center font-[inherit] text-sm font-medium text-muted sm:text-base"
            :aria-selected="mode === 'login'" :class="mode === 'login' && 'border-primary font-semibold text-ink'"
            @click="mode = 'login'; error = ''">Đăng nhập</button>
          <button type="button" role="tab"
            class="-mb-px cursor-pointer border-0 border-b-2 border-transparent bg-transparent px-2 pt-2 pb-3 text-center font-[inherit] text-sm font-medium text-muted sm:text-base"
            :aria-selected="mode === 'register'"
            :class="mode === 'register' && 'border-primary font-semibold text-ink'"
            @click="mode = 'register'; error = ''">Tạo cửa hàng</button>
        </div>

        <form class="flex flex-col gap-3" @submit.prevent="submit">
          <template v-if="mode === 'register'">
            <FloatLabel class="mt-0!" variant="on">
              <InputText id="tenant-name" v-model="f.tenantName" fluid autocomplete="organization" />
              <label for="tenant-name">Tên cửa hàng</label>
            </FloatLabel>
            <fieldset class="m-0 min-w-0 border-0 p-0">
              <legend class="mb-2 p-0 text-sm font-medium">Mô hình kinh doanh</legend>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <label v-for="p in presets" :key="p.key"
                  class="relative flex min-w-0 cursor-pointer flex-col gap-0.5 rounded-lg border border-line px-3 py-2"
                  :class="f.preset === p.key && 'border-primary bg-primary-soft'">
                  <input class="absolute opacity-0" type="radio" v-model="f.preset" :value="p.key" />
                  <strong class="text-sm wrap-break-word">{{ p.label }}</strong>
                  <span class="text-sm leading-snug font-normal wrap-break-word text-muted">{{ p.description }}</span>
                </label>
              </div>
            </fieldset>
            <FloatLabel class="mt-0!" variant="on">
              <InputText id="owner-name" v-model="f.fullName" fluid autocomplete="name" />
              <label for="owner-name">Họ tên chủ cửa hàng</label>
            </FloatLabel>
          </template>

          <FloatLabel class="mt-0!" variant="on">
            <InputText id="login-email" v-model="f.email" type="email" fluid autocomplete="email" />
            <label for="login-email">Email</label>
          </FloatLabel>
          <FloatLabel class="mt-0!" variant="on">
            <Password class="w-full" inputId="login-password" v-model="f.password" :feedback="false" toggle-mask fluid
              :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" />
            <label for="login-password">Mật khẩu</label>
          </FloatLabel>
          <small v-if="mode === 'register'" class="text-sm font-normal text-muted">Ít nhất 8 ký tự</small>

          <Message v-if="notice" severity="success" size="small">{{ notice }}</Message>
          <Message v-if="error" severity="error" size="small">{{ error }}</Message>
          <Button type="submit" raised :label="mode === 'login' ? 'Đăng nhập' : 'Tạo cửa hàng'" :loading="loading"
            :disabled="!canSubmit" fluid />
        </form>

        <div v-if="isDev && mode === 'login'"
          class="mt-4 flex flex-col gap-2 border-t border-dashed border-line pt-4 text-sm text-muted">
          <span class="wrap-break-word">Tài khoản mẫu (sau khi chạy <code>npm run seed</code>):</span>
          <div class="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
            <Button class="w-full" size="small" severity="secondary" outlined raised label="Quán cà phê"
              @click="fillDemo('cafe@demo.vn')" />
            <Button class="w-full" size="small" severity="secondary" outlined raised label="Nhà hàng"
              @click="fillDemo('nhahang@demo.vn')" />
            <Button class="w-full" size="small" severity="secondary" outlined raised label="Cửa hàng"
              @click="fillDemo('shop@demo.vn')" />
            <Button class="w-full" size="small" severity="secondary" outlined raised label="Rạp chiếu phim"
              @click="fillDemo('rap@demo.vn')" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>