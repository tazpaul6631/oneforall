<script setup lang="ts">
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import FloatLabel from 'primevue/floatlabel';
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
  <div class="page-head">
    <h2>Đổi trả</h2>
    <Button v-if="canEdit" label="Tạo phiếu" icon="pi pi-plus" raised @click="openNew" />
  </div>
  <p class="mb-4 text-muted">Phiếu gắn với đơn đã thanh toán và hoàn tiền tương ứng. Đơn gốc vẫn được giữ.</p>
  <p v-if="loadError" class="text-danger">{{ loadError }}</p>
  <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
    <p v-if="loading" class="m-0 text-sm text-muted md:col-span-2">Đang tải phiếu...</p>
    <p v-else-if="!rows.length" class="m-0 text-muted md:col-span-2">Chưa có phiếu đổi trả.</p>
    <article v-for="row in rows" :key="row.id" class="panel flex flex-col gap-2 p-3">
      <div class="flex items-start justify-between gap-2">
        <span class="text-sm text-muted">{{ dateTime(row.createdAt) }}</span>
        <strong class="shrink-0">{{ vnd(row.totalVnd) }}</strong>
      </div>
      <p class="m-0 text-sm">{{row.lines.map((l) => `${l.qty} × ${l.name}`).join(', ')}}</p>
      <p class="m-0 text-sm text-muted">{{ row.note || 'Không ghi chú' }}</p>
    </article>
  </div>
  <DataTable v-if="!loadError" class="hidden! lg:block!" :value="rows" :loading="loading" data-key="id" size="small">
    <template #empty>Chưa có phiếu đổi trả.</template>
    <Column header="Thời gian"><template #body="{ data }">{{ dateTime(data.createdAt) }}</template></Column>
    <Column header="Hàng"><template #body="{ data }">{{data.lines.map((l: any) => `${l.qty} × ${l.name}`).join(', ')
        }}</template></Column>
    <Column header="Hoàn"><template #body="{ data }">{{ vnd(data.totalVnd) }}</template></Column>
    <Column header="Ghi chú"><template #body="{ data }">{{ data.note || '—' }}</template></Column>
  </DataTable>

  <Dialog v-model:visible="dialog" modal header="Phiếu đổi trả" :style="{ width: 'min(32rem, calc(100vw - 1.5rem))' }">
    <form class="flex flex-col gap-3" @submit.prevent="save">
      <label class="field">Đơn đã thanh toán
        <Select v-model="orderId" :options="orderOptions" option-label="label" option-value="id" placeholder="Chọn đơn"
          fluid />
      </label>
      <div v-for="l in detail?.lines ?? []" :key="l.id"
        class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>{{ l.name }}<small class="block font-normal text-muted">còn {{ l.qty - (l.refundedQty || 0)
            }}</small></span>
        <InputNumber v-model="qty[l.id]" :min="0" :max="l.qty - (l.refundedQty || 0)" :max-fraction-digits="0"
          show-buttons />
      </div>
      <FloatLabel variant="on">
        <InputText id="return-note" v-model="note" fluid />
        <label for="return-note">Ghi chú</label>
      </FloatLabel>
      <Button type="submit" raised label="Tạo phiếu và hoàn tiền" :loading="saving" :disabled="!detail" fluid />
    </form>
  </Dialog>
</template>