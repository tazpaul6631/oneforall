<script setup lang="ts">
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '@/api/http';
import { useSession } from '@/stores/session';

interface UserRow { id: string; fullName: string; email: string; role: 'owner' | 'manager' | 'staff'; active: boolean }

const roleLabel = { owner: 'Chủ cửa hàng', manager: 'Quản lý', staff: 'Nhân viên' } as const;
const roleOptions = [
  { value: 'manager', label: roleLabel.manager },
  { value: 'staff', label: roleLabel.staff },
];

const session = useSession();
const toast = useToast();
const rows = ref<UserRow[]>([]);
const loading = ref(true);
const loadError = ref('');
const dialog = ref(false);
const saving = ref(false);
const form = reactive({ fullName: '', email: '', password: '', role: 'staff' as 'manager' | 'staff' });
const editing = ref<UserRow | null>(null);
const editRole = ref<'manager' | 'staff'>('staff');

const isOwner = computed(() => session.boot?.user.role === 'owner');
const canAdd = computed(() => !!form.fullName && !!form.email && form.password.length >= 8);

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    rows.value = await api<UserRow[]>('/users');
  } catch (e: any) {
    loadError.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  try {
    await api('/users', { body: { ...form } });
    toast.add({ severity: 'success', summary: 'Đã thêm nhân viên', detail: form.fullName, life: 3000 });
    dialog.value = false;
    Object.assign(form, { fullName: '', email: '', password: '', role: 'staff' });
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa thêm được nhân viên', detail: e.message, life: 5000 });
  } finally {
    saving.value = false;
  }
}

function openEdit(row: UserRow) {
  editing.value = row;
  editRole.value = row.role === 'manager' ? 'manager' : 'staff';
}

async function saveRole() {
  if (!editing.value) return;
  try {
    await api(`/users/${editing.value.id}`, { method: 'PATCH', body: { role: editRole.value } });
    toast.add({ severity: 'success', summary: 'Đã đổi vai trò', life: 2500 });
    editing.value = null;
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa đổi được vai trò', detail: e.message, life: 5000 });
  }
}

async function toggleActive(row: UserRow) {
  const next = !row.active;
  const verb = next ? 'mở khóa' : 'khóa';
  if (!window.confirm(`${next ? 'Mở khóa' : 'Khóa'} tài khoản ${row.fullName}?`)) return;
  try {
    await api(`/users/${row.id}`, { method: 'PATCH', body: { active: next } });
    toast.add({ severity: 'success', summary: `Đã ${verb} tài khoản`, life: 2500 });
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: `Chưa ${verb} được`, detail: e.message, life: 5000 });
  }
}

onMounted(load);
</script>

<template>
  <div class="head">
    <h2>Nhân viên</h2>
    <Button v-if="isOwner" label="Thêm nhân viên" icon="pi pi-plus" @click="dialog = true" />
  </div>

  <p v-if="loadError" class="err">{{ loadError }}</p>
  <DataTable v-else :value="rows" :loading="loading" data-key="id" size="small">
    <template #empty>Chưa có nhân viên nào.</template>
    <Column field="fullName" header="Họ tên" />
    <Column field="email" header="Email" />
    <Column header="Vai trò"><template #body="{ data }"><Tag :value="roleLabel[data.role as UserRow['role']]" severity="secondary" /></template></Column>
    <Column header="Trạng thái">
      <template #body="{ data }">
        <Tag :value="data.active ? 'Đang hoạt động' : 'Đã khóa'" :severity="data.active ? 'success' : 'danger'" />
      </template>
    </Column>
    <Column v-if="isOwner" header="">
      <template #body="{ data }">
        <div v-if="data.role !== 'owner'" class="row">
          <Button label="Đổi vai trò" text size="small" @click="openEdit(data)" />
          <Button :label="data.active ? 'Khóa' : 'Mở khóa'" text size="small" :severity="data.active ? 'danger' : 'secondary'" @click="toggleActive(data)" />
        </div>
      </template>
    </Column>
  </DataTable>

  <Dialog v-model:visible="dialog" modal header="Thêm nhân viên" :style="{ width: '26rem' }">
    <form class="form" @submit.prevent="canAdd && save()">
      <label>Họ tên<InputText v-model="form.fullName" fluid /></label>
      <label>Email<InputText v-model="form.email" type="email" fluid /></label>
      <label>Mật khẩu<Password v-model="form.password" :feedback="false" toggle-mask fluid /><small>Ít nhất 8 ký tự</small></label>
      <label>Vai trò<Select v-model="form.role" :options="roleOptions" option-label="label" option-value="value" fluid /></label>
      <Button type="submit" label="Thêm nhân viên" :loading="saving" :disabled="!canAdd" fluid />
    </form>
  </Dialog>

  <Dialog :visible="!!editing" modal header="Đổi vai trò" :style="{ width: '22rem' }" @update:visible="editing = null">
    <form v-if="editing" class="form" @submit.prevent="saveRole">
      <p class="who">{{ editing.fullName }}</p>
      <label>Vai trò<Select v-model="editRole" :options="roleOptions" option-label="label" option-value="value" fluid /></label>
      <Button type="submit" label="Lưu vai trò" fluid />
    </form>
  </Dialog>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 1rem; }
.row { display: flex; gap: 0.25rem; }
.err { color: var(--p-red-600); }
.form { display: flex; flex-direction: column; gap: 1rem; }
.form label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.9rem; font-weight: 500; }
.form small, .who { font-weight: 400; color: var(--p-text-muted-color); margin: 0; }
</style>
