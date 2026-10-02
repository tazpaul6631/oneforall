<script setup lang="ts">
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '@/api/http';
import type { Customer, Order } from '@/api/types';
import { dateTime, newKey, orderCode, vnd } from '@/utils/format';

interface Show { id: string; movieTitle: string; roomName: string; startsAt: string; sold: number; seats: number }
interface Seat { id: string; number: number; kind: 'standard' | 'vip'; label: string; status: 'free' | 'held' | 'sold'; priceVnd: number }
interface Map { id: string; startsAt: string; movieTitle: string; roomName: string; durationMin: number; rows: { label: string; seats: Seat[] }[] }

const toast = useToast();
const shows = ref<Show[]>([]);
const showId = ref<string | null>(null);
const plan = ref<Map | null>(null);
const picked = ref<string[]>([]);
const paying = ref(false);
const customer = ref<Customer | null>(null);
const customerQuery = ref('');
const customerHits = ref<Customer[]>([]);

async function loadShows() {
  const data = await api<{ showtimes: Show[] }>('/cinema/catalog');
  shows.value = data.showtimes;
  if (!showId.value && shows.value[0]) showId.value = shows.value[0].id;
}
async function loadMap(id: string) {
  plan.value = await api<Map>(`/cinema/showtimes/${id}`);
  picked.value = [];
}
onMounted(loadShows);
watch(showId, (id) => { if (id) loadMap(id); });

let custTimer: number | undefined;
watch(customerQuery, (q) => {
  clearTimeout(custTimer);
  if (customer.value || !q.trim()) { customerHits.value = []; return; }
  custTimer = window.setTimeout(async () => {
    try { customerHits.value = await api<Customer[]>(`/customers?q=${encodeURIComponent(q.trim())}`); } catch { customerHits.value = []; }
  }, 200);
});

const selected = computed(() => {
  const seats = plan.value?.rows.flatMap((r) => r.seats) ?? [];
  return seats.filter((s) => picked.value.includes(s.id));
});
const total = computed(() => selected.value.reduce((s, seat) => s + seat.priceVnd, 0));

function toggle(seat: Seat) {
  if (seat.status !== 'free') return;
  picked.value = picked.value.includes(seat.id)
    ? picked.value.filter((id) => id !== seat.id)
    : [...picked.value, seat.id];
}
async function pay() {
  if (!showId.value || !picked.value.length || paying.value) return;
  paying.value = true;
  try {
    const paid = await api<Order>('/cinema/checkout', {
      body: {
        showtimeId: showId.value,
        seatIds: picked.value,
        idempotencyKey: newKey(),
        ...(customer.value ? { customerId: customer.value.id } : {}),
      },
    });
    toast.add({ severity: 'success', summary: `Đã bán vé, đơn ${orderCode(paid.seq)}`, detail: vnd(paid.totalVnd), life: 5000 });
    customer.value = null;
    await loadMap(showId.value);
    await loadShows();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa bán được vé', detail: e.message, life: 5000 });
  } finally {
    paying.value = false;
  }
}
</script>

