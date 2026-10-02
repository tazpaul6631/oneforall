<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Select from 'primevue/select';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api/http';
import type { Category, Customer, Order, Preview, Product, Variant } from '@/api/types';
import { useSession } from '@/stores/session';
import { newKey, orderCode, vnd } from '@/utils/format';

interface CartLine { key: string; productId: string; variantId: string | null; name: string; unitPriceVnd: number; qty: number }

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
const loadError = ref('');
const activeCat = ref<string | null>(null);
const search = ref('');
const cart = ref<CartLine[]>([]);
const discountType = ref<'percent' | 'amount'>('percent');
const discountValue = ref<number | null>(null);
const preview = ref<Preview | null>(null);
const previewError = ref('');
const variantFor = ref<Product | null>(null);

onMounted(async () => {
  try {
    [products.value, categories.value] = await Promise.all([api<Product[]>('/products'), api<Category[]>('/categories')]);
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

function add(p: Product, v?: Variant) {
  const key = `${p.id}:${v?.id ?? ''}`;
  const ex = cart.value.find((l) => l.key === key);
  if (ex) ex.qty = Math.min(999, ex.qty + 1);
  else cart.value.push({ key, productId: p.id, variantId: v?.id ?? null, name: v ? `${p.name} (${v.name})` : p.name, unitPriceVnd: v?.priceVnd ?? p.priceVnd, qty: 1 });
}
function pick(p: Product) {
  if (p.variants.length) variantFor.value = p;
  else add(p);
}
function chooseVariant(v: Variant) {
  if (variantFor.value) add(variantFor.value, v);
  variantFor.value = null;
}
function step(l: CartLine, d: number) {
  l.qty = Math.min(999, l.qty + d);
  if (l.qty <= 0) cart.value = cart.value.filter((x) => x !== l);
}

// ----- tính tiền: luôn hỏi server, không tự tính ở client -----
const payload = computed(() => ({
  lines: cart.value.map((l) => ({ productId: l.productId, variantId: l.variantId ?? undefined, qty: l.qty })),
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
  <p v-if="loadError" class="err">{{ loadError }}</p>
  <div v-else class="pos">
    <section class="catalog">
      <div class="bar">
        <InputText v-model="search" placeholder="Tìm sản phẩm" aria-label="Tìm sản phẩm" />
        <div class="cats" role="group" aria-label="Danh mục">
          <button :class="{ on: !activeCat }" @click="activeCat = null">Tất cả</button>
          <button v-for="c in categories" :key="c.id" :class="{ on: activeCat === c.id }" @click="activeCat = c.id">{{ c.name }}</button>
        </div>
      </div>
      <p v-if="!products.length" class="muted">Chưa có sản phẩm để bán. Thêm sản phẩm ở mục Sản phẩm.</p>
      <div class="grid">
        <button v-for="p in visible" :key="p.id" class="tile" @click="pick(p)">
          <strong>{{ p.name }}</strong>
          <span>{{ p.variants.length ? `${p.variants.length} phiên bản` : vnd(p.priceVnd) }}</span>
          <small v-if="p.sku">{{ p.sku }}</small>
        </button>
      </div>
    </section>

    <aside class="cart">
      <h3>Đơn hiện tại</h3>
      <p v-if="tableLabel" class="banner">{{ tableLabel }}</p>
      <div class="customer">
        <template v-if="customer">
          <span>{{ customer.name }}<small v-if="customer.phone"> · {{ customer.phone }}</small></span>
          <Button icon="pi pi-times" text rounded size="small" aria-label="Bỏ khách" @click="customer = null" />
        </template>
        <template v-else>
          <InputText v-model="customerQuery" placeholder="Gắn khách (tên hoặc số điện thoại)" aria-label="Tìm khách hàng" fluid />
          <button v-for="c in customerHits" :key="c.id" type="button" class="hit" @click="customer = c; customerQuery = ''; customerHits = []">
            {{ c.name }}<small v-if="c.phone"> · {{ c.phone }}</small>
          </button>
        </template>
      </div>
      <p v-if="!cart.length" class="muted">Chọn sản phẩm bên trái để thêm vào đơn.</p>
      <ul v-else>
        <li v-for="(l, i) in cart" :key="l.key">
          <div class="name"><span>{{ l.name }}</span><small>{{ vnd(l.unitPriceVnd) }}</small></div>
          <div class="qty">
            <Button icon="pi pi-minus" size="small" text rounded severity="secondary" :aria-label="`Giảm ${l.name}`" @click="step(l, -1)" />
            <span>{{ l.qty }}</span>
            <Button icon="pi pi-plus" size="small" text rounded severity="secondary" :aria-label="`Tăng ${l.name}`" @click="step(l, 1)" />
          </div>
          <b>{{ vnd(lineTotal(i)) }}</b>
        </li>
      </ul>

      <div v-if="cart.length" class="discount">
        <label>Giảm giá</label>
        <Select v-model="discountType" :options="[{ v: 'percent', l: '%' }, { v: 'amount', l: '₫' }]" option-label="l" option-value="v" aria-label="Loại giảm giá" />
        <InputNumber v-model="discountValue" :min="0" :max="discountType === 'percent' ? 100 : undefined" :max-fraction-digits="0" locale="vi-VN" placeholder="0" aria-label="Giá trị giảm giá" />
      </div>

      <Message v-if="previewError" severity="error" size="small">{{ previewError }}</Message>
      <dl v-if="preview" class="sum">
        <div><dt>Tạm tính</dt><dd>{{ vnd(preview.subtotalVnd) }}</dd></div>
        <div v-if="preview.discountVnd"><dt>Giảm giá</dt><dd>−{{ vnd(preview.discountVnd) }}</dd></div>
        <div v-if="taxHint"><dt>{{ taxHint }}</dt><dd>{{ vnd(preview.taxVnd) }}</dd></div>
        <div class="grand"><dt>Tổng cộng</dt><dd>{{ vnd(preview.totalVnd) }}</dd></div>
      </dl>
      <Button v-if="tableId" label="Gửi bếp" icon="pi pi-send" size="large" fluid severity="secondary" :loading="sending" :disabled="!preview" @click="sendToKitchen" />
      <Button label="Thanh toán" icon="pi pi-wallet" size="large" fluid :disabled="!preview || sending" @click="openPay" />
    </aside>

    <Dialog :visible="!!variantFor" modal :header="variantFor?.name" :style="{ width: '22rem' }" @update:visible="variantFor = null">
      <div class="variants">
        <Button v-for="v in variantFor?.variants" :key="v.id" :label="`${v.name} · ${vnd(v.priceVnd)}`" severity="secondary" outlined fluid @click="chooseVariant(v)" />
      </div>
    </Dialog>

    <Dialog v-model:visible="payOpen" modal header="Thanh toán" :style="{ width: '26rem' }">
      <div class="pay">
        <div class="due"><span>Cần thu</span><strong>{{ vnd(total) }}</strong></div>
        <label>Tiền mặt khách đưa
          <InputNumber v-model="cash" :min="0" :max-fraction-digits="0" locale="vi-VN" fluid />
        </label>
        <div class="quick">
          <Button label="Đủ" size="small" severity="secondary" outlined @click="cash = total; transfer = 0" />
          <Button v-for="q in quick" :key="q" :label="vnd(q)" size="small" severity="secondary" outlined @click="cash = q" />
        </div>
        <label>Chuyển khoản
          <InputNumber v-model="transfer" :min="0" :max-fraction-digits="0" locale="vi-VN" fluid />
        </label>
        <Button label="Thu đủ bằng chuyển khoản" size="small" severity="secondary" text @click="transfer = total; cash = 0" />
        <Message v-if="payError" severity="warn" size="small">{{ payError }}</Message>
        <div v-else class="due"><span>Tiền thừa trả khách</span><strong>{{ vnd(Math.max(0, change)) }}</strong></div>
        <Button label="Xác nhận thu tiền" :loading="paying" :disabled="!!payError" fluid @click="confirmPay" />
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.pos { display: grid; grid-template-columns: 1fr 340px; gap: 1.5rem; align-items: start; }
.err { color: var(--p-red-600); }
.muted { color: var(--p-text-muted-color); margin: 0.5rem 0; }
.bar { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1rem; }
.cats { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.cats button { border: 1px solid var(--p-content-border-color); background: var(--p-surface-0); border-radius: 999px; padding: 0.35rem 0.9rem; font: inherit; font-size: 0.85rem; cursor: pointer; }
.cats button.on { background: var(--p-primary-color); border-color: var(--p-primary-color); color: var(--p-primary-contrast-color); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.75rem; }
.tile { display: flex; flex-direction: column; gap: 0.35rem; text-align: left; min-height: 84px; padding: 0.85rem; border: 1px solid var(--p-content-border-color); border-radius: 10px; background: var(--p-surface-0); font: inherit; cursor: pointer; }
.tile:hover { border-color: var(--p-primary-color); }
.tile span, .tile small { color: var(--p-text-muted-color); font-size: 0.85rem; }
.banner { margin: 0; background: var(--p-primary-50); color: var(--p-primary-700); border-radius: 8px; padding: 0.4rem 0.7rem; font-weight: 600; }
.customer { display: flex; flex-direction: column; gap: 0.35rem; }
.customer > span { display: flex; align-items: center; justify-content: space-between; }
.hit { text-align: left; border: 0; background: var(--p-surface-100); border-radius: 8px; padding: 0.4rem 0.6rem; font: inherit; cursor: pointer; }
.cart { position: sticky; top: 1.5rem; background: var(--p-surface-0); border: 1px solid var(--p-content-border-color); border-radius: 12px; padding: 1.1rem; display: flex; flex-direction: column; gap: 0.9rem; }
.cart ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; max-height: 40vh; overflow-y: auto; }
.cart li { display: grid; grid-template-columns: 1fr auto auto; gap: 0.5rem; align-items: center; font-size: 0.9rem; }
.name { display: flex; flex-direction: column; }
.name small { color: var(--p-text-muted-color); }
.qty { display: flex; align-items: center; gap: 0.1rem; }
.qty span { min-width: 1.4rem; text-align: center; }
.discount { display: grid; grid-template-columns: auto 5rem 1fr; gap: 0.5rem; align-items: center; font-size: 0.9rem; }
.sum { margin: 0; display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.9rem; }
.sum div { display: flex; justify-content: space-between; }
.sum dd { margin: 0; }
.sum .grand { font-size: 1.15rem; font-weight: 700; padding-top: 0.5rem; border-top: 1px solid var(--p-content-border-color); }
.variants, .pay { display: flex; flex-direction: column; gap: 0.75rem; }
.pay label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.9rem; font-weight: 500; }
.due { display: flex; justify-content: space-between; align-items: baseline; }
.due strong { font-size: 1.25rem; }
.quick { display: flex; flex-wrap: wrap; gap: 0.4rem; }
@media (max-width: 960px) { .pos { grid-template-columns: 1fr; } .cart { position: static; } }
</style>
