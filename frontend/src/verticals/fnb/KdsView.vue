<script setup lang="ts">
import Button from 'primevue/button';
import { onMounted, onUnmounted, ref } from 'vue';
import { api } from '@/api/http';
import { orderCode } from '@/utils/format';

interface Ticket {
  id: string;
  orderId: string;
  seq: number;
  status: 'queued' | 'cooking' | 'ready' | 'served';
  lines: { id: string; name: string; qty: number }[];
}
const label = { queued: 'Chờ làm', cooking: 'Đang làm', ready: 'Sẵn sàng', served: 'Đã ra món' } as const;
const next: Record<Ticket['status'], Ticket['status'] | null> = { queued: 'cooking', cooking: 'ready', ready: 'served', served: null };
const nextLabel = { queued: 'Bắt đầu làm', cooking: 'Xong', ready: 'Đã phục vụ', served: '' };

const tickets = ref<Ticket[]>([]);
const loadError = ref('');
let timer: number | undefined;

async function load() {
  try {
    tickets.value = (await api<{ tickets: Ticket[] }>('/fnb/kds')).tickets;
    loadError.value = '';
  } catch (e: any) {
    loadError.value = e.message;
  }
}
async function advance(t: Ticket) {
  const status = next[t.status];
  if (!status) return;
  tickets.value = (await api<{ tickets: Ticket[] }>(`/fnb/kds/${t.id}`, { method: 'PATCH', body: { status } })).tickets;
}
onMounted(() => {
  load();
  timer = window.setInterval(load, 4000);
});
onUnmounted(() => clearInterval(timer));
</script>

<template>
  <h2 class="mb-1">Màn hình bếp</h2>
  <p class="mb-4 text-muted">Phiếu được tạo khi có đơn mới. Thanh toán hoặc hủy đơn sẽ đưa phiếu ra khỏi hàng chờ.</p>
  <p v-if="loadError" class="text-danger">{{ loadError }}</p>
  <p v-else-if="!tickets.length" class="mb-4 text-muted">Chưa có món nào chờ làm.</p>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
    <article v-for="t in tickets" :key="t.id" class="panel flex flex-col gap-2.5 p-3.5"
      :class="{ 'border-warn': t.status === 'cooking', 'border-ok': t.status === 'ready' }">
      <header class="flex items-center justify-between gap-2">
        <strong>Đơn {{ orderCode(t.seq) }}</strong>
        <span class="text-sm text-muted">{{ label[t.status] }}</span>
      </header>
      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        <li v-for="l in t.lines" :key="l.id"><b class="inline-block min-w-6">{{ l.qty }}</b> {{ l.name }}</li>
      </ul>
      <Button v-if="next[t.status]" raised :label="nextLabel[t.status]" @click="advance(t)" />
    </article>
  </div>
</template>