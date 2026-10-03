<script setup lang="ts">
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import FloatLabel from 'primevue/floatlabel';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '@/api/http';
import { askConfirm } from '@/components/confirm';
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
  const ok = await askConfirm(`${next ? 'Mở khóa' : 'Khóa'} tài khoản ${row.fullName}?`, {
    acceptLabel: next ? 'Mở khóa' : 'Khóa',
    danger: !next,
  });
  if (!ok) return;
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
  <div class="page-head">
    <h2>Nhân viên</h2>
    <Button v-if="isOwner" label="Thêm nhân viên" icon="pi pi-plus" raised @click="dialog = true" />
  </div>

  <p v-if="loadError" class="text-danger">{{ loadError }}</p>
  <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
    <p v-if="loading" class="m-0 text-sm text-muted md:col-span-2">Đang tải nhân viên...</p>
    <p v-else-if="!rows.length" class="m-0 text-muted md:col-span-2">Chưa có nhân viên nào.</p>
    <article v-for="row in rows" :key="row.id" class="panel flex flex-col gap-2 p-3">
      <div class="flex items-start justify-between gap-2">
        <strong class="min-w-0">{{ row.fullName }}</strong>
        <Tag :value="row.active ? 'Đang hoạt động' : 'Đã khóa'" :severity="row.active ? 'success' : 'danger'" />
      </div>
      <p class="m-0 truncate text-sm text-muted">{{ row.email }}</p>
      <div class="flex items-center justify-between gap-2">
        <Tag :value="roleLabel[row.role]" severity="secondary" />
        <div v-if="isOwner && row.role !== 'owner'" class="flex gap-2">
          <Button label="Đổi vai trò" raised size="small" @click="openEdit(row)" />
          <Button :label="row.active ? 'Khóa' : 'Mở khóa'" raised size="small"
            :severity="row.active ? 'danger' : 'secondary'" @click="toggleActive(row)" />
        </div>
      </div>
    </article>
  </div>
  <DataTable v-if="!loadError" class="hidden! lg:block!" :value="rows" :loading="loading" data-key="id" size="small">
    <template #empty>Chưa có nhân viên nào.</template>
    <Column field="fullName" header="Họ tên" />
    <Column field="email" header="Email" />
    <Column header="Vai trò"><template #body="{ data }">
        <Tag :value="roleLabel[data.role as UserRow['role']]" severity="secondary" />
      </template></Column>
    <Column header="Trạng thái">
      <template #body="{ data }">
        <Tag :value="data.active ? 'Đang hoạt động' : 'Đã khóa'" :severity="data.active ? 'success' : 'danger'" />
      </template>
    </Column>
    <Column v-if="isOwner" header="">
      <template #body="{ data }">
        <div v-if="data.role !== 'owner'" class="flex flex-wrap gap-2">
          <Button label="Đổi vai trò" raised size="small" @click="openEdit(data)" />
          <Button :label="data.active ? 'Khóa' : 'Mở khóa'" raised size="small"
            :severity="data.active ? 'danger' : 'secondary'" @click="toggleActive(data)" />
        </div>
      </template>
    </Column>
  </DataTable>

  <Dialog v-model:visible="dialog" modal header="Thêm nhân viên" :style="{ width: 'min(26rem, calc(100vw - 1.5rem))' }">
    <form class="flex flex-col gap-4" @submit.prevent="canAdd && save()">
      <FloatLabel variant="on">
        <InputText id="staff-name" v-model="form.fullName" fluid />
        <label for="staff-name">Họ tên</label>
      </FloatLabel>
      <FloatLabel variant="on">
        <InputText id="staff-email" v-model="form.email" type="email" fluid />
        <label for="staff-email">Email</label>
      </FloatLabel>
      <FloatLabel variant="on">
        <Password id="staff-password" v-model="form.password" :feedback="false" toggle-mask fluid />
        <label for="staff-password">Mật khẩu</label>
      </FloatLabel>
      <FloatLabel variant="on">
        <Select id="staff-role" v-model="form.role" :options="roleOptions" option-label="label" option-value="value"
          fluid />
        <label for="staff-role">Vai trò</label>
      </FloatLabel>
      <Button type="submit" raised label="Thêm nhân viên" :loading="saving" :disabled="!canAdd" fluid />
    </form>
  </Dialog>

  <Dialog :visible="!!editing" modal header="Đổi vai trò" :style="{ width: 'min(22rem, calc(100vw - 1.5rem))' }"
    @update:visible="editing = null">
    <form v-if="editing" class="flex flex-col gap-4" @submit.prevent="saveRole">
      <p class="m-0 font-normal text-muted">{{ editing.fullName }}</p>
      <label class="field">Vai trò<Select v-model="editRole" :options="roleOptions" option-label="label"
          option-value="value" fluid /></label>
      <Button type="submit" raised label="Lưu vai trò" fluid />
    </form>
  </Dialog>
</template>