<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import FloatLabel from 'primevue/floatlabel';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api/http';
import { askConfirm } from '@/components/confirm';
import type { OrderDetail } from '@/api/types';
import { useSession } from '@/stores/session';
import { newKey, orderCode, vnd } from '@/utils/format';

interface Area { id: string; name: string }
interface Table { id: string; areaId: string; name: string; seats: number; status: 'free' | 'occupied'; orderId: string | null }

const session = useSession();
const toast = useToast();
const router = useRouter();
const areas = ref<Area[]>([]);
const tables = ref<Table[]>([]);
const activeArea = ref<string | null>(null);
const loadError = ref('');
const canEdit = computed(() => ['owner', 'manager'].includes(session.boot?.user.role ?? ''));
const canSplit = computed(() => session.has('fnb.split_bill'));

const areaName = ref('');
const tableDialog = ref(false);
const tableForm = ref({ areaId: '', name: '', seats: 4 });
const selected = ref<Table | null>(null);
const order = ref<OrderDetail | null>(null);
const splitQty = ref<Record<string, number | null>>({});
const mergeId = ref<string | null>(null);

const visible = computed(() => tables.value.filter((t) => !activeArea.value || t.areaId === activeArea.value));
const mergeOptions = computed(() =>
  tables.value
    .filter((t) => t.orderId && t.id !== selected.value?.id && t.status === 'occupied')
    .map((t) => ({ id: t.orderId as string, label: t.name })),
);

async function load() {
  loadError.value = '';
  try {
    const data = await api<{ areas: Area[]; tables: Table[] }>('/fnb/tables');
    areas.value = data.areas;
    tables.value = data.tables;
  } catch (e: any) {
    loadError.value = e.message;
  }
}
onMounted(load);

async function addArea() {
  try {
    await api('/fnb/areas', { body: { name: areaName.value } });
    areaName.value = '';
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa thêm được khu vực', detail: e.message, life: 5000 });
  }
}
async function addTable() {
  try {
    await api('/fnb/tables', { body: { ...tableForm.value, seats: tableForm.value.seats || 4 } });
    tableDialog.value = false;
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa thêm được bàn', detail: e.message, life: 5000 });
  }
}
async function removeTable(t: Table) {
  if (!await askConfirm(`Xóa ${t.name}?`)) return;
  try {
    await api(`/fnb/tables/${t.id}`, { method: 'DELETE' });
    selected.value = null;
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa xóa được bàn', detail: e.message, life: 5000 });
  }
}
async function openTable(t: Table) {
  selected.value = t;
  order.value = null;
  mergeId.value = null;
  if (!t.orderId) return;
  try {
    order.value = await api<OrderDetail>(`/orders/${t.orderId}`);
    splitQty.value = Object.fromEntries(order.value.lines.map((l) => [l.id, 0]));
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Không mở được đơn', detail: e.message, life: 5000 });
  }
}
function sellHere() {
  if (!selected.value) return;
  router.push({ path: '/pos', query: { table: selected.value.id } });
}
async function split() {
  if (!order.value) return;
  const lines = order.value.lines.map((l) => ({ lineId: l.id, qty: splitQty.value[l.id] ?? 0 })).filter((l) => l.qty > 0);
  if (!lines.length) return;
  try {
    const result = await api<{ created: OrderDetail }>(`/fnb/bills/split`, { body: { orderId: order.value.id, lines } });
    toast.add({ severity: 'success', summary: `Đã tách ra đơn ${orderCode(result.created.seq)}`, life: 4000 });
    await load();
    const table = tables.value.find((t) => t.id === selected.value?.id);
    if (table) await openTable(table);
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa tách được bill', detail: e.message, life: 5000 });
  }
}
const payOpen = ref(false);
const paying = ref(false);
const cash = ref<number | null>(0);
const transfer = ref<number | null>(0);
const payKey = ref('');
const quick = [50000, 100000, 200000, 500000];
const due = computed(() => order.value?.totalVnd ?? 0);
const paidSum = computed(() => (cash.value ?? 0) + (transfer.value ?? 0));
const change = computed(() => paidSum.value - due.value);
const payError = computed(() =>
  paidSum.value < due.value ? `Còn thiếu ${vnd(due.value - paidSum.value)}` : (transfer.value ?? 0) > due.value ? 'Chuyển khoản không được vượt quá số cần thu' : '',
);

