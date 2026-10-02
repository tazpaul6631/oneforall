<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { api } from '@/api/http';
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
  if (!window.confirm(`Xóa công thức ${r.name}?`)) return;
  try {
    await api(`/fnb/recipes/${r.id}`, { method: 'DELETE' });
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa xóa được', detail: e.message, life: 5000 });
  }
}
</script>

<template>
  <div class="head">
    <h2>Công thức</h2>
    <Button v-if="canEdit" label="Thêm công thức" icon="pi pi-plus" @click="openNew" />
  </div>
  <p v-if="loadError" class="err">{{ loadError }}</p>
  <p v-else-if="!recipes.length" class="muted">Chưa có công thức. Gắn nguyên liệu vào một món đang bán.</p>
  <div class="list">
    <article v-for="r in recipes" :key="r.id">
      <header>
        <strong>{{ r.name }}</strong>
        <div v-if="canEdit">
          <Button label="Sửa" text size="small" @click="openEdit(r)" />
          <Button icon="pi pi-trash" text size="small" severity="danger" aria-label="Xóa công thức" @click="remove(r)" />
        </div>
      </header>
      <ul>
        <li v-for="i in r.items" :key="i.id">{{ i.name }} · {{ i.qty }} {{ i.unit }}</li>
      </ul>
    </article>
  </div>

  <Dialog v-model:visible="dialog" modal header="Công thức" :style="{ width: '32rem' }">
    <form class="form" @submit.prevent="save">
      <label>Món<Select v-model="productId" :options="products" option-label="name" option-value="id" placeholder="Chọn sản phẩm" fluid /></label>
      <div v-for="(it, i) in items" :key="i" class="row">
        <InputText v-model="it.name" placeholder="Nguyên liệu" aria-label="Tên nguyên liệu" />
        <InputNumber v-model="it.qty" :min="1" :max-fraction-digits="0" placeholder="SL" aria-label="Số lượng" />
        <InputText v-model="it.unit" placeholder="Đơn vị" aria-label="Đơn vị" />
        <Button icon="pi pi-trash" text severity="secondary" aria-label="Xóa dòng" @click="items.splice(i, 1)" />
      </div>
      <Button label="Thêm nguyên liệu" text size="small" @click="items.push({ name: '', qty: 1, unit: 'g' })" />
      <Button type="submit" label="Lưu công thức" :loading="saving" :disabled="!productId" fluid />
    </form>
  </Dialog>
</template>

<style scoped>
.head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.err { color: var(--p-red-600); }
.muted { color: var(--p-text-muted-color); }
.list { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.75rem; }
article { background: var(--p-surface-0); border: 1px solid var(--p-content-border-color); border-radius: 10px; padding: 0.9rem; }
header { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
ul { margin: 0.5rem 0 0; padding-left: 1.1rem; }
.form { display: flex; flex-direction: column; gap: 0.75rem; }
.form label { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.9rem; font-weight: 500; }
.row { display: grid; grid-template-columns: 1.4fr 0.7fr 0.7fr auto; gap: 0.4rem; align-items: center; }
</style>