<template>
  <h2>Bán vé</h2>
  <p class="lead">Chọn suất, chọn ghế trống, rồi thu tiền. Ghế đang giữ hoặc đã bán không chọn được.</p>
  <div class="layout">
    <section>
      <div class="shows">
        <button v-for="s in shows" :key="s.id" type="button" :class="{ on: s.id === showId }" @click="showId = s.id">
          <strong>{{ s.movieTitle }}</strong>
          <span>{{ dateTime(s.startsAt) }} · {{ s.roomName }}</span>
          <small>{{ s.seats - s.sold }} ghế trống</small>
        </button>
      </div>
      <p v-if="!shows.length" class="muted">Chưa có suất. Thêm ở mục Lịch chiếu.</p>
      <div v-if="plan" class="screen">Màn hình</div>
      <div v-for="row in plan?.rows ?? []" :key="row.label" class="row">
        <span class="row-label">{{ row.label }}</span>
        <button
          v-for="seat in row.seats"
          :key="seat.id"
          type="button"
          class="seat"
          :class="[seat.status, seat.kind, { on: picked.includes(seat.id) }]"
          :disabled="seat.status !== 'free'"
          :aria-label="`${seat.label} ${seat.status === 'free' ? 'trống' : 'không bán'}`"
          @click="toggle(seat)"
        >{{ seat.number }}</button>
      </div>
    </section>
    <aside>
      <p v-if="plan" class="who">{{ plan.movieTitle }} · {{ plan.roomName }}</p>
      <div class="customer">
        <template v-if="customer">
          <span>{{ customer.name }}</span>
          <Button icon="pi pi-times" text rounded size="small" aria-label="Bỏ khách" @click="customer = null" />
        </template>
        <template v-else>
          <InputText v-model="customerQuery" placeholder="Gắn khách (không bắt buộc)" aria-label="Tìm khách hàng" fluid />
          <button v-for="c in customerHits" :key="c.id" type="button" class="hit" @click="customer = c; customerQuery = ''">
            {{ c.name }}
          </button>
        </template>
      </div>
      <ul>
        <li v-for="s in selected" :key="s.id"><span>{{ s.label }}<small v-if="s.kind === 'vip'"> VIP</small></span><b>{{ vnd(s.priceVnd) }}</b></li>
      </ul>
      <p v-if="!selected.length" class="muted">Chưa chọn ghế.</p>
      <p class="total">Tổng cộng <strong>{{ vnd(total) }}</strong></p>
      <Button label="Thu tiền mặt" icon="pi pi-wallet" :loading="paying" :disabled="!selected.length" @click="pay" />
    </aside>
  </div>
</template>

<style scoped>
h2 { margin-bottom: 0.35rem; }
.lead, .muted, .who { color: var(--p-text-muted-color); }
.layout { display: grid; grid-template-columns: 1fr 280px; gap: 1.25rem; align-items: start; margin-top: 1rem; }
.shows { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
.shows button, .hit { font: inherit; text-align: left; cursor: pointer; }
.shows button { border: 1px solid var(--p-content-border-color); background: var(--p-surface-0); border-radius: 10px; padding: 0.55rem 0.75rem; display: flex; flex-direction: column; gap: 0.15rem; }
.shows button.on { border-color: var(--p-primary-color); background: var(--p-primary-50); }
.shows small, .seat:disabled { color: var(--p-text-muted-color); }
.screen { text-align: center; letter-spacing: 0.2em; font-size: 0.75rem; text-transform: uppercase; color: var(--p-text-muted-color); border-bottom: 3px solid var(--p-content-border-color); margin: 0.5rem 1.5rem 1rem; padding-bottom: 0.35rem; }
.row { display: flex; gap: 0.35rem; align-items: center; margin-bottom: 0.35rem; }
.row-label { width: 1.2rem; font-weight: 600; color: var(--p-text-muted-color); }
.seat { width: 2rem; height: 2rem; border-radius: 6px 6px 2px 2px; border: 1px solid var(--p-content-border-color); background: var(--p-surface-0); font: inherit; cursor: pointer; }
.seat.vip { border-color: var(--p-primary-color); }
.seat.on { background: var(--p-primary-color); color: var(--p-primary-contrast-color); }
.seat.sold, .seat.held { background: var(--p-surface-100); cursor: not-allowed; }
aside, .customer { display: flex; flex-direction: column; gap: 0.65rem; }
aside { background: var(--p-surface-0); border: 1px solid var(--p-content-border-color); border-radius: 12px; padding: 1rem; }
ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
li, .total { display: flex; justify-content: space-between; gap: 0.5rem; }
.hit { border: 0; background: var(--p-surface-100); border-radius: 8px; padding: 0.35rem 0.5rem; }
@media (max-width: 800px) { .layout { grid-template-columns: 1fr; } }
</style>
