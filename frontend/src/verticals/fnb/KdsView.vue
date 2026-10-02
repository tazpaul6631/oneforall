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
  <h2>Màn hình bếp</h2>
  <p class="lead">Phiếu được tạo khi có đơn mới. Thanh toán hoặc hủy đơn sẽ đưa phiếu ra khỏi hàng chờ.</p>
  <p v-if="loadError" class="err">{{ loadError }}</p>
  <p v-else-if="!tickets.length" class="muted">Chưa có món nào chờ làm.</p>
  <div class="board">
    <article v-for="t in tickets" :key="t.id" :class="t.status">
      <header>
        <strong>Đơn {{ orderCode(t.seq) }}</strong>
        <span>{{ label[t.status] }}</span>
      </header>
      <ul>
        <li v-for="l in t.lines" :key="l.id"><b>{{ l.qty }}</b> {{ l.name }}</li>
      </ul>
      <Button v-if="next[t.status]" :label="nextLabel[t.status]" @click="advance(t)" />
    </article>
  </div>
</template>

<style scoped>
h2 { margin-bottom: 0.35rem; }
.lead, .muted { color: var(--p-text-muted-color); margin: 0 0 1rem; }
.err { color: var(--p-red-600); }
.board { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.75rem; }
article { background: var(--p-surface-0); border: 1px solid var(--p-content-border-color); border-radius: 12px; padding: 0.9rem; display: flex; flex-direction: column; gap: 0.6rem; }
article.cooking { border-color: var(--p-orange-400); }
article.ready { border-color: var(--p-green-500); }
header { display: flex; justify-content: space-between; gap: 0.5rem; }
header span { color: var(--p-text-muted-color); font-size: 0.85rem; }
ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.3rem; }
li b { display: inline-block; min-width: 1.4rem; }
</style>
