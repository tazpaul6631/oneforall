<script setup lang="ts">
import Button from 'primevue/button';
import { ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useSession } from '@/stores/session';

const session = useSession();
const route = useRoute();
const open = ref(false);
watch(() => route.fullPath, () => (open.value = false));

const roleLabel = { owner: 'Chủ cửa hàng', manager: 'Quản lý', staff: 'Nhân viên' } as const;
</script>

<template>
  <div v-if="session.boot" class="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
    <header class="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-surface px-3 py-2 lg:hidden">
      <Button icon="pi pi-bars" raised rounded aria-label="Mở menu" @click="open = !open" />
      <strong class="truncate">{{ session.boot.tenant.name }}</strong>
    </header>

    <aside
      class="fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col gap-4 border-r border-line bg-surface px-3 py-5 transition-transform duration-200 motion-reduce:transition-none lg:sticky lg:top-0 lg:z-auto lg:h-dvh lg:w-auto lg:translate-x-0"
      :class="open && 'translate-x-0'">
      <div class="flex flex-col border-b border-line px-3 pb-3">
        <strong class="text-base">{{ session.boot.tenant.name }}</strong>
        <span class="text-sm text-muted">{{ session.boot.tenant.presetLabel }}</span>
      </div>

      <nav class="flex flex-1 flex-col gap-0.5 overflow-y-auto" aria-label="Menu chính">
        <RouterLink v-for="m in session.boot.menu" :key="m.route" :to="m.route"
          class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[0.92rem] text-ink no-underline hover:bg-soft [&.active]:bg-primary-soft [&.active]:font-semibold [&.active]:text-primary-ink"
          active-class="active" exact-active-class="active">
          <i :class="m.icon" />
          <span>{{ m.label }}</span>
        </RouterLink>
      </nav>

      <div class="flex items-center justify-between gap-2 border-t border-line px-3 pt-3">
        <div class="flex min-w-0 flex-col">
          <strong class="truncate text-sm">{{ session.boot.user.name }}</strong>
          <span class="text-sm text-muted">{{ roleLabel[session.boot.user.role] }}</span>
        </div>
        <Button icon="pi pi-sign-out" raised rounded severity="secondary" aria-label="Đăng xuất"
          @click="session.logout()" />
      </div>
    </aside>

    <div v-if="open" class="fixed inset-0 z-30 bg-black/35 lg:hidden" @click="open = false" />
    <main class="min-w-0 p-4 md:p-6 lg:p-8">
      <RouterView />
    </main>
  </div>
</template>