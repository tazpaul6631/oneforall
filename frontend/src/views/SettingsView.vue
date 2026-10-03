<script setup lang="ts">
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import FloatLabel from 'primevue/floatlabel';
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
  <form class="panel mt-4 flex w-full max-w-xl flex-col items-start gap-4 p-4 sm:p-5"
    @submit.prevent="isOwner && save()">
    <h3>Thuế GTGT</h3>
    <FloatLabel variant="on">
      <InputNumber id="tax-rate-percent" v-model="form.taxRatePercent" :min="0" :max="100" :max-fraction-digits="0"
        :disabled="!isOwner" fluid />
      <label for="tax-rate-percent">Thuế suất (%)</label>
    </FloatLabel>
    <label class="field w-full">Cách tính
      <SelectButton v-model="form.taxMode" :options="modes" option-label="l" option-value="v" :allow-empty="false"
        :disabled="!isOwner" aria-label="Cách tính thuế" />
    </label>
    <p class="m-0 text-sm text-muted">Áp dụng cho các đơn tạo từ bây giờ. Đơn cũ giữ nguyên thuế suất tại thời điểm bán.
    </p>
    <Button v-if="isOwner" type="submit" label="Lưu cài đặt" :loading="saving" fluid raised />
    <p v-else class="m-0 text-sm text-muted">Chỉ chủ cửa hàng được thay đổi cài đặt.</p>
  </form>
</template>