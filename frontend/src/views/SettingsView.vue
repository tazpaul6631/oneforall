<script setup lang="ts">
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import SelectButton from 'primevue/selectbutton';
import { useToast } from 'primevue/usetoast';
import { computed, reactive, ref } from 'vue';
import { api } from '@/api/http';
import { useSession } from '@/stores/session';

const session = useSession();
const toast = useToast();
const isOwner = computed(() => session.boot?.user.role === 'owner');
const saving = ref(false);
const form = reactive({
  taxRatePercent: session.boot?.settings.taxRatePercent ?? 0,
  taxMode: session.boot?.settings.taxMode ?? 'inclusive',
});
const modes = [
  { v: 'inclusive', l: 'Giá đã gồm thuế' },
  { v: 'exclusive', l: 'Cộng thuế vào giá' },
];

async function save() {
  saving.value = true;
  try {
    await api('/platform/settings', { method: 'PATCH', body: { taxRatePercent: form.taxRatePercent ?? 0, taxMode: form.taxMode } });
    await session.loadBootstrap();
    toast.add({ severity: 'success', summary: 'Đã lưu cài đặt thuế', life: 3000 });
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa lưu được cài đặt', detail: e.message, life: 5000 });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <h2>Cài đặt</h2>
  <form class="card" @submit.prevent="isOwner && save()">
    <h3>Thuế GTGT</h3>
    <label>Thuế suất (%)<InputNumber v-model="form.taxRatePercent" :min="0" :max="100" :max-fraction-digits="0" :disabled="!isOwner" /></label>
    <label>Cách tính<SelectButton v-model="form.taxMode" :options="modes" option-label="l" option-value="v" :allow-empty="false" :disabled="!isOwner" aria-label="Cách tính thuế" /></label>
    <p class="hint">Áp dụng cho các đơn tạo từ bây giờ. Đơn cũ giữ nguyên thuế suất tại thời điểm bán.</p>
    <Button v-if="isOwner" type="submit" label="Lưu cài đặt" :loading="saving" />
    <p v-else class="hint">Chỉ chủ cửa hàng được thay đổi cài đặt.</p>
  </form>
</template>

<style scoped>
.card { margin-top: 1rem; max-width: 28rem; background: var(--p-surface-0); border: 1px solid var(--p-content-border-color); border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; align-items: flex-start; }
label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.9rem; font-weight: 500; }
.hint { margin: 0; font-size: 0.85rem; color: var(--p-text-muted-color); }
</style>
