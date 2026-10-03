<script setup lang="ts">
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import FloatLabel from 'primevue/floatlabel';
import InputText from 'primevue/inputtext';
import SelectButton from 'primevue/selectbutton';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '@/api/http';
import { askConfirm } from '@/components/confirm';
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
  if (!detail.value) return;
  const ok = await askConfirm(`Hủy đơn ${orderCode(detail.value.seq)}? Thao tác này không hoàn tác được.`, { acceptLabel: 'Hủy đơn' });
  if (!ok) return;
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
  <div class="page-head">
    <h2>Đơn hàng</h2>
    <div class="grid grid-cols-2 gap-2 lg:hidden" role="group" aria-label="Lọc theo trạng thái">
      <button v-for="item in filters" :key="item.v || 'all'" type="button"
        class="rounded-lg border px-2 py-2 text-sm font-medium" raised
        :class="filter === item.v ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface text-ink'"
        :aria-pressed="filter === item.v" @click="filter = item.v">{{ item.l }}</button>
    </div>
    <SelectButton class="hidden! lg:inline-flex!" v-model="filter" :options="filters" option-label="l" option-value="v"
      :allow-empty="false" aria-label="Lọc theo trạng thái" />
  </div>

  <p v-if="loadError" class="text-danger">{{ loadError }}</p>
  <div v-else class="grid grid-cols-1 gap-2 md:grid-cols-2 lg:hidden">
    <p v-if="loading" class="m-0 text-sm text-muted md:col-span-2">Đang tải đơn hàng...</p>
    <p v-else-if="!rows.length" class="m-0 text-muted md:col-span-2">Chưa có đơn hàng nào.</p>
    <button v-for="order in rows" :key="order.id" type="button" class="panel flex w-full flex-col gap-2 p-3 text-left"
      raised @click="open(order)">
      <span class="flex items-start justify-between gap-2">
        <strong>{{ orderCode(order.seq) }}</strong>
        <Tag :value="statusLabel[order.status]" :severity="statusSeverity[order.status]" />
      </span>
      <span class="truncate text-sm text-muted">{{ order.customerName || 'Khách lẻ' }}</span>
      <span class="flex items-end justify-between gap-3 text-sm">
        <span class="text-muted">{{ dateTime(order.createdAt) }}</span>
        <strong class="shrink-0">{{ vnd(order.totalVnd) }}</strong>
      </span>
    </button>
  </div>
  <DataTable v-if="!loadError" class="hidden! lg:block!" :value="rows" :loading="loading" data-key="id" size="small"
    selection-mode="single" @row-click="open($event.data)">
    <template #empty>Chưa có đơn hàng nào.</template>
    <Column header="Mã đơn"><template #body="{ data }">{{ orderCode(data.seq) }}</template></Column>
    <Column header="Khách"><template #body="{ data }">{{ data.customerName || '—' }}</template></Column>
    <Column header="Thời gian"><template #body="{ data }">{{ dateTime(data.createdAt) }}</template></Column>
    <Column header="Tổng tiền"><template #body="{ data }">{{ vnd(data.totalVnd) }}</template></Column>
    <Column header="Trạng thái"><template #body="{ data }">
        <Tag :value="statusLabel[data.status as keyof typeof statusLabel]"
          :severity="statusSeverity[data.status as keyof typeof statusSeverity]" />
      </template>
    </Column>
  </DataTable>

  <Dialog :visible="!!detail" modal :header="detail ? `Đơn ${orderCode(detail.seq)}` : ''"
    :style="{ width: 'min(32rem, calc(100vw - 1.5rem))' }" @update:visible="detail = null">
    <div v-if="detail" class="flex flex-col items-start gap-3.5 [&_>*]:w-full [&>:first-child]:w-auto">
      <Tag :value="statusLabel[detail.status]" :severity="statusSeverity[detail.status]" />
      <p v-if="detail.customer" class="m-0 text-muted">Khách: {{ detail.customer.name }}<span
          v-if="detail.customer.phone"> · {{ detail.customer.phone }}</span></p>
      <table class="w-full border-collapse">
        <tbody>
          <tr v-for="l in detail.lines" :key="l.id">
            <td class="border-b border-line py-2 pr-3 align-top wrap-break-word">{{ l.qty }} × {{ l.name }}<small
                v-if="l.note" class="block text-muted">{{ l.note }}</small><small
                v-if="l.refundedQty" class="text-muted"> · đã hoàn {{ l.refundedQty }}</small></td>
            <td class="border-b border-line py-2 text-right align-top whitespace-nowrap">{{ vnd(l.lineTotalVnd) }}</td>
          </tr>
        </tbody>
      </table>
      <dl class="m-0 flex flex-col gap-1 text-sm sm:text-[0.92rem]">
        <div class="flex items-start justify-between gap-3">
          <dt class="min-w-0">Tạm tính</dt>
          <dd class="m-0 shrink-0">{{ vnd(detail.subtotalVnd) }}</dd>
        </div>
        <div v-if="detail.discountVnd" class="flex items-start justify-between gap-3">
          <dt class="min-w-0">Giảm giá</dt>
          <dd class="m-0 shrink-0">−{{ vnd(detail.discountVnd) }}</dd>
        </div>
        <div v-if="detail.taxRatePercent" class="flex items-start justify-between gap-3">
          <dt class="min-w-0">
            Thuế {{ detail.taxRatePercent }}% ({{ detail.taxMode === 'inclusive' ? 'đã gồm' : 'cộng thêm' }})
          </dt>
          <dd class="m-0 shrink-0">{{ vnd(detail.taxVnd) }}</dd>
        </div>
        <div class="flex items-start justify-between gap-3 text-base font-bold">
          <dt class="min-w-0">Tổng cộng</dt>
          <dd class="m-0 shrink-0">{{ vnd(detail.totalVnd) }}</dd>
        </div>
        <div v-if="detail.refundedVnd" class="flex items-start justify-between gap-3">
          <dt class="min-w-0">Đã hoàn</dt>
          <dd class="m-0 shrink-0">−{{ vnd(detail.refundedVnd) }}</dd>
        </div>
      </dl>
      <template v-if="detail.payments.length">
        <h4>Thanh toán</h4>
        <dl class="m-0 flex flex-col gap-1 text-sm">
          <div v-for="p in detail.payments" :key="p.id" class="flex items-start justify-between gap-3">
            <dt class="min-w-0">{{ methodLabel[p.method] }}</dt>
            <dd class="m-0 shrink-0">{{ vnd(p.amountVnd) }}</dd>
          </div>
          <div v-if="detail.changeVnd" class="flex items-start justify-between gap-3">
            <dt class="min-w-0">Tiền thừa đã trả</dt>
            <dd class="m-0 shrink-0">{{ vnd(detail.changeVnd) }}</dd>
          </div>
        </dl>
      </template>
      <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button v-if="detail.status === 'open' && canManage" class="w-full sm:w-auto" label="Hủy đơn" severity="danger"
          outlined raised @click="voidOrder" />
        <Button v-if="canRefund" class="w-full sm:w-auto" label="Hoàn tiền" severity="secondary" outlined raised
          @click="openRefund" />
      </div>
    </div>
  </Dialog>

  <Dialog v-model:visible="refundOpen" modal header="Hoàn tiền" :style="{ width: 'min(28rem, calc(100vw - 1.5rem))' }">
    <form v-if="detail" class="flex flex-col gap-3" @submit.prevent="submitRefund">
      <p class="m-0 text-muted">Đơn đã thu không bị xóa. Hoàn theo số lượng từng món.</p>
      <div v-for="l in detail.lines" :key="l.id"
        class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <span>{{ l.name }}<small class="block text-[0.8rem] text-muted">còn {{ l.qty - l.refundedQty }}</small></span>
        <InputNumber class="w-full sm:w-auto" v-model="refundQty[l.id]" :min="0" :max="l.qty - l.refundedQty"
          :max-fraction-digits="0" show-buttons />
      </div>
      <FloatLabel variant="on">
        <InputText id="refund-reason" v-model="refundReason" fluid />
        <label for="refund-reason">Lý do</label>
      </FloatLabel>
      <Button type="submit" raised label="Xác nhận hoàn" :loading="refunding" fluid />
    </form>
  </Dialog>
</template>