function openPay() {
  cash.value = due.value;
  transfer.value = 0;
  payKey.value = newKey();
  payOpen.value = true;
}
async function confirmPay() {
  if (!order.value || payError.value) return;
  paying.value = true;
  try {
    const payments = [
      { method: 'cash', amountVnd: cash.value ?? 0 },
      { method: 'transfer', amountVnd: transfer.value ?? 0 },
    ].filter((p) => p.amountVnd > 0);
    const paid = await api<OrderDetail>(`/orders/${order.value.id}/pay`, { body: { payments, idempotencyKey: payKey.value } });
    toast.add({
      severity: 'success',
      summary: `Đã thanh toán đơn ${orderCode(paid.seq)}`,
      detail: paid.changeVnd > 0 ? `Tiền thừa trả khách: ${vnd(paid.changeVnd)}` : undefined,
      life: 6000,
    });
    payOpen.value = false;
    selected.value = null;
    order.value = null;
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa thanh toán được', detail: e.message, life: 6000 });
  } finally {
    paying.value = false;
  }
}
async function merge() {
  if (!order.value || !mergeId.value) return;
  try {
    await api('/fnb/bills/merge', { body: { targetOrderId: order.value.id, sourceOrderId: mergeId.value } });
    toast.add({ severity: 'success', summary: 'Đã gộp bill', life: 3000 });
    await load();
    const table = tables.value.find((t) => t.id === selected.value?.id);
    if (table) await openTable(table);
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa gộp được bill', detail: e.message, life: 5000 });
  }
}
</script>

