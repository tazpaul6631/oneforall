<script setup lang="ts">
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import FloatLabel from 'primevue/floatlabel';
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
  <div class="mb-1">
    <h2>Tồn kho</h2>
  </div>
  <p class="mb-4 max-w-[62ch] text-muted">Chỉ sản phẩm đã nhập kho mới bị trừ khi đơn được thanh toán. Chưa nhập nghĩa
    là chưa theo dõi tồn.</p>
  <p v-if="loadError" class="text-danger">{{ loadError }}</p>
  <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
    <p v-if="loading" class="m-0 text-sm text-muted md:col-span-2">Đang tải tồn kho...</p>
    <p v-else-if="!items.length" class="m-0 text-muted md:col-span-2">Chưa có sản phẩm đang bán.</p>
    <article v-for="item in items" :key="item.name" class="panel flex flex-col gap-3 p-3">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <strong class="block wrap-break-word">{{ item.name }}</strong>
          <p v-if="item.sku" class="m-0 mt-1 text-sm text-muted">{{ item.sku }}</p>
        </div>
        <div class="shrink-0 text-right">
          <span class="block text-xs text-muted">Tồn</span>
          <span class="font-semibold" :class="[
            item.qty === null ? 'text-sm' : 'text-lg leading-none',
            item.qty !== null && item.qty <= 0 && 'text-danger',
          ]">{{ item.qty === null ? 'Chưa nhập' : item.qty }}</span>
        </div>
      </div>
      <Button v-if="canEdit" class="w-full" label="Nhập kho" raised size="small" @click="openReceive(item)" />
    </article>
  </div>
  <DataTable v-if="!loadError" class="hidden! lg:block!" :value="items" :loading="loading" data-key="name" size="small">
    <template #empty>Chưa có sản phẩm đang bán.</template>
    <Column field="name" header="Sản phẩm" />
    <Column header="Mã"><template #body="{ data }">{{ data.sku || '—' }}</template></Column>
    <Column header="Tồn">
      <template #body="{ data }">
        <span :class="data.qty !== null && data.qty <= 0 && 'font-semibold text-danger'">
          {{ data.qty === null ? 'Chưa nhập' : data.qty }}
        </span>
      </template>
    </Column>
    <Column v-if="canEdit" header="">
      <template #body="{ data }"><Button label="Nhập kho" raised size="small" @click="openReceive(data)" /></template>
    </Column>
  </DataTable>

  <h3 v-if="moves.length" class="mt-5 mb-2">Phiếu kho gần đây</h3>
  <ul v-if="moves.length" class="m-0 flex list-none flex-col gap-2 p-0">
    <li v-for="m in moves" :key="m.id" class="panel flex items-start justify-between gap-3 p-3 text-sm">
      <div class="min-w-0">
        <span class="font-medium">{{ reasonLabel[m.reason] ?? m.reason }}</span>
        <p class="m-0 mt-0.5 wrap-break-word">{{ m.name }}</p>
        <p v-if="m.note" class="m-0 mt-0.5 text-muted">{{ m.note }}</p>
        <p class="m-0 mt-1 text-xs text-muted">{{ dateTime(m.createdAt) }}</p>
      </div>
      <b class="shrink-0 text-base" :class="m.delta < 0 ? 'text-danger' : m.delta > 0 ? 'text-ok' : ''">{{ m.delta > 0 ?
        `+${m.delta}` : m.delta }}</b>
    </li>
  </ul>

  <Dialog :visible="!!receiving" modal header="Nhập kho" :style="{ width: 'min(24rem, calc(100vw - 1.5rem))' }"
    @update:visible="receiving = null">
    <form v-if="receiving" class="flex flex-col gap-4" @submit.prevent="qty && receive()">
      <p class="m-0">{{ receiving.name }}</p>
      <FloatLabel variant="on">
        <InputNumber id="stock-qty" v-model="qty" :min="1" :max-fraction-digits="0" fluid />
        <label for="stock-qty">Số lượng</label>
      </FloatLabel>
      <FloatLabel variant="on">
        <InputText id="stock-note" v-model="note" fluid />
        <label for="stock-note">Ghi chú</label>
      </FloatLabel>
      <Button type="submit" raised label="Nhập kho" :loading="saving" :disabled="!qty" />
    </form>
  </Dialog>
</template>