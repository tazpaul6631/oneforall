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
  <div v-if="session.boot" class="flex flex-col gap-5">
    <h2>Xin chào, {{ session.boot.user.name }}</h2>
    <p class="m-0 max-w-[60ch] leading-relaxed text-muted">
      {{ session.boot.tenant.name }} đang dùng gói <strong>{{ session.boot.tenant.presetLabel }}</strong>.
    </p>

    <p v-if="loadError" class="text-danger">{{ loadError }}</p>
    <section v-else class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <article v-for="c in cards" :key="c.label" class="panel flex flex-col gap-1.5 px-4 py-3.5">
        <span class="text-sm text-muted">{{ c.label }}</span>
        <strong class="text-lg sm:text-xl">{{ c.value }}</strong>
      </article>
    </section>

    <section v-if="canAudit && audit.length" class="panel flex flex-col gap-3 p-4 sm:px-5">
      <h3>Hoạt động gần đây</h3>
      <ul class="m-0 flex list-none flex-col gap-2 p-0">
        <li v-for="a in audit" :key="a.id"
          class="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <span>{{ actionLabel[a.action] ?? a.action }}</span>
          <small class="text-muted">{{ dateTime(a.createdAt) }}</small>
        </li>
      </ul>
    </section>

    <section v-for="[g, list] in groups" :key="g" class="panel flex flex-col gap-3 p-4 sm:px-5">
      <h3>{{ groupLabel[g] ?? g }}</h3>
      <div class="flex flex-wrap gap-1.5">
        <Tag v-for="f in list" :key="f" :value="f" severity="secondary" />
      </div>
    </section>
  </div>
</template>