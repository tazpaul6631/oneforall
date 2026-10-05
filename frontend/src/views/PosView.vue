<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import FloatLabel from 'primevue/floatlabel';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api/http';
import type { Category, Customer, ModifierGroup, Order, Preview, Product, Variant } from '@/api/types';
import { useSession } from '@/stores/session';
import { newKey, orderCode, vnd } from '@/utils/format';

interface CartLine { key: string; productId: string; variantId: string | null; optionIds: string[]; name: string; unitPriceVnd: number; qty: number; note: string }

const toast = useToast();
const session = useSession();
const route = useRoute();
const router = useRouter();
const tableId = computed(() => (typeof route.query.table === 'string' ? route.query.table : ''));
const tableLabel = ref('');
const customer = ref<Customer | null>(null);
const customerQuery = ref('');
const customerHits = ref<Customer[]>([]);
const categories = ref<Category[]>([]);
const products = ref<Product[]>([]);
const groups = ref<ModifierGroup[]>([]);
const loadError = ref('');
const activeCat = ref<string | null>(null);
const search = ref('');
const cart = ref<CartLine[]>([]);
const discountType = ref<'percent' | 'amount'>('percent');
const discountValue = ref<number | null>(null);
const preview = ref<Preview | null>(null);
const previewError = ref('');

onMounted(async () => {
  try {
    [products.value, categories.value, groups.value] = await Promise.all([
      api<Product[]>('/products'),
      api<Category[]>('/categories'),
      api<ModifierGroup[]>('/modifier-groups'),
    ]);
    if (tableId.value && session.has('fnb.table_map')) {
      const floor = await api<{ tables: { id: string; name: string }[] }>('/fnb/tables');
      tableLabel.value = floor.tables.find((t) => t.id === tableId.value)?.name ?? '';
    }
  } catch (e: any) {
    loadError.value = e.message;
  }
});

let custTimer: number | undefined;
watch(customerQuery, (q) => {
  clearTimeout(custTimer);
  if (customer.value || !q.trim()) { customerHits.value = []; return; }
  custTimer = window.setTimeout(async () => {
    try { customerHits.value = await api<Customer[]>(`/customers?q=${encodeURIComponent(q.trim())}`); } catch { customerHits.value = []; }
  }, 200);
});

const visible = computed(() =>
  products.value.filter(
    (p) => (!activeCat.value || p.categoryId === activeCat.value) && p.name.toLowerCase().includes(search.value.trim().toLowerCase()),
  ),
);

