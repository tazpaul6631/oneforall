<script setup lang="ts">
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import SelectButton from 'primevue/selectbutton';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '@/api/http';
import type { Order, OrderDetail } from '@/api/types';
import { useSession } from '@/stores/session';
import { dateTime, newKey, orderCode, statusLabel, statusSeverity, vnd } from '@/utils/format';

const session = useSession();
const toast = useToast();
const filter = ref('');
const filters = [
  { v: '', l: 'Tất cả' },
  { v: 'paid', l: 'Đã thanh toán' },
  { v: 'open', l: 'Chưa thanh toán' },
  { v: 'void', l: 'Đã hủy' },
];
const rows = ref<Order[]>([]);
const loading = ref(true);
const loadError = ref('');
const detail = ref<OrderDetail | null>(null);
const canManage = computed(() => ['owner', 'manager'].includes(session.boot?.user.role ?? ''));
const refundOpen = ref(false);
const refunding = ref(false);
const refundReason = ref('');
const refundQty = ref<Record<string, number | null>>({});
const canRefund = computed(() => !!detail.value && detail.value.status === 'paid' && detail.value.refundedVnd < detail.value.totalVnd && canManage.value);
const methodLabel = { cash: 'Tiền mặt', transfer: 'Chuyển khoản' } as const;

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    rows.value = await api<Order[]>(`/orders${filter.value ? `?status=${filter.value}` : ''}`);
  } catch (e: any) {
    loadError.value = e.message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
watch(filter, load);

async function open(o: Order) {
  try {
    detail.value = await api<OrderDetail>(`/orders/${o.id}`);
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Không mở được đơn', detail: e.message, life: 5000 });
  }
}

function openRefund() {
  if (!detail.value) return;
  refundQty.value = Object.fromEntries(detail.value.lines.map((l) => [l.id, 0]));
  refundReason.value = '';
  refundOpen.value = true;
}
async function submitRefund() {
  if (!detail.value) return;
  const lines = detail.value.lines
    .map((l) => ({ lineId: l.id, qty: refundQty.value[l.id] ?? 0 }))
    .filter((l) => l.qty > 0);
  if (!lines.length) return;
  refunding.value = true;
  try {
    detail.value = await api<OrderDetail>(`/orders/${detail.value.id}/refund`, {
      body: { lines, reason: refundReason.value.trim() || undefined, idempotencyKey: newKey() },
    });
    toast.add({ severity: 'success', summary: 'Đã hoàn tiền', life: 3000 });
    refundOpen.value = false;
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa hoàn được tiền', detail: e.message, life: 5000 });
  } finally {
    refunding.value = false;
  }
}

async function voidOrder() {
  if (!detail.value || !window.confirm(`Hủy đơn ${orderCode(detail.value.seq)}? Thao tác này không hoàn tác được.`)) return;
  try {
    detail.value = await api<OrderDetail>(`/orders/${detail.value.id}/void`, { method: 'POST', body: {} });
    toast.add({ severity: 'success', summary: 'Đã hủy đơn', life: 3000 });
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa hủy được đơn', detail: e.message, life: 5000 });
  }
}
</script>

<template>
  <div class="head">
    <h2>Đơn hàng</h2>
    <SelectButton v-model="filter" :options="filters" option-label="l" option-value="v" :allow-empty="false" aria-label="Lọc theo trạng thái" />
  </div>

  <p v-if="loadError" class="err">{{ loadError }}</p>
  <DataTable v-else :value="rows" :loading="loading" data-key="id" size="small" selection-mode="single" @row-click="open($event.data)">
    <template #empty>Chưa có đơn hàng nào.</template>
    <Column header="Mã đơn"><template #body="{ data }">{{ orderCode(data.seq) }}</template></Column>
    <Column header="Khách"><template #body="{ data }">{{ data.customerName || '—' }}</template></Column>
    <Column header="Thời gian"><template #body="{ data }">{{ dateTime(data.createdAt) }}</template></Column>
    <Column header="Tổng tiền"><template #body="{ data }">{{ vnd(data.totalVnd) }}</template></Column>
    <Column header="Trạng thái"><template #body="{ data }"><Tag :value="statusLabel[data.status as keyof typeof statusLabel]" :severity="statusSeverity[data.status as keyof typeof statusSeverity]" /></template></Column>
  </DataTable>

  <Dialog :visible="!!detail" modal :header="detail ? `Đơn ${orderCode(detail.seq)}` : ''" :style="{ width: '32rem' }" @update:visible="detail = null">
    <div v-if="detail" class="detail">
      <Tag :value="statusLabel[detail.status]" :severity="statusSeverity[detail.status]" />
      <p v-if="detail.customer" class="who">Khách: {{ detail.customer.name }}<span v-if="detail.customer.phone"> · {{ detail.customer.phone }}</span></p>
      <table>
        <tbody>
          <tr v-for="l in detail.lines" :key="l.id">
            <td>{{ l.qty }} × {{ l.name }}<small v-if="l.refundedQty"> · đã hoàn {{ l.refundedQty }}</small></td>
            <td>{{ vnd(l.lineTotalVnd) }}</td>
          </tr>
        </tbody>
      </table>
      <dl>
        <div><dt>Tạm tính</dt><dd>{{ vnd(detail.subtotalVnd) }}</dd></div>
        <div v-if="detail.discountVnd"><dt>Giảm giá</dt><dd>−{{ vnd(detail.discountVnd) }}</dd></div>
        <div v-if="detail.taxRatePercent"><dt>Thuế {{ detail.taxRatePercent }}% ({{ detail.taxMode === 'inclusive' ? 'đã gồm' : 'cộng thêm' }})</dt><dd>{{ vnd(detail.taxVnd) }}</dd></div>
        <div class="grand"><dt>Tổng cộng</dt><dd>{{ vnd(detail.totalVnd) }}</dd></div>
        <div v-if="detail.refundedVnd"><dt>Đã hoàn</dt><dd>−{{ vnd(detail.refundedVnd) }}</dd></div>
      </dl>
      <template v-if="detail.payments.length">
        <h4>Thanh toán</h4>
        <dl>
          <div v-for="p in detail.payments" :key="p.id"><dt>{{ methodLabel[p.method] }}</dt><dd>{{ vnd(p.amountVnd) }}</dd></div>
          <div v-if="detail.changeVnd"><dt>Tiền thừa đã trả</dt><dd>{{ vnd(detail.changeVnd) }}</dd></div>
        </dl>
      </template>
      <div class="actions">
        <Button v-if="detail.status === 'open' && canManage" label="Hủy đơn" severity="danger" outlined @click="voidOrder" />
        <Button v-if="canRefund" label="Hoàn tiền" severity="secondary" outlined @click="openRefund" />
      </div>
    </div>
  </Dialog>

  <Dialog v-model:visible="refundOpen" modal header="Hoàn tiền" :style="{ width: '28rem' }">
    <form v-if="detail" class="form" @submit.prevent="submitRefund">
      <p class="who">Đơn đã thu không bị xóa. Hoàn theo số lượng từng món.</p>
      <div v-for="l in detail.lines" :key="l.id" class="rline">
        <span>{{ l.name }}<small>còn {{ l.qty - l.refundedQty }}</small></span>
        <InputNumber v-model="refundQty[l.id]" :min="0" :max="l.qty - l.refundedQty" :max-fraction-digits="0" show-buttons />
      </div>
      <label>Lý do<InputText v-model="refundReason" fluid /></label>
      <Button type="submit" label="Xác nhận hoàn" :loading="refunding" fluid />
    </form>
  </Dialog>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 1rem; flex-wrap: wrap; }
.err { color: var(--p-red-600); }
.detail { display: flex; flex-direction: column; gap: 0.9rem; align-items: flex-start; }
.detail > * { width: 100%; }
.detail > :first-child { width: auto; }
table { border-collapse: collapse; }
td { padding: 0.3rem 0; border-bottom: 1px solid var(--p-content-border-color); }
td:last-child, dd { text-align: right; }
dl { margin: 0; display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.92rem; }
dl div { display: flex; justify-content: space-between; gap: 1rem; }
dd { margin: 0; }
.grand { font-weight: 700; font-size: 1.05rem; }
h4 { margin: 0; font-size: 0.95rem; }
.who { margin: 0; color: var(--p-text-muted-color); }
.who small, td small { color: var(--p-text-muted-color); }
.actions { display: flex; gap: 0.5rem; }
.form { display: flex; flex-direction: column; gap: 0.75rem; }
.form label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.9rem; font-weight: 500; }
.rline { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; }
.rline small { display: block; color: var(--p-text-muted-color); font-size: 0.8rem; }
</style>
