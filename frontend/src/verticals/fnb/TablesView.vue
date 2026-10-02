<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api/http';
import type { OrderDetail } from '@/api/types';
import { useSession } from '@/stores/session';
import { orderCode, vnd } from '@/utils/format';

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
  if (!window.confirm(`Xóa ${t.name}?`)) return;
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
  <div class="head">
    <h2>Sơ đồ bàn</h2>
    <Button v-if="canEdit" label="Thêm bàn" icon="pi pi-plus" :disabled="!areas.length" @click="tableForm = { areaId: activeArea || areas[0]?.id || '', name: '', seats: 4 }; tableDialog = true" />
  </div>
  <p v-if="loadError" class="err">{{ loadError }}</p>
  <div v-else>
    <div class="cats">
      <button type="button" :class="{ on: !activeArea }" @click="activeArea = null">Tất cả</button>
      <button v-for="a in areas" :key="a.id" type="button" :class="{ on: activeArea === a.id }" @click="activeArea = a.id">{{ a.name }}</button>
    </div>
    <form v-if="canEdit" class="add-area" @submit.prevent="areaName.trim() && addArea()">
      <InputText v-model="areaName" placeholder="Khu vực mới, ví dụ Tầng 1" aria-label="Tên khu vực" />
      <Button type="submit" label="Thêm khu vực" severity="secondary" outlined :disabled="!areaName.trim()" />
    </form>
    <p v-if="!tables.length" class="muted">Chưa có bàn. Thêm khu vực rồi thêm bàn.</p>
    <div class="grid">
      <button v-for="t in visible" :key="t.id" type="button" class="tile" :class="t.status" @click="openTable(t)">
        <strong>{{ t.name }}</strong>
        <span>{{ t.seats }} chỗ · {{ t.status === 'occupied' ? 'Đang có khách' : 'Trống' }}</span>
      </button>
    </div>
  </div>

  <Dialog v-model:visible="tableDialog" modal header="Thêm bàn" :style="{ width: '22rem' }">
    <form class="form" @submit.prevent="tableForm.name.trim() && addTable()">
      <label>Khu vực<Select v-model="tableForm.areaId" :options="areas" option-label="name" option-value="id" fluid /></label>
      <label>Tên bàn<InputText v-model="tableForm.name" fluid /></label>
      <label>Số chỗ<InputNumber v-model="tableForm.seats" :min="1" :max="50" fluid /></label>
      <Button type="submit" label="Thêm bàn" :disabled="!tableForm.name.trim()" fluid />
    </form>
  </Dialog>

  <Dialog :visible="!!selected" modal :header="selected?.name" :style="{ width: '32rem' }" @update:visible="selected = null">
    <div v-if="selected" class="form">
      <p class="muted">{{ selected.seats }} chỗ · {{ selected.status === 'occupied' ? 'Đang có khách' : 'Trống' }}</p>
      <Button v-if="selected.status === 'free'" label="Bán cho bàn này" icon="pi pi-shopping-cart" @click="sellHere" />
      <template v-if="order">
        <p>Đơn {{ orderCode(order.seq) }} · {{ vnd(order.totalVnd) }}</p>
        <div v-for="l in order.lines" :key="l.id" class="line">
          <span>{{ l.qty }} × {{ l.name }}</span>
          <InputNumber v-if="canSplit && order.status === 'open'" v-model="splitQty[l.id]" :min="0" :max="l.qty" :max-fraction-digits="0" show-buttons />
        </div>
        <Button v-if="canSplit && order.status === 'open'" label="Tách món đã chọn" severity="secondary" outlined @click="split" />
        <div v-if="canSplit && order.status === 'open' && mergeOptions.length" class="merge">
          <Select v-model="mergeId" :options="mergeOptions" option-label="label" option-value="id" placeholder="Gộp đơn từ bàn khác" fluid />
          <Button label="Gộp vào bàn này" severity="secondary" outlined :disabled="!mergeId" @click="merge" />
        </div>
      </template>
      <Button v-if="canEdit && selected.status === 'free'" label="Xóa bàn" severity="danger" text @click="removeTable(selected)" />
    </div>
  </Dialog>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 1rem; }
.err { color: var(--p-red-600); }
.muted { color: var(--p-text-muted-color); margin: 0.5rem 0; }
.cats, .add-area, .form, .merge { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.add-area, .form, .merge { margin: 0.75rem 0; }
.form, .merge { flex-direction: column; }
.cats button { border: 1px solid var(--p-content-border-color); background: var(--p-surface-0); border-radius: 999px; padding: 0.35rem 0.9rem; font: inherit; cursor: pointer; }
.cats button.on { background: var(--p-primary-color); color: var(--p-primary-contrast-color); border-color: var(--p-primary-color); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.75rem; margin-top: 1rem; }
.tile { text-align: left; min-height: 84px; padding: 0.85rem; border-radius: 10px; border: 1px solid var(--p-content-border-color); background: var(--p-surface-0); font: inherit; cursor: pointer; display: flex; flex-direction: column; gap: 0.3rem; }
.tile.occupied { border-color: var(--p-primary-color); background: var(--p-primary-50); }
.tile span { color: var(--p-text-muted-color); font-size: 0.85rem; }
.line { display: flex; justify-content: space-between; gap: 0.75rem; align-items: center; }
.form label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.9rem; font-weight: 500; }
</style>
