<template>
  <div class="empty">
    <h2>Gói hiện tại chưa có tính năng này</h2>
    <p>Liên hệ quản trị để bật thêm tính năng cho cửa hàng của bạn.</p>
    <RouterLink to="/">Về trang tổng quan</RouterLink>
  </div>
</template>

<style scoped>
.empty { display: flex; flex-direction: column; gap: 0.75rem; align-items: flex-start; }
p { margin: 0; color: var(--p-text-muted-color); }
</style>
