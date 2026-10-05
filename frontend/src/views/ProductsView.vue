<script setup lang="ts">
import Button from 'primevue/button';
import Column from 'primevue/column';
import DataTable from 'primevue/datatable';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import FloatLabel from 'primevue/floatlabel';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, reactive, ref } from 'vue';
import { api } from '@/api/http';
import { askConfirm } from '@/components/confirm';
import type { Category, ModifierGroup, Product } from '@/api/types';
import { useSession } from '@/stores/session';
import { vnd } from '@/utils/format';

const session = useSession();
const toast = useToast();
const products = ref<Product[]>([]);
const categories = ref<Category[]>([]);
const groups = ref<ModifierGroup[]>([]);
const loading = ref(true);
const loadError = ref('');
const canEdit = computed(() => ['owner', 'manager'].includes(session.boot?.user.role ?? ''));
const catName = (id: string | null) => categories.value.find((c) => c.id === id)?.name ?? '—';
const groupNames = (ids: string[]) => ids.map((id) => groups.value.find((g) => g.id === id)?.name).filter(Boolean).join(', ');

async function load() {
  loading.value = true;
  loadError.value = '';
  try {
    [products.value, categories.value, groups.value] = await Promise.all([
      api<Product[]>('/products?includeInactive=true'),
      api<Category[]>('/categories'),
      api<ModifierGroup[]>('/modifier-groups'),
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
  modifierGroupIds: [] as string[],
});
const canSave = computed(() => !!form.name.trim() && form.priceVnd !== null);

function openNew() {
  editingId.value = null;
  Object.assign(form, { name: '', sku: '', priceVnd: null, categoryId: null, variants: [], modifierGroupIds: [] });
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
    modifierGroupIds: [...p.modifierGroupIds],
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
    modifierGroupIds: form.modifierGroupIds,
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
async function deleteProduct(p: Product) {
  if (!await askConfirm(`Xóa sản phẩm “${p.name}”?`)) return;
  try {
    await api(`/products/${p.id}`, { method: 'DELETE' });
    toast.add({ severity: 'success', summary: 'Đã xóa sản phẩm', life: 2000 });
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa xóa được sản phẩm', detail: e.message, life: 5000 });
  }
}
const groupDialog = ref(false);
const editingGroup = ref<string | null>(null);
const groupForm = reactive({
  name: '',
  required: false,
  minSelect: 0,
  maxSelect: 1,
  options: [{ name: '', extraVnd: 0 }] as { name: string; extraVnd: number | null }[],
});
const canSaveGroup = computed(() =>
  !!groupForm.name.trim()
  && groupForm.maxSelect >= Math.max(groupForm.minSelect, groupForm.required ? 1 : 0)
  && groupForm.options.some((o) => o.name.trim() && o.extraVnd !== null),
);

function resetGroup() {
  editingGroup.value = null;
  Object.assign(groupForm, { name: '', required: false, minSelect: 0, maxSelect: 1, options: [{ name: '', extraVnd: 0 }] });
}
function openGroup(g: ModifierGroup) {
  editingGroup.value = g.id;
  Object.assign(groupForm, {
    name: g.name,
    required: g.required,
    minSelect: g.minSelect,
    maxSelect: g.maxSelect,
    options: g.options.map((o) => ({ name: o.name, extraVnd: o.extraVnd })),
  });
}
async function saveGroup() {
  const body = {
    name: groupForm.name.trim(),
    required: groupForm.required,
    minSelect: groupForm.required ? Math.max(groupForm.minSelect, 1) : groupForm.minSelect,
    maxSelect: groupForm.maxSelect,
    options: groupForm.options.filter((o) => o.name.trim() && o.extraVnd !== null).map((o) => ({ name: o.name.trim(), extraVnd: o.extraVnd })),
  };
  try {
    if (editingGroup.value) await api(`/modifier-groups/${editingGroup.value}`, { method: 'PATCH', body });
    else await api('/modifier-groups', { body });
    toast.add({ severity: 'success', summary: editingGroup.value ? 'Đã lưu nhóm món kèm' : 'Đã thêm nhóm món kèm', life: 2500 });
    resetGroup();
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa lưu được nhóm món kèm', detail: e.message, life: 5000 });
  }
}
async function removeGroup(g: ModifierGroup) {
  if (!await askConfirm(`Xóa nhóm “${g.name}”? Món đang gán nhóm này sẽ bỏ món kèm.`)) return;
  try {
    await api(`/modifier-groups/${g.id}`, { method: 'DELETE' });
    if (editingGroup.value === g.id) resetGroup();
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa xóa được nhóm', detail: e.message, life: 5000 });
  }
}

async function deleteCategory(c: Category) {
  if (!await askConfirm(`Xóa danh mục “${c.name}”? Sản phẩm trong danh mục sẽ chuyển thành không phân loại.`)) return;
  try {
    await api(`/categories/${c.id}`, { method: 'DELETE' });
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa xóa được danh mục', detail: e.message, life: 5000 });
  }
}
</script>

<template>
  <div class="page-head">
    <h2>Sản phẩm</h2>
    <div v-if="canEdit" class="flex flex-wrap gap-2">
      <Button label="Danh mục" severity="secondary" outlined raised @click="catDialog = true" />
      <Button label="Món kèm" severity="secondary" outlined raised @click="groupDialog = true" />
      <Button label="Thêm sản phẩm" icon="pi pi-plus" raised @click="openNew" />
    </div>
  </div>

  <p v-if="loadError" class="text-danger">{{ loadError }}</p>
  <div v-else class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:hidden">
    <p v-if="loading" class="m-0 text-sm text-muted md:col-span-2">Đang tải sản phẩm...</p>
    <p v-else-if="!products.length" class="m-0 text-muted md:col-span-2">
      Chưa có sản phẩm. {{ canEdit ? 'Bấm “Thêm sản phẩm” để tạo sản phẩm đầu tiên.' : '' }}
    </p>
    <article v-for="p in products" :key="p.id" class="panel flex flex-col gap-2 p-3">
      <div class="flex items-start justify-between gap-2">
        <strong class="min-w-0">{{ p.name }}</strong>
        <Tag :value="p.active ? 'Đang bán' : 'Ngừng bán'" :severity="p.active ? 'success' : 'secondary'" />
      </div>
      <p class="m-0 text-sm text-muted">{{ catName(p.categoryId) }}<span v-if="p.sku"> · {{ p.sku }}</span></p>
      <p v-if="p.variants.length" class="m-0 text-sm">{{p.variants.map((v) => v.name).join(', ')}}</p>
      <p v-if="groupNames(p.modifierGroupIds)" class="m-0 text-sm text-muted">Món kèm: {{ groupNames(p.modifierGroupIds)
        }}</p>
      <div class="flex items-center justify-between gap-2">
        <strong>{{ vnd(p.priceVnd) }}</strong>
        <div v-if="canEdit" class="flex flex-wrap justify-end gap-2">
          <Button icon="pi pi-trash" raised severity="danger" size="small" aria-label="Xóa sản phẩm"
            @click="deleteProduct(p)" />
          <Button icon="pi pi-pen-to-square" severity="secondary" raised size="small" @click="openEdit(p)" />
          <Button :icon="p.active ? 'pi pi-check-circle' : 'pi pi-times-circle'" raised size="small"
            :severity="p.active ? 'success' : 'warning'" @click="toggleActive(p)" />
        </div>
      </div>
    </article>
  </div>
  <DataTable v-if="!loadError" class="hidden! lg:block!" :value="products" :loading="loading" data-key="id"
    size="small">
    <template #empty>Chưa có sản phẩm. {{ canEdit ? 'Bấm “Thêm sản phẩm” để tạo sản phẩm đầu tiên.' : '' }}</template>
    <Column field="name" header="Tên" />
    <Column header="Mã"><template #body="{ data }">{{ data.sku || '—' }}</template></Column>
    <Column header="Danh mục"><template #body="{ data }">{{ catName(data.categoryId) }}</template></Column>
    <Column header="Giá"><template #body="{ data }">{{ vnd(data.priceVnd) }}</template></Column>
    <Column header="Size"><template #body="{ data }">{{data.variants.map((v: any) => v.name).join(', ') || '—'
    }}</template></Column>
    <Column header="Món kèm"><template #body="{ data }">{{ groupNames(data.modifierGroupIds) || '—' }}</template>
    </Column>
    <Column header="Trạng thái"><template #body="{ data }">
        <Tag :value="data.active ? 'Đang bán' : 'Ngừng bán'" :severity="data.active ? 'success' : 'secondary'" />
      </template>
    </Column>
    <Column v-if="canEdit" header="">
      <template #body="{ data }">
        <div class="flex flex-wrap gap-2">
          <Button :icon="data.active ? 'pi pi-check-circle' : 'pi pi-times-circle'" raised size="small"
            :severity="data.active ? 'success' : 'warning'" @click="toggleActive(data)" />
          <Button icon="pi pi-pen-to-square" severity="secondary" raised size="small" @click="openEdit(data)" />
          <Button icon="pi pi-trash" raised severity="danger" size="small" aria-label="Xóa sản phẩm"
            @click="deleteProduct(data)" />
        </div>
      </template>
    </Column>
  </DataTable>

  <Dialog v-model:visible="dialog" modal content-class="dialog-pin"
    :header="editingId ? 'Sửa sản phẩm' : 'Thêm sản phẩm'" :style="{ width: 'min(30rem, calc(100vw - 1.5rem))' }">
    <form class="flex min-h-0 min-w-0 flex-col gap-4 overflow-hidden" @submit.prevent="canSave && save()">
      <div class="flex shrink-0 flex-col gap-4">
        <FloatLabel variant="on">
          <InputText id="product-name" v-model="form.name" fluid />
          <label for="product-name">Tên sản phẩm</label>
        </FloatLabel>
        <FloatLabel variant="on">
          <InputText id="product-sku" v-model="form.sku" fluid />
          <label for="product-sku">Mã SKU / mã vạch</label>
        </FloatLabel>
        <FloatLabel variant="on">
          <InputNumber id="product-price" v-model="form.priceVnd" :min="0" :max-fraction-digits="0" locale="vi-VN"
            fluid />
          <label for="product-price">Giá bán (đồng)</label>
        </FloatLabel>
        <FloatLabel variant="on">
          <Select input-id="product-category" v-model="form.categoryId" :options="categories" option-label="name"
            option-value="id" show-clear fluid />
          <label for="product-category">Danh mục</label>
        </FloatLabel>
      </div>
      <div class="flex min-w-0 flex-col gap-2 overflow-hidden rounded-lg border border-line p-3" role="group"
        aria-labelledby="product-modifiers" :class="groups.length ? 'min-h-0' : 'shrink-0'">
        <p id="product-modifiers" class="m-0 shrink-0 text-sm font-medium">Món kèm</p>
        <p v-if="!groups.length" class="m-0 text-sm text-muted">Chưa có nhóm. Bấm “Món kèm” để tạo nhóm dùng chung.</p>
        <div v-else class="flex min-h-0 flex-col gap-2 overflow-y-auto">
          <label v-for="g in groups" :key="g.id" class="flex min-w-0 shrink-0 items-center gap-2 text-sm font-normal">
            <input v-model="form.modifierGroupIds" class="shrink-0" type="checkbox" :value="g.id" />
            <span class="min-w-0">{{ g.name }}<span class="text-muted">{{ g.required ? ' · bắt buộc' : ''
            }}</span></span>
          </label>
        </div>
      </div>

      <div class="flex min-h-0 min-w-0 flex-col gap-2 overflow-hidden rounded-lg border border-line p-3" role="group"
        aria-labelledby="product-variants">
        <p id="product-variants" class="m-0 shrink-0 text-sm font-medium">Size</p>
        <div class="flex min-h-0 flex-col gap-2 overflow-y-auto max-h-[10rem]">
          <div v-for="(v, i) in form.variants" :key="i"
            class="grid shrink-0 grid-cols-[minmax(0,1.1fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] items-end gap-2">
            <FloatLabel variant="on" class="min-w-0">
              <InputText :id="`variant-name-${i}`" v-model="v.name" fluid />
              <label :for="`variant-name-${i}`">Tên</label>
            </FloatLabel>
            <FloatLabel variant="on" class="min-w-0">
              <InputText :id="`variant-sku-${i}`" v-model="v.sku" fluid />
              <label :for="`variant-sku-${i}`">Mã</label>
            </FloatLabel>
            <FloatLabel variant="on" class="min-w-0">
              <InputNumber v-model="v.priceVnd" class="min-w-0" fluid :min="0" :max-fraction-digits="0" locale="vi-VN"
                aria-label="Giá" />
              <label :for="`variant-price-${i}`">Giá</label>
            </FloatLabel>
            <Button icon="pi pi-trash" raised severity="danger" aria-label="Xóa" @click="form.variants.splice(i, 1)" />
          </div>
        </div>
        <Button class="shrink-0 self-start" label="Thêm" icon="pi pi-plus" raised size="small"
          @click="form.variants.push({ name: '', sku: '', priceVnd: form.priceVnd })" />
      </div>

      <Button class="shrink-0" type="submit" raised label="Lưu sản phẩm" :loading="saving" :disabled="!canSave" fluid />
    </form>
  </Dialog>

  <Dialog v-model:visible="catDialog" modal header="Danh mục" content-class="dialog-pin"
    :style="{ width: 'min(28rem, calc(100vw - 1.5rem))' }">
    <div class="flex min-h-0 flex-col gap-4 overflow-hidden max-h-[30rem]">
      <ul class="m-0 flex min-h-0 list-none flex-col gap-2 overflow-y-auto p-0">
        <li v-for="c in categories" :key="c.id"
          class="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_auto] items-end gap-2">
          <FloatLabel variant="on" class="min-w-0">
            <InputText :id="`category-${c.id}`" v-model="c.name" fluid @keydown.enter.prevent="renameCategory(c)" />
            <label :for="`category-${c.id}`">Tên danh mục</label>
          </FloatLabel>
          <Button label="Lưu" raised @click="renameCategory(c)" />
          <Button icon="pi pi-trash" raised severity="danger" aria-label="Xóa danh mục" @click="deleteCategory(c)" />
        </li>
      </ul>
      <p v-if="!categories.length" class="m-0 shrink-0 text-muted">Chưa có danh mục.</p>
      <form class="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-end"
        @submit.prevent="catName_.trim() && addCategory()">
        <FloatLabel variant="on" class="min-w-0 w-full">
          <InputText id="category-new" v-model="catName_" fluid />
          <label for="category-new">Tên danh mục mới</label>
        </FloatLabel>
        <Button type="submit" raised label="Thêm" :disabled="!catName_.trim()" />
      </form>
    </div>
  </Dialog>

  <Dialog v-model:visible="groupDialog" modal header="Món kèm" content-class="dialog-pin"
    :style="{ width: 'min(32rem, calc(100vw - 1.5rem))' }" @hide="resetGroup">
    <div class="flex min-h-0 flex-col gap-4 overflow-hidden">
      <ul v-if="groups.length" class="m-0 flex min-h-0 list-none flex-col gap-2 overflow-y-auto max-h-[10rem] p-0">
        <li v-for="g in groups" :key="g.id" class="flex shrink-0 items-center justify-between gap-2">
          <span class="min-w-0">{{ g.name }}<small class="block text-muted">{{g.options.map((o) => o.name).join(', ')
              }}</small></span>
          <div class="flex shrink-0 gap-2">
            <Button label="Sửa" raised size="small" @click="openGroup(g)" />
            <Button icon="pi pi-trash" raised severity="danger" size="small" aria-label="Xóa nhóm"
              @click="removeGroup(g)" />
          </div>
        </li>
      </ul>
      <p v-else class="m-0 shrink-0 text-muted">Chưa có nhóm món kèm.</p>
      <form class="flex min-h-0 flex-col gap-3 overflow-hidden" @submit.prevent="canSaveGroup && saveGroup()">
        <div class="flex shrink-0 flex-col gap-3">
          <FloatLabel variant="on">
            <InputText id="group-name" v-model="groupForm.name" fluid />
            <label for="group-name">Tên nhóm, ví dụ Topping</label>
          </FloatLabel>
          <label class="flex items-center gap-2 text-sm font-normal">
            <input v-model="groupForm.required" type="checkbox" />
            Bắt buộc chọn
          </label>
          <div class="grid grid-cols-2 gap-2">
            <FloatLabel variant="on">
              <InputNumber id="group-min-select" v-model="groupForm.minSelect" :min="0" :max="20"
                :max-fraction-digits="0" fluid />
              <label for="group-min-select">Tối thiểu</label>
            </FloatLabel>
            <FloatLabel variant="on">
              <InputNumber id="group-max-select" v-model="groupForm.maxSelect" :min="1" :max="20"
                :max-fraction-digits="0" fluid />
              <label for="group-max-select">Tối đa</label>
            </FloatLabel>
          </div>
        </div>
        <div class="flex min-h-0 flex-col gap-2 overflow-y-auto max-h-[15rem]">
          <div v-for="(o, i) in groupForm.options" :key="i"
            class="grid shrink-0 grid-cols-[minmax(0,1fr)_7.5rem_auto] items-end gap-2 pt-1 pb-1">
            <FloatLabel variant="on" class="min-w-0">
              <InputText :id="`option-name-${i}`" v-model="o.name" fluid />
              <label :for="`option-name-${i}`">Tên món kèm</label>
            </FloatLabel>
            <FloatLabel variant="on" class="min-w-0">
              <InputNumber :input-id="`option-extra-${i}`" v-model="o.extraVnd" fluid :min="0" :max-fraction-digits="0"
                locale="vi-VN" />
              <label :for="`option-extra-${i}`">Cộng thêm</label>
            </FloatLabel>
            <Button icon="pi pi-trash" raised severity="danger" aria-label="Xóa món kèm"
              @click="groupForm.options.splice(i, 1)" />
          </div>
        </div>
        <Button class="shrink-0 self-start" label="Thêm lựa chọn" raised size="small"
          @click="groupForm.options.push({ name: '', extraVnd: 0 })" />
        <div class="flex shrink-0 flex-col gap-2 sm:flex-row">
          <Button v-if="editingGroup" class="sm:w-auto" label="Hủy sửa" severity="secondary" outlined raised
            @click="resetGroup" />
          <Button type="submit" raised :label="editingGroup ? 'Lưu nhóm' : 'Thêm nhóm'" :disabled="!canSaveGroup"
            fluid />
        </div>
      </form>
    </div>
  </Dialog>
</template>