function groupsOf(p: Product) {
  return groups.value.filter((g) => p.modifierGroupIds.includes(g.id));
}
function lineProduct(l: CartLine) {
  return products.value.find((p) => p.id === l.productId);
}
function lineGroups(l: CartLine) {
  const p = lineProduct(l);
  return p ? groupsOf(p) : [];
}
function describe(p: Product, v: Variant | null, optionIds: string[]) {
  const chosen = groupsOf(p).flatMap((g) => g.options).filter((o) => optionIds.includes(o.id));
  const base = v ? `${p.name} (${v.name})` : p.name;
  return {
    name: chosen.length ? `${base} · ${chosen.map((o) => o.name).join(', ')}` : base,
    unitPriceVnd: (v?.priceVnd ?? p.priceVnd) + chosen.reduce((sum, o) => sum + o.extraVnd, 0),
  };
}
function add(p: Product, v: Variant | null, optionIds: string[]) {
  const ids = [...optionIds];
  const key = `${p.id}:${v?.id ?? ''}:${[...ids].sort().join(',')}`;
  const ex = cart.value.find((l) => l.key === key);
  if (ex) ex.qty = Math.min(999, ex.qty + 1);
  else {
    cart.value.push({
      key, productId: p.id, variantId: v?.id ?? null, optionIds: ids,
      ...describe(p, v, ids), qty: 1, note: '',
    });
  }
}
function pick(p: Product) {
  add(p, null, []);
}
function applyChoice(l: CartLine) {
  const p = lineProduct(l);
  if (!p) return;
  const v = p.variants.find((x) => x.id === l.variantId) ?? null;
  const key = `${p.id}:${v?.id ?? ''}:${[...l.optionIds].sort().join(',')}`;
  const other = cart.value.find((x) => x !== l && x.key === key);
  if (other) {
    other.qty = Math.min(999, other.qty + l.qty);
    cart.value = cart.value.filter((x) => x !== l);
    return;
  }
  l.key = key;
  Object.assign(l, describe(p, v, l.optionIds));
}
function chooseLineVariant(l: CartLine, variantId: string) {
  l.variantId = l.variantId === variantId ? null : variantId;
  applyChoice(l);
}
function toggleLineOption(l: CartLine, group: ModifierGroup, optionId: string) {
  const inGroup = (id: string) => group.options.some((o) => o.id === id);
  const on = l.optionIds.includes(optionId);
  if (group.maxSelect === 1) {
    l.optionIds = l.optionIds.filter((id) => !inGroup(id));
    if (!on) l.optionIds.push(optionId);
  } else if (on) l.optionIds = l.optionIds.filter((id) => id !== optionId);
  else if (l.optionIds.filter(inGroup).length < group.maxSelect) l.optionIds.push(optionId);
  applyChoice(l);
}
const needVariant = computed(() => {
  const line = cart.value.find((l) => {
    const p = lineProduct(l);
    return !!p?.variants.length && !l.variantId;
  });
  const p = line ? lineProduct(line) : undefined;
  return p ? `"${p.name}" cần chọn size` : '';
});
function groupHint(g: ModifierGroup) {
  const min = g.required ? Math.max(g.minSelect, 1) : g.minSelect;
  if (min === g.maxSelect) return `chọn ${g.maxSelect}`;
  if (!min) return `tối đa ${g.maxSelect}`;
  return `chọn ${min}–${g.maxSelect}`;
}
function step(l: CartLine, d: number) {
  l.qty = Math.min(999, l.qty + d);
  if (l.qty <= 0) cart.value = cart.value.filter((x) => x !== l);
}

// ----- tính tiền: luôn hỏi server, không tự tính ở client -----
const payload = computed(() => ({
  lines: cart.value.map((l) => ({
    productId: l.productId,
    variantId: l.variantId ?? undefined,
    qty: l.qty,
    ...(l.optionIds.length ? { optionIds: l.optionIds } : {}),
    ...(l.note.trim() ? { note: l.note.trim() } : {}),
  })),
  discount: discountValue.value ? { type: discountType.value, value: discountValue.value } : undefined,
}));
const pendingOrderId = ref<string | null>(null);
let timer: number | undefined;
let seq = 0;
watch(payload, (p) => {
  pendingOrderId.value = null; // giỏ hàng đổi thì không dùng lại đơn đã tạo
  const mine = ++seq;
  clearTimeout(timer);
  if (!p.lines.length) {
    preview.value = null;
    previewError.value = '';
    return;
  }
  timer = window.setTimeout(async () => {
    try {
      const r = await api<Preview>('/orders/preview', { body: p });
      if (mine === seq) { preview.value = r; previewError.value = ''; }
    } catch (e: any) {
      if (mine === seq) { preview.value = null; previewError.value = e.message; }
    }
  }, 200);
}, { deep: true });

const total = computed(() => preview.value?.totalVnd ?? 0);
const lineTotal = (i: number) => preview.value?.lines[i]?.lineTotalVnd ?? cart.value[i].unitPriceVnd * cart.value[i].qty;
const lineLabel = (i: number) => preview.value?.lines[i]?.name ?? cart.value[i].name;
const linePrice = (i: number) => preview.value?.lines[i]?.unitPriceVnd ?? cart.value[i].unitPriceVnd;
const taxHint = computed(() => {
  const s = session.boot?.settings;
  if (!s || !s.taxRatePercent) return '';
  return s.taxMode === 'inclusive' ? `Thuế ${s.taxRatePercent}% (đã gồm trong giá)` : `Thuế ${s.taxRatePercent}% (cộng thêm)`;
});

