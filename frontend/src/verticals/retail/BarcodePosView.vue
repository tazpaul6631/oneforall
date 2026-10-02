<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import { useToast } from 'primevue/usetoast';
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { api } from '@/api/http';
import type { Order, Preview, Product, Variant } from '@/api/types';
import { newKey, orderCode, vnd } from '@/utils/format';

interface CartLine { key: string; productId: string; variantId: string | null; name: string; unitPriceVnd: number; qty: number }

const toast = useToast();
const code = ref('');
const codeEl = ref<{ $el?: HTMLElement } | null>(null);
function focusScan() {
  const root = codeEl.value?.$el;
  const input = root instanceof HTMLInputElement ? root : root?.querySelector('input');
  input?.focus();
}
const cart = ref<CartLine[]>([]);
const preview = ref<Preview | null>(null);
const previewError = ref('');
const variantFor = ref<Product | null>(null);
const scanError = ref('');

const payload = computed(() => ({
  lines: cart.value.map((l) => ({ productId: l.productId, variantId: l.variantId ?? undefined, qty: l.qty })),
}));
const pendingOrderId = ref<string | null>(null);
let timer: number | undefined;
let seq = 0;
watch(payload, (p) => {
  pendingOrderId.value = null;
  const mine = ++seq;
  clearTimeout(timer);
  if (!p.lines.length) { preview.value = null; previewError.value = ''; return; }
  timer = window.setTimeout(async () => {
    try {
      const r = await api<Preview>('/orders/preview', { body: p });
      if (mine === seq) { preview.value = r; previewError.value = ''; }
    } catch (e: any) {
      if (mine === seq) { preview.value = null; previewError.value = e.message; }
    }
  }, 200);
}, { deep: true });

function add(p: Product, v?: Variant) {
  const key = `${p.id}:${v?.id ?? ''}`;
  const ex = cart.value.find((l) => l.key === key);
  if (ex) ex.qty = Math.min(999, ex.qty + 1);
  else cart.value.push({
    key, productId: p.id, variantId: v?.id ?? null,
    name: v ? `${p.name} (${v.name})` : p.name,
    unitPriceVnd: v?.priceVnd ?? p.priceVnd, qty: 1,
  });
}
async function scan() {
  const value = code.value.trim();
  if (!value) return;
  scanError.value = '';
  try {
    const found = await api<{ product: Product; variant: Variant | null }>(`/retail/lookup?code=${encodeURIComponent(value)}`);
    if (found.variant) add(found.product, found.variant);
    else if (found.product.variants.length) variantFor.value = found.product;
    else add(found.product);
    code.value = '';
  } catch (e: any) {
    scanError.value = e.message;
  } finally {
    await nextTick();
    focusScan();
  }
}
function step(l: CartLine, d: number) {
  l.qty = Math.min(999, l.qty + d);
  if (l.qty <= 0) cart.value = cart.value.filter((x) => x !== l);
}

const payOpen = ref(false);
const paying = ref(false);
const cash = ref<number | null>(0);
const payKey = ref('');
const total = computed(() => preview.value?.totalVnd ?? 0);
const payError = computed(() => (cash.value ?? 0) < total.value ? `Còn thiếu ${vnd(total.value - (cash.value ?? 0))}` : '');

function openPay() {
  cash.value = total.value;
  payKey.value = newKey();
  payOpen.value = true;
}
async function confirmPay() {
  if (payError.value) return;
  paying.value = true;
  try {
    if (!pendingOrderId.value) {
      const created = await api<Order>('/orders', { body: payload.value });
      pendingOrderId.value = created.id;
    }
    const paid = await api<Order>(`/orders/${pendingOrderId.value}/pay`, {
      body: { payments: [{ method: 'cash', amountVnd: cash.value ?? 0 }], idempotencyKey: payKey.value },
    });
    toast.add({
      severity: 'success',
      summary: `Đã thanh toán đơn ${orderCode(paid.seq)}`,
      detail: paid.changeVnd > 0 ? `Tiền thừa: ${vnd(paid.changeVnd)}` : undefined,
      life: 5000,
    });
    payOpen.value = false;
    cart.value = [];
    focusScan();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa thanh toán được', detail: e.message, life: 5000 });
  } finally {
    paying.value = false;
  }
}
onMounted(() => focusScan());
</script>

