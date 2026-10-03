<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import FloatLabel from 'primevue/floatlabel';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { api } from '@/api/http';
import { askConfirm } from '@/components/confirm';
import type { Product } from '@/api/types';
import { useSession } from '@/stores/session';

interface Item { name: string; qty: number | null; unit: string }
interface Recipe { id: string; productId: string; name: string; items: { id: string; name: string; qty: number; unit: string }[] }

const session = useSession();
const toast = useToast();
const products = ref<Product[]>([]);
const recipes = ref<Recipe[]>([]);
const loadError = ref('');
const dialog = ref(false);
const saving = ref(false);
const productId = ref<string | null>(null);
const items = ref<Item[]>([{ name: '', qty: 1, unit: 'g' }]);
const canEdit = computed(() => ['owner', 'manager'].includes(session.boot?.user.role ?? ''));

async function load() {
  loadError.value = '';
  try {
    const [p, r] = await Promise.all([api<Product[]>('/products'), api<{ recipes: Recipe[] }>('/fnb/recipes')]);
    products.value = p;
    recipes.value = r.recipes;
  } catch (e: any) {
    loadError.value = e.message;
  }
}
onMounted(load);

function openNew() {
  productId.value = null;
  items.value = [{ name: '', qty: 1, unit: 'g' }];
  dialog.value = true;
}
function openEdit(r: Recipe) {
  productId.value = r.productId;
  items.value = r.items.map((i) => ({ name: i.name, qty: i.qty, unit: i.unit }));
  dialog.value = true;
}
async function save() {
  if (!productId.value) return;
  const bodyItems = items.value.filter((i) => i.name.trim() && i.qty && i.unit.trim());
  if (!bodyItems.length) return;
  saving.value = true;
  try {
    await api('/fnb/recipes', { body: { productId: productId.value, items: bodyItems } });
    toast.add({ severity: 'success', summary: 'Đã lưu công thức', life: 2500 });
    dialog.value = false;
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa lưu được công thức', detail: e.message, life: 5000 });
  } finally {
    saving.value = false;
  }
}
async function remove(r: Recipe) {
  if (!await askConfirm(`Xóa công thức ${r.name}?`)) return;
  try {
    await api(`/fnb/recipes/${r.id}`, { method: 'DELETE' });
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa xóa được', detail: e.message, life: 5000 });
  }
}
</script>

<template>
  <div class="page-head">
    <h2>Công thức</h2>
    <Button v-if="canEdit" label="Thêm công thức" icon="pi pi-plus" raised @click="openNew" />
  </div>
  <p v-if="loadError" class="text-danger">{{ loadError }}</p>
  <p v-else-if="!recipes.length" class="text-muted">Chưa có công thức. Gắn nguyên liệu vào một món đang bán.</p>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
    <article v-for="r in recipes" :key="r.id" class="panel p-3.5">
      <header class="flex items-center justify-between gap-2">
        <strong>{{ r.name }}</strong>
        <div v-if="canEdit" class="flex gap-2">
          <Button label="Sửa" raised size="small" @click="openEdit(r)" />
          <Button icon="pi pi-trash" raised size="small" severity="danger" aria-label="Xóa công thức"
            @click="remove(r)" />
        </div>
      </header>
      <ul class="mt-2 mb-0 pl-4">
        <li v-for="i in r.items" :key="i.id">{{ i.name }} · {{ i.qty }} {{ i.unit }}</li>
      </ul>
    </article>
  </div>

  <Dialog v-model:visible="dialog" modal header="Công thức" content-class="dialog-pin"
    :style="{ width: 'min(32rem, calc(100vw - 1.5rem))' }">
    <form class="flex min-h-0 flex-col gap-3 overflow-hidden" @submit.prevent="save">
      <FloatLabel variant="on" class="shrink-0">
        <Select id="product" v-model="productId" :options="products" option-label="name" option-value="id" fluid />
        <label for="product">Món</label>
      </FloatLabel>
      <div class="flex min-h-0 flex-col gap-2 overflow-y-auto">
        <div v-for="(it, i) in items" :key="i"
          class="grid shrink-0 grid-cols-[minmax(0,1fr)_4.75rem_4.25rem_auto] items-end gap-2">
          <FloatLabel variant="on" class="min-w-0">
            <InputText :id="`ingredient-${i}`" v-model="it.name" fluid />
            <label :for="`ingredient-${i}`">Nguyên liệu</label>
          </FloatLabel>
          <FloatLabel variant="on" class="min-w-0">
            <InputNumber :id="`ingredient-qty-${i}`" v-model="it.qty" class="min-w-0" fluid :min="1"
              :max-fraction-digits="0" placeholder="SL" aria-label="Số lượng" />
            <label :for="`ingredient-qty-${i}`">Số lượng</label>
          </FloatLabel>
          <FloatLabel variant="on" class="min-w-0">
            <InputText :id="`ingredient-unit-${i}`" v-model="it.unit" fluid />
            <label :for="`ingredient-unit-${i}`">Đơn vị</label>
          </FloatLabel>
          <Button icon="pi pi-trash" raised severity="danger" aria-label="Xóa dòng" @click="items.splice(i, 1)" />
        </div>
      </div>
      <Button class="shrink-0 self-start" label="Thêm nguyên liệu" raised size="small"
        @click="items.push({ name: '', qty: 1, unit: 'g' })" />
      <Button class="shrink-0" type="submit" raised label="Lưu công thức" :loading="saving" :disabled="!productId"
        fluid />
    </form>
  </Dialog>
</template>