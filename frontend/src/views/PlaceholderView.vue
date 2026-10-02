<script setup lang="ts">
import { useRoute } from 'vue-router';
const route = useRoute();
</script>

<template>
  <div class="empty">
    <h2>{{ route.meta.title }}</h2>
    <p>Màn hình này chưa được xây dựng. Dự kiến làm ở {{ route.meta.stage ?? 'giai đoạn sau' }}.</p>
    <code>{{ route.meta.feature }}</code>
  </div>
</template>

<style scoped>
.empty { display: flex; flex-direction: column; gap: 0.75rem; align-items: flex-start; }
p { margin: 0; color: var(--p-text-muted-color); }
code { background: var(--p-surface-100); padding: 0.15rem 0.5rem; border-radius: 6px; font-size: 0.82rem; }
</style>
