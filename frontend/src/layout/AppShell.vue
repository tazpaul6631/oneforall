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
  <div class="shell" v-if="session.boot">
    <header class="mobilebar">
      <Button icon="pi pi-bars" text rounded aria-label="Mở menu" @click="open = !open" />
      <strong>{{ session.boot.tenant.name }}</strong>
    </header>

    <aside class="side" :class="{ open }">
      <div class="brand">
        <strong>{{ session.boot.tenant.name }}</strong>
        <span>{{ session.boot.tenant.presetLabel }}</span>
      </div>

      <nav aria-label="Menu chính">
        <RouterLink v-for="m in session.boot.menu" :key="m.route" :to="m.route" class="item" active-class="active"
          exact-active-class="active">
          <i :class="m.icon" />
          <span>{{ m.label }}</span>
        </RouterLink>
      </nav>

      <div class="me">
        <div>
          <strong>{{ session.boot.user.name }}</strong>
          <span>{{ roleLabel[session.boot.user.role] }}</span>
        </div>
        <Button icon="pi pi-sign-out" text rounded severity="secondary" aria-label="Đăng xuất"
          @click="session.logout()" />
      </div>
    </aside>

    <div v-if="open" class="scrim" @click="open = false" />
    <main class="main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: 248px 1fr;
  min-height: 100vh;
}

.side {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.25rem 0.75rem;
  background: var(--p-surface-0);
  border-right: 1px solid var(--p-content-border-color);
  position: sticky;
  top: 0;
  height: 100vh;
  box-sizing: border-box;
}

.brand {
  display: flex;
  flex-direction: column;
  padding: 0 0.75rem 0.75rem;
  border-bottom: 1px solid var(--p-content-border-color);
}

.brand strong {
  font-size: 1.05rem;
}

.brand span,
.me span {
  font-size: 0.8rem;
  color: var(--p-text-muted-color);
}

nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  overflow-y: auto;
}

.item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: 8px;
  color: var(--p-text-color);
  text-decoration: none;
  font-size: 0.92rem;
}

.item:hover {
  background: var(--p-surface-100);
}

.item.active {
  background: var(--p-primary-50);
  color: var(--p-primary-700);
  font-weight: 600;
}

.me {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem 0.75rem 0;
  border-top: 1px solid var(--p-content-border-color);
}

.me div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.me strong {
  font-size: 0.9rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.main {
  padding: 2rem;
  max-width: 1100px;
  width: 100%;
  box-sizing: border-box;
}

.mobilebar {
  display: none;
}

.scrim {
  display: none;
}

@media (max-width: 800px) {
  .shell {
    grid-template-columns: 1fr;
  }

  .mobilebar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--p-surface-0);
    border-bottom: 1px solid var(--p-content-border-color);
    position: sticky;
    top: 0;
    z-index: 20;
  }

  .side {
    position: fixed;
    z-index: 40;
    inset: 0 auto 0 0;
    width: 264px;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
  }

  .side.open {
    transform: none;
  }

  .scrim {
    display: block;
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.35);
    z-index: 30;
  }

  .main {
    padding: 1.25rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .side {
    transition: none;
  }
}
</style>
