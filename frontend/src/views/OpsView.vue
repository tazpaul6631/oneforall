<script setup lang="ts">
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Password from 'primevue/password';
import { onMounted, ref } from 'vue';
import { api } from '@/api/http';
import { useSession } from '@/stores/session';

interface Shop {
  id: string;
  name: string;
  presetLabel: string;
  status: 'pending' | 'active' | 'expired' | 'suspended';
  activeUntil: string | null;
  ownerEmail: string;
}

const session = useSession();
const shops = ref<Shop[]>([]);
const error = ref('');
const busy = ref('');
const resetId = ref('');
const resetPassword = ref('');

const label = {
  pending: 'Chờ kích hoạt',
  active: 'Đang dùng',
  expired: 'Hết hạn',
  suspended: 'Tạm khóa',
} as const;

function until(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('vi-VN');
}

function actionLabel(status: Shop['status']) {
  if (status === 'pending') return 'Kích hoạt';
  if (status === 'suspended') return 'Mở lại';
  return 'Gia hạn';
}

async function load() {
  shops.value = await api<Shop[]>('/ops/tenants');
}

async function run(id: string, key: string, fn: () => Promise<unknown>) {
  busy.value = id + key;
  error.value = '';
  try {
    await fn();
    await load();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    busy.value = '';
  }
}

function grant(shop: Shop) {
  return run(shop.id, 'grant', () => api(`/ops/tenants/${shop.id}/activate`, { body: { days: 30 } }));
}

function suspend(shop: Shop) {
  return run(shop.id, 'suspend', () => api(`/ops/tenants/${shop.id}/suspend`, { method: 'POST' }));
}

function reset(shop: Shop) {
  return run(shop.id, 'reset', async () => {
    await api(`/ops/tenants/${shop.id}/reset-password`, { body: { password: resetPassword.value } });
    resetId.value = '';
    resetPassword.value = '';
  });
}

onMounted(load);
</script>

<template>
  <div class="mx-auto w-full max-w-6xl p-4 md:p-8">
    <header class="page-head">
      <div>
        <h1>Cửa hàng</h1>
        <p class="m-0 text-muted">{{ session.operator?.email }}</p>
      </div>
      <Button label="Đăng xuất" severity="secondary" outlined raised @click="session.logout()" />
    </header>

    <Message v-if="error" severity="error">{{ error }}</Message>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
      <article v-for="shop in shops" :key="shop.id" class="panel flex flex-col gap-2 p-3">
        <div class="flex items-start justify-between gap-2">
          <strong>{{ shop.name }}</strong>
          <span class="shrink-0 text-sm text-muted">{{ label[shop.status] }}</span>
        </div>
        <p class="m-0 text-sm text-muted">{{ shop.presetLabel }} · {{ shop.ownerEmail }}</p>
        <p class="m-0 text-sm">Dùng đến {{ until(shop.activeUntil) }}</p>
        <div class="flex flex-wrap gap-1.5">
          <Button size="small" raised :label="actionLabel(shop.status)" :loading="busy === shop.id + 'grant'"
            @click="grant(shop)" />
          <Button v-if="shop.status === 'active' || shop.status === 'expired'" size="small" severity="danger" outlined
            raised label="Khóa" :loading="busy === shop.id + 'suspend'" @click="suspend(shop)" />
          <Button size="small" severity="secondary" outlined raised label="Đặt lại mật khẩu"
            @click="resetId = shop.id; resetPassword = ''" />
        </div>
        <form v-if="resetId === shop.id" class="flex flex-col gap-2 sm:flex-row sm:items-center"
          @submit.prevent="resetPassword.length >= 8 && reset(shop)">
          <label class="sr-only" :for="`pw-card-${shop.id}`">Mật khẩu mới</label>
          <Password :input-id="`pw-card-${shop.id}`" v-model="resetPassword" :feedback="false" toggle-mask />
          <Button type="submit" raised size="small" label="Lưu" :disabled="resetPassword.length < 8"
            :loading="busy === shop.id + 'reset'" />
        </form>
      </article>
      <p v-if="shops.length === 0" class="m-0 text-muted md:col-span-2">Chưa có cửa hàng nào.</p>
    </div>

    <div class="panel hidden overflow-x-auto lg:block">
      <table class="w-full border-collapse">
        <thead>
          <tr>
            <th class="px-3 py-3 text-left text-xs font-semibold text-muted">Cửa hàng</th>
            <th class="px-3 py-3 text-left text-xs font-semibold text-muted">Gói</th>
            <th class="hidden px-3 py-3 text-left text-xs font-semibold text-muted lg:table-cell">Chủ quán</th>
            <th class="px-3 py-3 text-left text-xs font-semibold text-muted">Trạng thái</th>
            <th class="px-3 py-3 text-left text-xs font-semibold text-muted">Dùng đến</th>
            <th class="px-3 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="shop in shops" :key="shop.id" class="border-t border-line align-top">
            <td class="px-3 py-3">
              <div>{{ shop.name }}</div>
              <div class="mt-0.5 text-sm text-muted lg:hidden">{{ shop.ownerEmail }}</div>
            </td>
            <td class="px-3 py-3">{{ shop.presetLabel }}</td>
            <td class="hidden px-3 py-3 lg:table-cell">{{ shop.ownerEmail }}</td>
            <td class="px-3 py-3">{{ label[shop.status] }}</td>
            <td class="px-3 py-3 whitespace-nowrap">{{ until(shop.activeUntil) }}</td>
            <td class="px-3 py-3">
              <div class="flex flex-wrap items-center gap-1.5">
                <Button size="small" raised :label="actionLabel(shop.status)" :loading="busy === shop.id + 'grant'"
                  @click="grant(shop)" />
                <Button v-if="shop.status === 'active' || shop.status === 'expired'" size="small" severity="danger"
                  outlined raised label="Khóa" :loading="busy === shop.id + 'suspend'" @click="suspend(shop)" />
                <Button size="small" severity="secondary" outlined raised label="Đặt lại mật khẩu"
                  @click="resetId = shop.id; resetPassword = ''" />
                <form v-if="resetId === shop.id" class="flex flex-wrap items-center gap-1.5"
                  @submit.prevent="resetPassword.length >= 8 && reset(shop)">
                  <label class="sr-only" :for="`pw-${shop.id}`">Mật khẩu mới</label>
                  <Password :input-id="`pw-${shop.id}`" v-model="resetPassword" :feedback="false" toggle-mask />
                  <Button type="submit" raised size="small" label="Lưu" :disabled="resetPassword.length < 8"
                    :loading="busy === shop.id + 'reset'" />
                </form>
              </div>
            </td>
          </tr>
          <tr v-if="shops.length === 0">
            <td class="px-3 py-3" colspan="6">Chưa có cửa hàng nào.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>