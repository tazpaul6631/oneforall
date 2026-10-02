<script setup lang="ts">
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { api } from '@/api/http';
import { useSession } from '@/stores/session';
import { dateTime } from '@/utils/format';

interface StockRow { productId: string; variantId: string | null; name: string; sku: string | null; qty: number | null }
interface MoveRow { id: string; name: string; delta: number; reason: string; note: string | null; createdAt: string }
const reasonLabel: Record<string, string> = { in: 'Nhập kho', sale: 'Bán hàng', refund: 'Hoàn / trả' };

const session = useSession();
const toast = useToast();
const items = ref<StockRow[]>([]);
const moves = ref<MoveRow[]>([]);
const loading = ref(true);
const loadError = ref('');
const canEdit = computed(() => ['owner', 'manager'].includes(session.boot?.user.role ?? ''));
const receiving = ref<StockRow | null>(null);
const qty = ref<number | null>(1);
const note = ref('');
const saving = ref(false);

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const data = await api<{ items: StockRow[]; moves: MoveRow[] }>('/inventory');
    items.value = data.items;
    moves.value = data.moves;
  } catch (e: any) {
    loadError.value = e.message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

function openReceive(row: StockRow) {
  receiving.value = row;
  qty.value = 1;
  note.value = '';
}
async function receive() {
  if (!receiving.value || !qty.value) return;
  saving.value = true;
  try {
    const data = await api<{ items: StockRow[]; moves: MoveRow[] }>('/inventory/receive', {
      body: {
        productId: receiving.value.productId,
        variantId: receiving.value.variantId ?? undefined,
        qty: qty.value,
        note: note.value.trim() || undefined,
      },
    });
    items.value = data.items;
    moves.value = data.moves;
    toast.add({ severity: 'success', summary: 'Đã nhập kho', detail: receiving.value.name, life: 2500 });
    receiving.value = null;
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa nhập được kho', detail: e.message, life: 5000 });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="head"><h2>Tồn kho</h2></div>
  <p class="lead">Chỉ sản phẩm đã nhập kho mới bị trừ khi đơn được thanh toán. Chưa nhập nghĩa là chưa theo dõi tồn.</p>
  <p v-if="loadError" class="err">{{ loadError }}</p>
  <DataTable v-else :value="items" :loading="loading" data-key="name" size="small">
    <template #empty>Chưa có sản phẩm đang bán.</template>
    <Column field="name" header="Sản phẩm" />
    <Column header="Mã"><template #body="{ data }">{{ data.sku || '—' }}</template></Column>
    <Column header="Tồn">
      <template #body="{ data }">
        <span :class="{ low: data.qty !== null && data.qty <= 0 }">{{ data.qty === null ? 'Chưa nhập' : data.qty }}</span>
      </template>
    </Column>
    <Column v-if="canEdit" header="">
      <template #body="{ data }"><Button label="Nhập kho" text size="small" @click="openReceive(data)" /></template>
    </Column>
  </DataTable>

  <h3 v-if="moves.length">Phiếu kho gần đây</h3>
  <ul v-if="moves.length" class="moves">
    <li v-for="m in moves" :key="m.id">
      <span>{{ reasonLabel[m.reason] ?? m.reason }} · {{ m.name }}</span>
      <b :class="{ low: m.delta < 0 }">{{ m.delta > 0 ? `+${m.delta}` : m.delta }}</b>
      <small>{{ dateTime(m.createdAt) }}</small>
    </li>
  </ul>

  <Dialog :visible="!!receiving" modal header="Nhập kho" :style="{ width: '24rem' }" @update:visible="receiving = null">
    <form v-if="receiving" class="form" @submit.prevent="qty && receive()">
      <p>{{ receiving.name }}</p>
      <label>Số lượng<InputNumber v-model="qty" :min="1" :max-fraction-digits="0" fluid /></label>
      <label>Ghi chú<InputText v-model="note" fluid /></label>
      <Button type="submit" label="Nhập kho" :loading="saving" :disabled="!qty" fluid />
    </form>
  </Dialog>
</template>

<style scoped>
.head { margin-bottom: 0.35rem; }
.lead { margin: 0 0 1rem; color: var(--p-text-muted-color); max-width: 62ch; }
.err { color: var(--p-red-600); }
.low { color: var(--p-red-600); font-weight: 600; }
h3 { margin: 1.25rem 0 0.5rem; font-size: 0.95rem; }
.moves { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
.moves li { display: grid; grid-template-columns: 1fr auto auto; gap: 1rem; font-size: 0.9rem; }
.moves small { color: var(--p-text-muted-color); }
.form { display: flex; flex-direction: column; gap: 0.9rem; }
.form label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.9rem; font-weight: 500; }
.form p { margin: 0; }
</style>