// ----- thanh toán -----
const payOpen = ref(false);
const paying = ref(false);
const sending = ref(false);
const cash = ref<number | null>(0);
const transfer = ref<number | null>(0);
const key = ref('');
const quick = [50000, 100000, 200000, 500000];
const sum = computed(() => (cash.value ?? 0) + (transfer.value ?? 0));
const change = computed(() => sum.value - total.value);
const payError = computed(() =>
  sum.value < total.value ? `Còn thiếu ${vnd(total.value - sum.value)}` : (transfer.value ?? 0) > total.value ? 'Chuyển khoản không được vượt quá số cần thu' : '',
);

async function sendToKitchen() {
  if (!preview.value || !tableId.value) return;
  sending.value = true;
  try {
    const created = await api<Order>('/orders', {
      body: { ...payload.value, ...(customer.value ? { customerId: customer.value.id } : {}) },
    });
    await api(`/fnb/tables/${tableId.value}/assign`, { body: { orderId: created.id } });
    toast.add({ severity: 'success', summary: `Đã gửi bếp đơn ${orderCode(created.seq)}`, life: 4000 });
    cart.value = [];
    discountValue.value = null;
    customer.value = null;
    customerQuery.value = '';
    await router.push('/fnb/tables');
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa gửi được bếp', detail: e.message, life: 5000 });
  } finally {
    sending.value = false;
  }
}

function openPay() {
  cash.value = total.value;
  transfer.value = 0;
  key.value = newKey();
  payOpen.value = true;
}

async function confirmPay() {
  if (payError.value) return;
  paying.value = true;
  try {
    if (!pendingOrderId.value) {
      const created = await api<Order>('/orders', {
        body: { ...payload.value, ...(customer.value ? { customerId: customer.value.id } : {}) },
      });
      pendingOrderId.value = created.id;
      if (tableId.value && session.has('fnb.table_map')) {
        try {
          await api(`/fnb/tables/${tableId.value}/assign`, { body: { orderId: created.id } });
        } catch (err: any) {
          toast.add({ severity: 'warn', summary: 'Chưa gán được bàn', detail: err.message, life: 5000 });
        }
      }
    }
    const payments = [
      { method: 'cash', amountVnd: cash.value ?? 0 },
      { method: 'transfer', amountVnd: transfer.value ?? 0 },
    ].filter((p) => p.amountVnd > 0);
    const paid = await api<Order>(`/orders/${pendingOrderId.value}/pay`, { body: { payments, idempotencyKey: key.value } });
    toast.add({
      severity: 'success',
      summary: `Đã thanh toán đơn ${orderCode(paid.seq)}`,
      detail: paid.changeVnd > 0 ? `Tiền thừa trả khách: ${vnd(paid.changeVnd)}` : undefined,
      life: 6000,
    });
    payOpen.value = false;
    cart.value = [];
    discountValue.value = null;
    customer.value = null;
    customerQuery.value = '';
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa thanh toán được', detail: e.message, life: 6000 });
  } finally {
    paying.value = false;
  }
}
</script>

