<script setup lang="ts">
import Tag from 'primevue/tag';
import { computed, onMounted, ref } from 'vue';
import { api } from '@/api/http';
import type { SalesSummary } from '@/api/types';
import { useSession } from '@/stores/session';
import { dateTime, vnd } from '@/utils/format';

interface AuditRow { id: string; action: string; entityType: string; entityId: string; createdAt: string }

const actionLabel: Record<string, string> = {
  'order.created': 'Tạo đơn',
  'order.paid': 'Thu tiền',
  'order.voided': 'Hủy đơn',
  'order.refunded': 'Hoàn tiền',
  'user.updated': 'Cập nhật nhân viên',
  'stock.received': 'Nhập kho',
};

const session = useSession();
const groupLabel: Record<string, string> = { core: 'Nền tảng', fnb: 'Nhà hàng / quán cà phê', retail: 'Bán lẻ' };
const summary = ref<SalesSummary | null>(null);
const audit = ref<AuditRow[]>([]);
const loadError = ref('');
const canAudit = computed(() => ['owner', 'manager'].includes(session.boot?.user.role ?? ''));

const groups = computed(() => {
  const m = new Map<string, string[]>();
  for (const f of session.boot?.features ?? []) {
    const g = f.split('.')[0];
    m.set(g, [...(m.get(g) ?? []), f]);
  }
  return [...m.entries()];
});

const cards = computed(() => {
  const s = summary.value;
  if (!s) return [];
  return [
    { label: 'Doanh thu hôm nay', value: vnd(s.todayRevenueVnd) },
    { label: 'Đơn đã thu hôm nay', value: String(s.todayPaidCount) },
    { label: 'Đơn đang mở', value: String(s.openCount) },
    { label: 'Tổng đơn đã thu', value: String(s.paidCount) },
  ];
});

onMounted(async () => {
  try {
    summary.value = await api<SalesSummary>('/orders/summary');
    if (canAudit.value) audit.value = (await api<AuditRow[]>('/audit')).slice(0, 8);
  } catch (e: any) {
    loadError.value = e.message;
  }
});
</script>

<template>
  <div v-if="session.boot" class="wrap">
    <h2>Xin chào, {{ session.boot.user.name }}</h2>
    <p class="lead">
      {{ session.boot.tenant.name }} đang dùng gói <strong>{{ session.boot.tenant.presetLabel }}</strong>.
    </p>

    <p v-if="loadError" class="err">{{ loadError }}</p>
    <section v-else class="stats">
      <article v-for="c in cards" :key="c.label">
        <span>{{ c.label }}</span>
        <strong>{{ c.value }}</strong>
      </article>
    </section>

    <section v-if="canAudit && audit.length" class="group">
      <h3>Hoạt động gần đây</h3>
      <ul>
        <li v-for="a in audit" :key="a.id">
          <span>{{ actionLabel[a.action] ?? a.action }}</span>
          <small>{{ dateTime(a.createdAt) }}</small>
        </li>
      </ul>
    </section>

    <section v-for="[g, list] in groups" :key="g" class="group">
      <h3>{{ groupLabel[g] ?? g }}</h3>
      <div class="tags"><Tag v-for="f in list" :key="f" :value="f" severity="secondary" /></div>
    </section>
  </div>
</template>

<style scoped>
.wrap { display: flex; flex-direction: column; gap: 1.25rem; }
.lead { margin: 0; max-width: 60ch; line-height: 1.6; color: var(--p-text-muted-color); }
.err { color: var(--p-red-600); }
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.75rem; }
.stats article { background: var(--p-surface-0); border: 1px solid var(--p-content-border-color); border-radius: 10px; padding: 0.9rem 1rem; display: flex; flex-direction: column; gap: 0.35rem; }
.stats span { color: var(--p-text-muted-color); font-size: 0.85rem; }
.stats strong { font-size: 1.25rem; }
.group { background: var(--p-surface-0); border: 1px solid var(--p-content-border-color); border-radius: 10px; padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
.group h3 { font-size: 0.95rem; }
.group ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
.group li { display: flex; justify-content: space-between; gap: 1rem; font-size: 0.9rem; }
.group small { color: var(--p-text-muted-color); }
.tags { display: flex; flex-wrap: wrap; gap: 0.4rem; }
</style>
