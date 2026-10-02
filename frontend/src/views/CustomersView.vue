<script setup lang="ts">
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
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
  <div class="head">
    <h2>Khách hàng</h2>
    <div class="actions">
      <InputText v-model="q" placeholder="Tìm tên hoặc số điện thoại" aria-label="Tìm khách hàng" />
      <Button label="Thêm khách" icon="pi pi-plus" @click="openNew" />
    </div>
  </div>
  <p v-if="loadError" class="err">{{ loadError }}</p>
  <DataTable v-else :value="rows" :loading="loading" data-key="id" size="small">
    <template #empty>Chưa có khách hàng.</template>
    <Column field="name" header="Tên" />
    <Column header="Điện thoại"><template #body="{ data }">{{ data.phone || '—' }}</template></Column>
    <Column header="Email"><template #body="{ data }">{{ data.email || '—' }}</template></Column>
    <Column header=""><template #body="{ data }"><Button label="Sửa" text size="small" @click="openEdit(data)" /></template></Column>
  </DataTable>

  <Dialog v-model:visible="dialog" modal :header="editingId ? 'Sửa khách hàng' : 'Thêm khách hàng'" :style="{ width: '26rem' }">
    <form class="form" @submit.prevent="form.name.trim() && save()">
      <label>Tên<InputText v-model="form.name" fluid /></label>
      <label>Điện thoại<InputText v-model="form.phone" fluid /></label>
      <label>Email<InputText v-model="form.email" type="email" fluid /></label>
      <label>Ghi chú<Textarea v-model="form.note" rows="2" fluid /></label>
      <Button type="submit" label="Lưu khách hàng" :loading="saving" :disabled="!form.name.trim()" fluid />
    </form>
  </Dialog>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 1rem; flex-wrap: wrap; }
.actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.err { color: var(--p-red-600); }
.form { display: flex; flex-direction: column; gap: 1rem; }
.form label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.9rem; font-weight: 500; }
</style>
