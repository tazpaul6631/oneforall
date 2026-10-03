<script setup lang="ts">
import { useRoute } from 'vue-router';
const route = useRoute();
</script>

<template>
  <div class="flex flex-col items-start gap-3">
    <h2>{{ route.meta.title }}</h2>
    <p class="m-0 text-muted">Màn hình này chưa được xây dựng. Dự kiến làm ở {{ route.meta.stage ?? 'giai đoạn sau' }}.
    </p>
    <code class="rounded-md bg-soft px-2 py-0.5 text-[0.82rem]">{{ route.meta.feature }}</code>
  </div>
</template>