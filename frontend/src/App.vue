<script setup lang="ts">
import Toast from 'primevue/toast';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
</script>

<template>
  <Toast position="top-right" />
  <ConfirmDialog />
  <RouterView />
</template>