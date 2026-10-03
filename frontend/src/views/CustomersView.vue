<script setup lang="ts">
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import FloatLabel from 'primevue/floatlabel';
import InputText from 'primevue/inputtext';
import Textarea from 'primevue/textarea';
import { useToast } from 'primevue/usetoast';
import { onMounted, reactive, ref, watch } from 'vue';
import { api } from '@/api/http';
import type { Customer } from '@/api/types';

const toast = useToast();
const rows = ref<Customer[]>([]);
const q = ref('');
const loading = ref(true);
const loadError = ref('');
const dialog = ref(false);
const saving = ref(false);
const editingId = ref<string | null>(null);
const form = reactive({ name: '', phone: '', email: '', note: '' });

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    const query = q.value.trim() ? `?q=${encodeURIComponent(q.value.trim())}` : '';
    rows.value = await api<Customer[]>(`/customers${query}`);
  } catch (e: any) {
    loadError.value = e.message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
let timer: number | undefined;
watch(q, () => {
  clearTimeout(timer);
  timer = window.setTimeout(load, 200);
});

function openNew() {
  editingId.value = null;
  Object.assign(form, { name: '', phone: '', email: '', note: '' });
  dialog.value = true;
}
function openEdit(c: Customer) {
  editingId.value = c.id;
  Object.assign(form, { name: c.name, phone: c.phone ?? '', email: c.email ?? '', note: c.note ?? '' });
  dialog.value = true;
}
async function save() {
  saving.value = true;
  const body = { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim(), note: form.note.trim() };
  try {
    if (editingId.value) await api(`/customers/${editingId.value}`, { method: 'PATCH', body });
    else await api('/customers', { body });
    toast.add({ severity: 'success', summary: editingId.value ? 'Đã lưu khách hàng' : 'Đã thêm khách hàng', life: 2500 });
    dialog.value = false;
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa lưu được khách hàng', detail: e.message, life: 5000 });
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="page-head">
    <h2>Khách hàng</h2>
    <div class="flex w-full min-w-0 flex-col items-start gap-2 sm:w-auto sm:flex-row sm:items-center">
      <div class="relative w-fit max-w-full">
        <span class="invisible flex h-[38px] items-center whitespace-nowrap px-3" aria-hidden="true">Tìm tên hoặc số điện thoại</span>
        <FloatLabel variant="on" class="absolute! inset-0! mt-0!">
          <InputText id="customer-search" v-model="q" fluid />
          <label for="customer-search">Tìm tên hoặc số điện thoại</label>
        </FloatLabel>
      </div>
      <Button class="w-fit" label="Thêm khách" icon="pi pi-plus" raised @click="openNew" />
    </div>
  </div>
  <p v-if="loadError" class="text-danger">{{ loadError }}</p>
  <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
    <p v-if="loading" class="m-0 text-sm text-muted md:col-span-2">Đang tải khách hàng...</p>
    <p v-else-if="!rows.length" class="m-0 text-muted md:col-span-2">Chưa có khách hàng.</p>
    <article v-for="c in rows" :key="c.id" class="panel flex flex-col gap-2 p-3">
      <div class="flex items-start justify-between gap-2">
        <strong class="min-w-0">{{ c.name }}</strong>
        <Button label="Sửa" raised size="small" @click="openEdit(c)" />
      </div>
      <p class="m-0 text-sm text-muted">{{ c.phone || 'Chưa có số' }}</p>
      <p class="m-0 truncate text-sm text-muted">{{ c.email || 'Chưa có email' }}</p>
    </article>
  </div>
  <DataTable v-if="!loadError" class="hidden! lg:block!" :value="rows" :loading="loading" data-key="id" size="small">
    <template #empty>Chưa có khách hàng.</template>
    <Column field="name" header="Tên" />
    <Column header="Điện thoại"><template #body="{ data }">{{ data.phone || '—' }}</template></Column>
    <Column header="Email"><template #body="{ data }">{{ data.email || '—' }}</template></Column>
    <Column header=""><template #body="{ data }"><Button label="Sửa" raised size="small"
          @click="openEdit(data)" /></template>
    </Column>
  </DataTable>

  <Dialog v-model:visible="dialog" modal :header="editingId ? 'Sửa khách hàng' : 'Thêm khách hàng'"
    :style="{ width: 'min(26rem, calc(100vw - 1.5rem))' }">
    <form class="flex flex-col gap-4" @submit.prevent="form.name.trim() && save()">
      <FloatLabel variant="on">
        <InputText id="customer-name" v-model="form.name" fluid />
        <label for="customer-name">Tên</label>
      </FloatLabel>
      <FloatLabel variant="on">
        <InputText id="customer-phone" v-model="form.phone" fluid />
        <label for="customer-phone">Điện thoại</label>
      </FloatLabel>
      <FloatLabel variant="on">
        <InputText id="customer-email" v-model="form.email" type="email" fluid />
        <label for="customer-email">Email</label>
      </FloatLabel>
      <FloatLabel variant="on">
        <Textarea id="customer-note" v-model="form.note" rows="2" fluid />
        <label for="customer-note">Ghi chú</label>
      </FloatLabel>
      <Button type="submit" raised label="Lưu khách hàng" :loading="saving" :disabled="!form.name.trim()" fluid />
    </form>
  </Dialog>
</template>