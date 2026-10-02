<script setup lang="ts">
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '@/api/http';
import type { Category, Product } from '@/api/types';
import { useSession } from '@/stores/session';
import { vnd } from '@/utils/format';

const session = useSession();
const toast = useToast();
const products = ref<Product[]>([]);
const categories = ref<Category[]>([]);
const loading = ref(true);
const loadError = ref('');
const canEdit = computed(() => ['owner', 'manager'].includes(session.boot?.user.role ?? ''));
const catName = (id: string | null) => categories.value.find((c) => c.id === id)?.name ?? '—';

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    [products.value, categories.value] = await Promise.all([
      api<Product[]>('/products?includeInactive=true'),
      api<Category[]>('/categories'),
    ]);
  } catch (e: any) {
    loadError.value = e.message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

// ----- thêm/sửa sản phẩm -----
const dialog = ref(false);
const saving = ref(false);
const editingId = ref<string | null>(null);
const form = reactive({
  name: '',
  sku: '',
  priceVnd: null as number | null,
  categoryId: null as string | null,
  variants: [] as { name: string; sku: string; priceVnd: number | null }[],
});
const canSave = computed(() => !!form.name.trim() && form.priceVnd !== null);

function openNew() {
  editingId.value = null;
  Object.assign(form, { name: '', sku: '', priceVnd: null, categoryId: null, variants: [] });
  dialog.value = true;
}
function openEdit(p: Product) {
  editingId.value = p.id;
  Object.assign(form, {
    name: p.name,
    sku: p.sku ?? '',
    priceVnd: p.priceVnd,
    categoryId: p.categoryId,
    variants: p.variants.map((v) => ({ name: v.name, sku: v.sku ?? '', priceVnd: v.priceVnd })),
  });
  dialog.value = true;
}
async function save() {
  saving.value = true;
  const body = {
    name: form.name.trim(),
    sku: form.sku.trim(),
    priceVnd: form.priceVnd,
    categoryId: form.categoryId,
    variants: form.variants.filter((v) => v.name.trim() && v.priceVnd !== null).map((v) => ({ name: v.name.trim(), sku: v.sku.trim(), priceVnd: v.priceVnd })),
  };
  try {
    if (editingId.value) await api(`/products/${editingId.value}`, { method: 'PATCH', body });
    else await api('/products', { body });
    toast.add({ severity: 'success', summary: editingId.value ? 'Đã lưu sản phẩm' : 'Đã thêm sản phẩm', detail: body.name, life: 3000 });
    dialog.value = false;
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa lưu được sản phẩm', detail: e.message, life: 5000 });
  } finally {
    saving.value = false;
  }
}
async function toggleActive(p: Product) {
  try {
    await api(`/products/${p.id}`, { method: 'PATCH', body: { active: !p.active } });
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa cập nhật được', detail: e.message, life: 5000 });
  }
}

// ----- danh mục -----
const catDialog = ref(false);
const catName_ = ref('');
async function addCategory() {
  try {
    await api('/categories', { body: { name: catName_.value } });
    catName_.value = '';
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa thêm được danh mục', detail: e.message, life: 5000 });
  }
}
async function renameCategory(c: Category) {
  try {
    await api(`/categories/${c.id}`, { method: 'PATCH', body: { name: c.name } });
    toast.add({ severity: 'success', summary: 'Đã lưu danh mục', life: 2000 });
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa sửa được danh mục', detail: e.message, life: 5000 });
    await load();
  }
}
async function deleteCategory(c: Category) {
  if (!window.confirm(`Xóa danh mục “${c.name}”? Sản phẩm trong danh mục sẽ chuyển thành không phân loại.`)) return;
  try {
    await api(`/categories/${c.id}`, { method: 'DELETE' });
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa xóa được danh mục', detail: e.message, life: 5000 });
  }
}
</script>

<template>
  <div class="head">
    <h2>Sản phẩm</h2>
    <div v-if="canEdit" class="actions">
      <Button label="Danh mục" severity="secondary" outlined @click="catDialog = true" />
      <Button label="Thêm sản phẩm" icon="pi pi-plus" @click="openNew" />
    </div>
  </div>

  <p v-if="loadError" class="err">{{ loadError }}</p>
  <DataTable v-else :value="products" :loading="loading" data-key="id" size="small">
    <template #empty>Chưa có sản phẩm. {{ canEdit ? 'Bấm “Thêm sản phẩm” để tạo sản phẩm đầu tiên.' : '' }}</template>
    <Column field="name" header="Tên" />
    <Column header="Mã"><template #body="{ data }">{{ data.sku || '—' }}</template></Column>
    <Column header="Danh mục"><template #body="{ data }">{{ catName(data.categoryId) }}</template></Column>
    <Column header="Giá"><template #body="{ data }">{{ vnd(data.priceVnd) }}</template></Column>
    <Column header="Phiên bản"><template #body="{ data }">{{ data.variants.map((v: any) => v.name).join(', ') || '—' }}</template></Column>
    <Column header="Trạng thái"><template #body="{ data }"><Tag :value="data.active ? 'Đang bán' : 'Ngừng bán'" :severity="data.active ? 'success' : 'secondary'" /></template></Column>
    <Column v-if="canEdit" header="">
      <template #body="{ data }">
        <div class="row">
          <Button label="Sửa" text size="small" @click="openEdit(data)" />
          <Button :label="data.active ? 'Ngừng bán' : 'Bán lại'" text size="small" severity="secondary" @click="toggleActive(data)" />
        </div>
      </template>
    </Column>
  </DataTable>

  <Dialog v-model:visible="dialog" modal :header="editingId ? 'Sửa sản phẩm' : 'Thêm sản phẩm'" :style="{ width: '30rem' }">
    <form class="form" @submit.prevent="canSave && save()">
      <label>Tên sản phẩm<InputText v-model="form.name" fluid /></label>
      <label>Mã SKU / mã vạch<InputText v-model="form.sku" fluid /></label>
      <label>Giá bán (đồng)<InputNumber v-model="form.priceVnd" :min="0" :max-fraction-digits="0" locale="vi-VN" fluid /></label>
      <label>Danh mục<Select v-model="form.categoryId" :options="categories" option-label="name" option-value="id" placeholder="Không phân loại" show-clear fluid /></label>

      <fieldset class="variants">
        <legend>Phiên bản (size, màu...)</legend>
        <div v-for="(v, i) in form.variants" :key="i" class="vrow">
          <InputText v-model="v.name" placeholder="Tên, ví dụ L" aria-label="Tên phiên bản" />
          <InputText v-model="v.sku" placeholder="Mã" aria-label="Mã phiên bản" />
          <InputNumber v-model="v.priceVnd" :min="0" :max-fraction-digits="0" locale="vi-VN" placeholder="Giá" aria-label="Giá phiên bản" />
          <Button icon="pi pi-trash" text severity="secondary" aria-label="Xóa phiên bản" @click="form.variants.splice(i, 1)" />
        </div>
        <Button label="Thêm phiên bản" icon="pi pi-plus" text size="small" @click="form.variants.push({ name: '', sku: '', priceVnd: form.priceVnd })" />
      </fieldset>

      <Button type="submit" label="Lưu sản phẩm" :loading="saving" :disabled="!canSave" fluid />
    </form>
  </Dialog>

  <Dialog v-model:visible="catDialog" modal header="Danh mục" :style="{ width: '28rem' }">
    <ul class="cats">
      <li v-for="c in categories" :key="c.id">
        <InputText v-model="c.name" fluid aria-label="Tên danh mục" @keydown.enter.prevent="renameCategory(c)" />
        <Button label="Lưu" text @click="renameCategory(c)" />
        <Button icon="pi pi-trash" text severity="danger" aria-label="Xóa danh mục" @click="deleteCategory(c)" />
      </li>
    </ul>
    <p v-if="!categories.length" class="muted">Chưa có danh mục.</p>
    <form class="form addcat" @submit.prevent="catName_.trim() && addCategory()">
      <InputText v-model="catName_" placeholder="Tên danh mục mới" fluid aria-label="Tên danh mục mới" />
      <Button type="submit" label="Thêm" :disabled="!catName_.trim()" />
    </form>
  </Dialog>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 1rem; flex-wrap: wrap; }
.actions, .row { display: flex; gap: 0.5rem; }
.err { color: var(--p-red-600); }
.form { display: flex; flex-direction: column; gap: 1rem; }
.form label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.9rem; font-weight: 500; }
.variants { border: 1px solid var(--p-content-border-color); border-radius: 8px; padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
.variants legend { font-size: 0.9rem; font-weight: 500; padding: 0 0.25rem; }
.vrow { display: grid; grid-template-columns: 1fr 0.8fr 1fr auto; gap: 0.5rem; align-items: center; }
.cats { list-style: none; margin: 0 0 1rem; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
.cats li { display: grid; grid-template-columns: 1fr auto auto; gap: 0.25rem; align-items: center; }
.addcat { flex-direction: row; align-items: center; }
.muted { color: var(--p-text-muted-color); margin: 0 0 0.75rem; }
</style>