<template>
  <h2>Bán hàng (mã vạch)</h2>
  <p class="lead">Quét mã hoặc gõ SKU rồi Enter. Mã nằm trên sản phẩm và từng phiên bản.</p>
  <div class="layout">
    <section>
      <form class="scan" @submit.prevent="scan">
        <InputText ref="codeEl" v-model="code" placeholder="Quét hoặc nhập mã" aria-label="Mã vạch" fluid />
        <Button type="submit" label="Thêm" :disabled="!code.trim()" />
      </form>
      <Message v-if="scanError" severity="warn">{{ scanError }}</Message>
      <p v-if="!cart.length" class="muted">Giỏ đang trống.</p>
      <ul>
        <li v-for="l in cart" :key="l.key">
          <span>{{ l.name }}</span>
          <span class="qty">
            <Button icon="pi pi-minus" text rounded size="small" :aria-label="`Giảm ${l.name}`" @click="step(l, -1)" />
            {{ l.qty }}
            <Button icon="pi pi-plus" text rounded size="small" :aria-label="`Tăng ${l.name}`" @click="step(l, 1)" />
          </span>
          <b>{{ vnd(l.unitPriceVnd * l.qty) }}</b>
        </li>
      </ul>
    </section>
    <aside>
      <Message v-if="previewError" severity="error" size="small">{{ previewError }}</Message>
      <p v-if="preview" class="total">Tổng cộng <strong>{{ vnd(preview.totalVnd) }}</strong></p>
      <Button label="Thanh toán" icon="pi pi-wallet" :disabled="!preview" @click="openPay" />
    </aside>
  </div>

  <Dialog :visible="!!variantFor" modal :header="variantFor?.name" :style="{ width: '22rem' }" @update:visible="variantFor = null">
    <div class="form">
      <Button v-for="v in variantFor?.variants" :key="v.id" :label="`${v.name}${v.sku ? ' · ' + v.sku : ''} · ${vnd(v.priceVnd)}`" severity="secondary" outlined fluid @click="variantFor && add(variantFor, v); variantFor = null" />
    </div>
  </Dialog>

  <Dialog v-model:visible="payOpen" modal header="Thanh toán" :style="{ width: '24rem' }">
    <div class="form">
      <p class="total">Cần thu <strong>{{ vnd(total) }}</strong></p>
      <label>Tiền mặt<InputNumber v-model="cash" :min="0" :max-fraction-digits="0" locale="vi-VN" fluid /></label>
      <Message v-if="payError" severity="warn" size="small">{{ payError }}</Message>
      <p v-else>Tiền thừa {{ vnd(Math.max(0, (cash ?? 0) - total)) }}</p>
      <Button label="Xác nhận thu tiền" :loading="paying" :disabled="!!payError" fluid @click="confirmPay" />
    </div>
  </Dialog>
</template>

<style scoped>
h2 { margin-bottom: 0.35rem; }
.lead, .muted { color: var(--p-text-muted-color); }
.layout { display: grid; grid-template-columns: 1fr 260px; gap: 1.25rem; align-items: start; }
.scan { display: flex; gap: 0.5rem; margin-bottom: 0.75rem; }
ul { list-style: none; margin: 0.5rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.45rem; }
li { display: grid; grid-template-columns: 1fr auto auto; gap: 0.5rem; align-items: center; }
.qty { display: flex; align-items: center; }
aside, .form { display: flex; flex-direction: column; gap: 0.75rem; }
aside { background: var(--p-surface-0); border: 1px solid var(--p-content-border-color); border-radius: 12px; padding: 1rem; }
.total { display: flex; justify-content: space-between; margin: 0; }
.form label { display: flex; flex-direction: column; gap: 0.35rem; font-weight: 500; }
@media (max-width: 800px) { .layout { grid-template-columns: 1fr; } }
</style>
