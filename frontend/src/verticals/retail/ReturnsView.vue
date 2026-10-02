<script setup lang="ts">
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '@/api/http';
import type { Order, OrderDetail } from '@/api/types';
import { useSession } from '@/stores/session';
import { dateTime, newKey, orderCode, vnd } from '@/utils/format';

interface ReturnRow {
  id: string; orderId: string; totalVnd: number; note: string | null; createdAt: string;
  lines: { id: string; name: string; qty: number; amountVnd: number }[];
}

const session = useSession();
const toast = useToast();
const rows = ref<ReturnRow[]>([]);
const orders = ref<Order[]>([]);
const loading = ref(true);
const loadError = ref('');
const dialog = ref(false);
const orderId = ref<string | null>(null);
const detail = ref<OrderDetail | null>(null);
const qty = ref<Record<string, number | null>>({});
const note = ref('');
const saving = ref(false);
const canEdit = computed(() => ['owner', 'manager'].includes(session.boot?.user.role ?? ''));
const orderOptions = computed(() => orders.value.map((o) => ({ id: o.id, label: `${orderCode(o.seq)} · ${vnd(o.totalVnd)}` })));

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const [returns, paid] = await Promise.all([
      api<{ returns: ReturnRow[] }>('/retail/returns'),
      api<Order[]>('/orders?status=paid'),
    ]);
    rows.value = returns.returns;
    orders.value = paid;
  } catch (e: any) {
    loadError.value = e.message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

watch(orderId, async (id) => {
  detail.value = null;
  if (!id) return;
  try {
    detail.value = await api<OrderDetail>(`/orders/${id}`);
    qty.value = Object.fromEntries(detail.value.lines.map((l) => [l.id, 0]));
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Không mở được đơn', detail: e.message, life: 5000 });
  }
});

function openNew() {
  orderId.value = null;
  detail.value = null;
  note.value = '';
  dialog.value = true;
}
async function save() {
  if (!detail.value) return;
  const lines = detail.value.lines
    .map((l) => ({ orderLineId: l.id, qty: qty.value[l.id] ?? 0 }))
    .filter((l) => l.qty > 0);
  if (!lines.length) return;
  saving.value = true;
  try {
    await api('/retail/returns', { body: { orderId: detail.value.id, lines, note: note.value.trim() || undefined, idempotencyKey: newKey() } });
    toast.add({ severity: 'success', summary: 'Đã tạo phiếu đổi trả', life: 3000 });
    dialog.value = false;
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa tạo được phiếu', detail: e.message, life: 5000 });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="head">
    <h2>Đổi trả</h2>
    <Button v-if="canEdit" label="Tạo phiếu" icon="pi pi-plus" @click="openNew" />
  </div>
  <p class="lead">Phiếu gắn với đơn đã thanh toán và hoàn tiền tương ứng. Đơn gốc vẫn được giữ.</p>
  <p v-if="loadError" class="err">{{ loadError }}</p>
  <DataTable v-else :value="rows" :loading="loading" data-key="id" size="small">
    <template #empty>Chưa có phiếu đổi trả.</template>
    <Column header="Thời gian"><template #body="{ data }">{{ dateTime(data.createdAt) }}</template></Column>
    <Column header="Hàng"><template #body="{ data }">{{ data.lines.map((l: any) => `${l.qty} × ${l.name}`).join(', ') }}</template></Column>
    <Column header="Hoàn"><template #body="{ data }">{{ vnd(data.totalVnd) }}</template></Column>
    <Column header="Ghi chú"><template #body="{ data }">{{ data.note || '—' }}</template></Column>
  </DataTable>

  <Dialog v-model:visible="dialog" modal header="Phiếu đổi trả" :style="{ width: '32rem' }">
    <form class="form" @submit.prevent="save">
      <label>Đơn đã thanh toán
        <Select v-model="orderId" :options="orderOptions" option-label="label" option-value="id" placeholder="Chọn đơn" fluid />
      </label>
      <div v-for="l in detail?.lines ?? []" :key="l.id" class="line">
        <span>{{ l.name }}<small>còn {{ l.qty - (l.refundedQty || 0) }}</small></span>
        <InputNumber v-model="qty[l.id]" :min="0" :max="l.qty - (l.refundedQty || 0)" :max-fraction-digits="0" show-buttons />
      </div>
      <label>Ghi chú<InputText v-model="note" fluid /></label>
      <Button type="submit" label="Tạo phiếu và hoàn tiền" :loading="saving" :disabled="!detail" fluid />
    </form>
  </Dialog>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; }
.lead { color: var(--p-text-muted-color); margin: 0 0 1rem; }
.err { color: var(--p-red-600); }
.form { display: flex; flex-direction: column; gap: 0.8rem; }
.form label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.9rem; font-weight: 500; }
.line { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; }
.line small { display: block; color: var(--p-text-muted-color); font-weight: 400; }
</style>