<template>
  <p v-if="loadError" class="text-danger">{{ loadError }}</p>
  <div v-else
    class="grid items-start gap-4 md:grid-cols-[minmax(0,1fr)_340px] md:gap-6 lg:grid-cols-[minmax(0,1fr)_500px]">
    <section class="min-w-0">
      <div class="mb-4 flex flex-col gap-3">
        <FloatLabel variant="on">
          <InputText id="pos-search" v-model="search" fluid />
          <label for="pos-search">Tìm sản phẩm</label>
        </FloatLabel>
        <div class="flex flex-wrap gap-1.5" role="group" aria-label="Danh mục">
          <button type="button" class="chip" :class="!activeCat && 'border-primary bg-primary text-on-primary'" raised
            @click="activeCat = null">Tất cả</button>
          <button v-for="c in categories" :key="c.id" type="button" class="chip"
            :class="activeCat === c.id && 'border-primary bg-primary text-on-primary'" raised
            @click="activeCat = c.id">{{
              c.name }}</button>
        </div>
      </div>
      <p v-if="!products.length" class="my-2 text-muted">Chưa có sản phẩm để bán. Thêm sản phẩm ở mục Sản phẩm.</p>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <button v-for="p in visible" :key="p.id" type="button" class="tile hover:border-primary" raised
          @click="pick(p)">
          <strong>{{ p.name }}</strong>
          <span class="text-sm text-muted">{{ p.variants.length ? `${p.variants.length} size` : vnd(p.priceVnd)
            }}</span>
          <small v-if="p.sku" class="text-sm text-muted">{{ p.sku }}</small>
        </button>
      </div>
    </section>

    <aside class="panel flex flex-col gap-3.5 p-4 md:sticky md:top-4">
      <h3>Đơn hiện tại</h3>
      <p v-if="tableLabel" class="m-0 rounded-lg bg-primary-soft px-3 py-1.5 font-semibold text-primary-ink">{{
        tableLabel }}</p>
      <div class="flex flex-col gap-1.5">
        <template v-if="customer">
          <div class="flex items-center justify-between gap-2">
            <span>{{ customer.name }}<small v-if="customer.phone"> · {{ customer.phone }}</small></span>
            <Button icon="pi pi-times" raised rounded size="small" aria-label="Bỏ khách" @click="customer = null" />
          </div>
        </template>
        <template v-else>
          <FloatLabel variant="on">
            <InputText id="pos-customer" v-model="customerQuery" fluid />
            <label for="pos-customer">Gắn khách (tên hoặc số điện thoại)</label>
          </FloatLabel>
          <button v-for="c in customerHits" :key="c.id" type="button"
            class="w-full cursor-pointer rounded-lg border border-line bg-soft px-2.5 py-2 text-left text-sm hover:border-primary"
            @click="customer = c; customerQuery = ''; customerHits = []">
            {{ c.name }}<span v-if="c.phone" class="text-muted"> · {{ c.phone }}</span>
          </button>
        </template>
      </div>
      <p v-if="!cart.length" class="my-2 text-muted">Chọn sản phẩm bên trái để thêm vào đơn.</p>
      <ul v-else class="m-0 flex max-h-[50dvh] list-none flex-col overflow-y-auto p-0">
        <li v-for="(l, i) in cart" :key="l.key" class="flex flex-col gap-1.5 py-3 text-sm"
          :class="i > 0 && 'border-t border-line'">
          <div class="grid grid-cols-[minmax(0,1fr)_auto_0.4fr] items-center gap-2">
            <div class="flex min-w-0 flex-col"><span class="wrap-break-word">{{ lineLabel(i) }}</span><small
                class="text-muted">{{ vnd(linePrice(i)) }}</small></div>
            <div class="flex items-center gap-0.5">
              <Button icon="pi pi-minus" size="small" raised rounded severity="secondary" :aria-label="`Giảm ${l.name}`"
                @click="step(l, -1)" />
              <span class="min-w-6 text-center">{{ l.qty }}</span>
              <Button icon="pi pi-plus" size="small" raised rounded severity="secondary" :aria-label="`Tăng ${l.name}`"
                @click="step(l, 1)" />
            </div>
            <b class="text-right">{{ vnd(lineTotal(i)) }}</b>
          </div>
          <div class="flex flex-col gap-1.5 pl-3">
            <div v-if="lineProduct(l)?.variants.length" class="flex flex-col gap-1">
              <span class="font-medium">Size<span v-if="!l.variantId" class="text-danger" title="Bắt buộc">
                  *</span></span>
              <div class="flex flex-wrap gap-1">
                <button v-for="v in lineProduct(l)?.variants ?? []" :key="v.id" type="button"
                  class="cursor-pointer rounded-full border px-2.5 py-1 text-sm"
                  :class="l.variantId === v.id ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface'"
                  @click="chooseLineVariant(l, v.id)">{{ v.name }}</button>
              </div>
            </div>
            <div v-for="g in lineGroups(l)" :key="g.id" class="flex flex-col gap-1">
              <span class="font-medium">{{ g.name }}<span v-if="g.required" class="text-danger" title="Bắt buộc">
                  *</span>
                <span class="font-normal text-muted">{{ groupHint(g) }}</span></span>
              <div class="flex flex-wrap gap-1">
                <button v-for="o in g.options" :key="o.id" type="button"
                  class="cursor-pointer rounded-full border px-2.5 py-1 text-sm"
                  :class="l.optionIds.includes(o.id) ? 'border-primary bg-primary text-on-primary' : 'border-line bg-surface'"
                  @click="toggleLineOption(l, g, o.id)">
                  {{ o.name }}<span v-if="o.extraVnd"> +{{ vnd(o.extraVnd) }}</span>
                </button>
              </div>
            </div>
            <FloatLabel variant="on">
              <InputText :id="`line-note-${i}`" v-model="l.note" fluid />
              <label :for="`line-note-${i}`">Ghi chú</label>
            </FloatLabel>
          </div>
        </li>
      </ul>

      <div v-if="cart.length" class="grid grid-cols-[auto_4.5rem_minmax(0,1fr)] items-center gap-2 text-sm">
        <label>Giảm giá</label>
        <Select v-model="discountType" :options="[{ v: 'percent', l: '%' }, { v: 'amount', l: '₫' }]" option-label="l"
          option-value="v" aria-label="Loại giảm giá" />
        <InputNumber v-model="discountValue" class="min-w-0" fluid :min="0"
          :max="discountType === 'percent' ? 100 : undefined" :max-fraction-digits="0" locale="vi-VN" placeholder="0"
          aria-label="Giá trị giảm giá" />
      </div>

      <Message v-if="needVariant" severity="warn" size="small">{{ needVariant }}</Message>
      <Message v-if="previewError" severity="error" size="small">{{ previewError }}</Message>
      <dl v-if="preview" class="m-0 flex flex-col gap-1.5 text-sm">
        <div class="flex justify-between">
          <dt>Tạm tính</dt>
          <dd class="m-0">{{ vnd(preview.subtotalVnd) }}</dd>
        </div>
        <div v-if="preview.discountVnd" class="flex justify-between">
          <dt>Giảm giá</dt>
          <dd class="m-0">−{{ vnd(preview.discountVnd) }}</dd>
        </div>
        <div v-if="taxHint" class="flex justify-between">
          <dt>{{ taxHint }}</dt>
          <dd class="m-0">{{ vnd(preview.taxVnd) }}</dd>
        </div>
        <div class="flex justify-between border-t border-line pt-2 text-lg font-bold">
          <dt>Tổng cộng</dt>
          <dd class="m-0">{{ vnd(preview.totalVnd) }}</dd>
        </div>
      </dl>
      <Button v-if="tableId" label="Gửi bếp" icon="pi pi-send" size="large" fluid severity="secondary" raised
        :loading="sending" :disabled="!preview || !!needVariant" @click="sendToKitchen" />
      <Button label="Thanh toán" icon="pi pi-wallet" size="large" fluid raised
        :disabled="!preview || sending || !!needVariant" @click="openPay" />
    </aside>

    <Dialog v-model:visible="payOpen" modal header="Thanh toán" :style="{ width: 'min(26rem, calc(100vw - 1.5rem))' }">
      <div class="flex flex-col gap-3">
        <div class="flex items-baseline justify-between"><span>Cần thu</span><strong class="text-xl">{{ vnd(total)
            }}</strong></div>
        <label class="field">Tiền mặt khách đưa
          <InputNumber v-model="cash" :min="0" :max-fraction-digits="0" locale="vi-VN" fluid />
        </label>
        <div class="flex flex-wrap gap-1.5">
          <Button label="Đủ" size="small" severity="secondary" outlined raised @click="cash = total; transfer = 0" />
          <Button v-for="q in quick" :key="q" :label="vnd(q)" size="small" severity="secondary" outlined raised
            @click="cash = q" />
        </div>
        <label class="field">Chuyển khoản
          <InputNumber v-model="transfer" :min="0" :max-fraction-digits="0" locale="vi-VN" fluid />
        </label>
        <Button label="Thu đủ bằng chuyển khoản" size="small" severity="secondary" raised
          @click="transfer = total; cash = 0" />
        <Message v-if="payError" severity="warn" size="small">{{ payError }}</Message>
        <div v-else class="flex items-baseline justify-between"><span>Tiền thừa trả khách</span><strong
            class="text-xl">{{
              vnd(Math.max(0, change)) }}</strong></div>
        <Button label="Xác nhận thu tiền" raised :loading="paying" :disabled="!!payError" fluid @click="confirmPay" />
      </div>
    </Dialog>
  </div>
</template>