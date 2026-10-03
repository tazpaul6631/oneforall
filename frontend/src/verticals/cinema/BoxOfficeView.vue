<script setup lang="ts">
import Button from 'primevue/button';
import FloatLabel from 'primevue/floatlabel';
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
  <h2 class="mb-1">Bán vé</h2>
  <p class="text-muted">Chọn suất, chọn ghế trống, rồi thu tiền. Ghế đang giữ hoặc đã bán không chọn được.</p>
  <div class="mt-4 grid items-start gap-5 md:grid-cols-[minmax(0,1fr)_260px] lg:grid-cols-[minmax(0,1fr)_280px]">
    <section class="min-w-0">
      <div class="mb-4 flex flex-wrap gap-2">
        <button v-for="s in shows" :key="s.id" type="button" raised
          class="flex cursor-pointer flex-col gap-0.5 rounded-[10px] border border-line bg-surface px-3 py-2 text-left font-[inherit]"
          :class="s.id === showId && 'border-primary bg-primary-soft'" @click="showId = s.id">
          <strong>{{ s.movieTitle }}</strong>
          <span>{{ dateTime(s.startsAt) }} · {{ s.roomName }}</span>
          <small class="text-muted">{{ s.seats - s.sold }} ghế trống</small>
        </button>
      </div>
      <p v-if="!shows.length" class="text-muted">Chưa có suất. Thêm ở mục Lịch chiếu.</p>
      <div v-if="plan"
        class="mx-2 mb-4 border-b-[3px] border-line pb-1 text-center text-xs tracking-[0.2em] text-muted uppercase">Màn
        hình</div>
      <div class="overflow-x-auto">
        <div v-for="row in plan?.rows ?? []" :key="row.label" class="mb-1.5 flex items-center gap-1.5">
          <span class="w-5 font-semibold text-muted">{{ row.label }}</span>
          <button v-for="seat in row.seats" :key="seat.id" type="button" raised
            class="h-8 w-8 shrink-0 cursor-pointer rounded-t-md rounded-b-sm border border-line bg-surface font-[inherit] disabled:cursor-not-allowed disabled:bg-soft disabled:text-muted"
            :class="[
              seat.kind === 'vip' && 'border-primary',
              picked.includes(seat.id) && 'bg-primary text-on-primary',
              (seat.status === 'sold' || seat.status === 'held') && 'bg-soft',
            ]" :disabled="seat.status !== 'free'"
            :aria-label="`${seat.label} ${seat.status === 'free' ? 'trống' : 'không bán'}`" @click="toggle(seat)">{{
              seat.number }}</button>
        </div>
      </div>
    </section>
    <aside class="panel flex flex-col gap-2.5 p-4">
      <p v-if="plan" class="m-0 text-muted">{{ plan.movieTitle }} · {{ plan.roomName }}</p>
      <div class="flex flex-col gap-2">
        <template v-if="customer">
          <div class="flex items-center justify-between gap-2">
            <span>{{ customer.name }}</span>
            <Button icon="pi pi-times" raised rounded size="small" aria-label="Bỏ khách" @click="customer = null" />
          </div>
        </template>
        <template v-else>
          <FloatLabel variant="on">
            <InputText id="box-customer" v-model="customerQuery" fluid />
            <label for="box-customer">Gắn khách (không bắt buộc)</label>
          </FloatLabel>
          <button v-for="c in customerHits" :key="c.id" type="button" raised
            class="cursor-pointer rounded-lg border-0 bg-soft px-2 py-1.5 text-left font-[inherit]"
            @click="customer = c; customerQuery = ''">
            {{ c.name }}
          </button>
        </template>
      </div>
      <ul class="m-0 flex list-none flex-col gap-1.5 p-0">
        <li v-for="s in selected" :key="s.id" class="flex justify-between gap-2"><span>{{ s.label }}<small
              v-if="s.kind === 'vip'"> VIP</small></span><b>{{ vnd(s.priceVnd) }}</b></li>
      </ul>
      <p v-if="!selected.length" class="text-muted">Chưa chọn ghế.</p>
      <p class="m-0 flex justify-between gap-2">Tổng cộng <strong>{{ vnd(total) }}</strong></p>
      <Button label="Thu tiền mặt" icon="pi pi-wallet" raised :loading="paying" :disabled="!selected.length"
        @click="pay" />
    </aside>
  </div>
</template>