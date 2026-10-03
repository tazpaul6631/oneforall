<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import { confirmState, finishConfirm } from './confirm';

function onVisible(open: boolean) {
  if (!open) finishConfirm(false);
}
</script>

<template>
  <Dialog :visible="confirmState.open" modal :header="confirmState.title"
    :style="{ width: 'min(24rem, calc(100vw - 1.5rem))' }" @update:visible="onVisible">
    <p class="m-0">{{ confirmState.message }}</p>
    <div class="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <Button label="Không" severity="secondary" outlined raised @click="finishConfirm(false)" />
      <Button :label="confirmState.acceptLabel" raised :severity="confirmState.danger ? 'danger' : undefined"
        @click="finishConfirm(true)" />
    </div>
  </Dialog>
</template>