<template>
  <div class="page-head">
    <h2>Sơ đồ bàn</h2>
    <Button v-if="canEdit" label="Thêm bàn" icon="pi pi-plus" raised :disabled="!areas.length"
      @click="tableForm = { areaId: activeArea || areas[0]?.id || '', name: '', seats: 4 }; tableDialog = true" />
  </div>
  <p v-if="loadError" class="text-danger">{{ loadError }}</p>
  <div v-else>
    <div class="flex flex-wrap gap-2">
      <button type="button" class="chip" :class="!activeArea && 'border-primary bg-primary text-on-primary'" raised
        @click="activeArea = null">Tất cả</button>
      <button v-for="a in areas" :key="a.id" type="button" class="chip"
        :class="activeArea === a.id && 'border-primary bg-primary text-on-primary'" raised @click="activeArea = a.id">{{
          a.name
        }}</button>
    </div>
    <form v-if="canEdit" class="my-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end"
      @submit.prevent="areaName.trim() && addArea()">
      <FloatLabel variant="on" class="w-full sm:w-64">
        <InputText id="area-name" v-model="areaName" fluid />
        <label for="area-name">Khu vực mới, ví dụ Tầng 1</label>
      </FloatLabel>
      <Button type="submit" raised label="Thêm khu vực" severity="secondary" outlined :disabled="!areaName.trim()" />
    </form>
    <p v-if="!tables.length" class="my-2 text-muted">Chưa có bàn. Thêm khu vực rồi thêm bàn.</p>
    <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      <button v-for="t in visible" :key="t.id" type="button" class="tile"
        :class="t.status === 'occupied' && 'border-primary bg-primary-soft'" raised @click="openTable(t)">
        <strong>{{ t.name }}</strong>
        <span class="text-sm text-muted">{{ t.seats }} chỗ · {{ t.status === 'occupied' ? 'Đang có khách' : 'Trống'
        }}</span>
      </button>
    </div>
  </div>

  <Dialog v-model:visible="tableDialog" modal header="Thêm bàn" :style="{ width: 'min(22rem, calc(100vw - 1.5rem))' }">
    <form class="flex flex-col gap-3" @submit.prevent="tableForm.name.trim() && addTable()">
      <label class="field">Khu vực<Select v-model="tableForm.areaId" :options="areas" option-label="name"
          option-value="id" fluid /></label>
      <FloatLabel variant="on">
        <InputText id="table-name" v-model="tableForm.name" fluid />
        <label for="table-name">Tên bàn</label>
      </FloatLabel>
      <label class="field">Số chỗ
        <InputNumber v-model="tableForm.seats" :min="1" :max="50" fluid />
      </label>
      <Button type="submit" raised label="Thêm bàn" :disabled="!tableForm.name.trim()" fluid />
    </form>
  </Dialog>

  <Dialog :visible="!!selected" modal :header="selected?.name" :style="{ width: 'min(32rem, calc(100vw - 1.5rem))' }"
    @update:visible="selected = null">
    <div v-if="selected" class="flex flex-col gap-3">
      <p class="my-2 text-muted">{{ selected.seats }} chỗ · {{ selected.status === 'occupied' ? 'Đang có khách' :
        'Trống' }}</p>
      <Button v-if="selected.status === 'free'" label="Bán cho bàn này" icon="pi pi-shopping-cart" raised
        @click="sellHere" />
      <template v-if="order">
        <p>Đơn {{ orderCode(order.seq) }} · {{ vnd(order.totalVnd) }}</p>
        <div v-for="l in order.lines" :key="l.id"
          class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span>{{ l.qty }} × {{ l.name }}</span>
          <InputNumber v-if="canSplit && order.status === 'open'" v-model="splitQty[l.id]" :min="0" :max="l.qty"
            :max-fraction-digits="0" show-buttons />
        </div>
        <Button v-if="order.status === 'open'" label="Thanh toán" icon="pi pi-wallet" raised @click="openPay" />
        <Button v-if="canSplit && order.status === 'open'" label="Tách món đã chọn" severity="secondary" outlined raised
          @click="split" />
        <div v-if="canSplit && order.status === 'open' && mergeOptions.length" class="flex flex-col gap-2">
          <Select v-model="mergeId" :options="mergeOptions" option-label="label" option-value="id"
            placeholder="Gộp đơn từ bàn khác" fluid />
          <Button label="Gộp vào bàn này" severity="secondary" outlined raised :disabled="!mergeId" @click="merge" />
        </div>
      </template>
      <Button v-if="canEdit && selected.status === 'free'" label="Xóa bàn" severity="danger" raised
        @click="removeTable(selected)" />
    </div>
  </Dialog>

  <Dialog v-model:visible="payOpen" modal header="Thanh toán" :style="{ width: 'min(26rem, calc(100vw - 1.5rem))' }">
    <div class="flex flex-col gap-3">
      <div class="flex items-baseline justify-between"><span>Cần thu</span><strong class="text-xl">{{ vnd(due) }}</strong>
      </div>
      <label class="field">Tiền mặt khách đưa
        <InputNumber v-model="cash" :min="0" :max-fraction-digits="0" locale="vi-VN" fluid />
      </label>
      <div class="flex flex-wrap gap-1.5">
        <Button label="Đủ" size="small" severity="secondary" outlined raised @click="cash = due; transfer = 0" />
        <Button v-for="q in quick" :key="q" :label="vnd(q)" size="small" severity="secondary" outlined raised
          @click="cash = q" />
      </div>
      <label class="field">Chuyển khoản
        <InputNumber v-model="transfer" :min="0" :max-fraction-digits="0" locale="vi-VN" fluid />
      </label>
      <Button label="Thu đủ bằng chuyển khoản" size="small" severity="secondary" raised
        @click="transfer = due; cash = 0" />
      <Message v-if="payError" severity="warn" size="small">{{ payError }}</Message>
      <div v-else class="flex items-baseline justify-between"><span>Tiền thừa trả khách</span><strong class="text-xl">{{
        vnd(Math.max(0, change)) }}</strong></div>
      <Button label="Xác nhận thu tiền" raised :loading="paying" :disabled="!!payError" fluid @click="confirmPay" />
    </div>
  </Dialog>
</template>