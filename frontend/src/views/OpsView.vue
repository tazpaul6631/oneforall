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
  <div class="page">
    <header>
      <div>
        <h1>Cửa hàng</h1>
        <p>{{ session.operator?.email }}</p>
      </div>
      <Button label="Đăng xuất" severity="secondary" outlined @click="session.logout()" />
    </header>

    <Message v-if="error" severity="error">{{ error }}</Message>

    <table>
      <thead>
        <tr>
          <th>Cửa hàng</th>
          <th>Gói</th>
          <th>Chủ quán</th>
          <th>Trạng thái</th>
          <th>Dùng đến</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="shop in shops" :key="shop.id">
          <td>{{ shop.name }}</td>
          <td>{{ shop.presetLabel }}</td>
          <td>{{ shop.ownerEmail }}</td>
          <td>{{ label[shop.status] }}</td>
          <td>{{ until(shop.activeUntil) }}</td>
          <td class="actions">
            <Button size="small" :label="actionLabel(shop.status)" :loading="busy === shop.id + 'grant'" @click="grant(shop)" />
            <Button v-if="shop.status === 'active' || shop.status === 'expired'" size="small" severity="danger" outlined label="Khóa" :loading="busy === shop.id + 'suspend'" @click="suspend(shop)" />
            <Button size="small" severity="secondary" outlined label="Đặt lại mật khẩu" @click="resetId = shop.id; resetPassword = ''" />
            <form v-if="resetId === shop.id" class="reset" @submit.prevent="resetPassword.length >= 8 && reset(shop)">
              <label :for="`pw-${shop.id}`">Mật khẩu mới</label>
              <Password :input-id="`pw-${shop.id}`" v-model="resetPassword" :feedback="false" toggle-mask />
              <Button type="submit" size="small" label="Lưu" :disabled="resetPassword.length < 8" :loading="busy === shop.id + 'reset'" />
            </form>
          </td>
        </tr>
        <tr v-if="shops.length === 0">
          <td colspan="6">Chưa có cửa hàng nào.</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.page { max-width: 1100px; margin: 0 auto; padding: 2rem 1.25rem; }
header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 1.25rem; }
h1 { margin: 0 0 0.25rem; font-size: 1.6rem; }
header p { margin: 0; color: var(--p-text-muted-color); }
table { width: 100%; border-collapse: collapse; background: var(--p-surface-0); }
th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid var(--p-content-border-color); vertical-align: top; }
th { font-size: 0.8rem; color: var(--p-text-muted-color); font-weight: 600; }
.actions { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.reset { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; }
.reset label { position: absolute; width: 1px; height: 1px; overflow: hidden; }
</style>
