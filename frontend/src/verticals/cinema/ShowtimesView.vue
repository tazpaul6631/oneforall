<script setup lang="ts">
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { useToast } from 'primevue/usetoast';
import { computed, onMounted, ref } from 'vue';
import { api } from '@/api/http';
import { useSession } from '@/stores/session';
import { dateTime, vnd } from '@/utils/format';

interface Movie { id: string; title: string; durationMin: number; priceVnd: number; vipPriceVnd: number | null }
interface Room { id: string; name: string; seats: number }
interface Show { id: string; movieTitle: string; roomName: string; startsAt: string; sold: number; seats: number }

const session = useSession();
const toast = useToast();
const movies = ref<Movie[]>([]);
const rooms = ref<Room[]>([]);
const shows = ref<Show[]>([]);
const canEdit = computed(() => ['owner', 'manager'].includes(session.boot?.user.role ?? ''));

const movie = ref({ title: '', durationMin: 100, priceVnd: 90000, vipPriceVnd: null as number | null });
const room = ref({ name: '', rows: 5, cols: 8, vipRows: 1 });
const show = ref({ movieId: '', roomId: '', startsAt: '' });

async function load() {
  const data = await api<{ movies: Movie[]; rooms: Room[]; showtimes: Show[] }>('/cinema/catalog');
  movies.value = data.movies;
  rooms.value = data.rooms;
  shows.value = data.showtimes;
}
onMounted(load);

async function save(path: string, body: unknown, ok: string) {
  try {
    await api(path, { body });
    toast.add({ severity: 'success', summary: ok, life: 2500 });
    await load();
  } catch (e: any) {
    toast.add({ severity: 'error', summary: 'Chưa lưu được', detail: e.message, life: 5000 });
  }
}
function addMovie() {
  if (!movie.value.title.trim()) return;
  return save('/cinema/movies', {
    title: movie.value.title.trim(),
    durationMin: movie.value.durationMin,
    priceVnd: movie.value.priceVnd,
    ...(movie.value.vipPriceVnd != null ? { vipPriceVnd: movie.value.vipPriceVnd } : {}),
  }, 'Đã thêm phim');
}
function addRoom() {
  if (!room.value.name.trim()) return;
  return save('/cinema/rooms', room.value, 'Đã thêm phòng');
}
function addShow() {
  if (!show.value.movieId || !show.value.roomId || !show.value.startsAt) return;
  return save('/cinema/showtimes', {
    movieId: show.value.movieId,
    roomId: show.value.roomId,
    startsAt: new Date(show.value.startsAt).toISOString(),
  }, 'Đã thêm suất chiếu');
}
</script>

<template>
  <h2>Lịch chiếu</h2>
  <p class="lead">Phim dùng giá trong danh mục sản phẩm. Ghế VIP lấy giá phiên bản VIP.</p>

  <div v-if="canEdit" class="forms">
    <form class="card" @submit.prevent="addMovie">
      <h3>Phim</h3>
      <InputText v-model="movie.title" placeholder="Tên phim" aria-label="Tên phim" fluid />
      <label>Thời lượng (phút)<InputNumber v-model="movie.durationMin" :min="1" :max="400" fluid /></label>
      <label>Giá vé<InputNumber v-model="movie.priceVnd" :min="0" :max-fraction-digits="0" locale="vi-VN" fluid /></label>
      <label>Giá VIP (bỏ trống nếu không có)<InputNumber v-model="movie.vipPriceVnd" :min="0" :max-fraction-digits="0" locale="vi-VN" fluid /></label>
      <Button type="submit" label="Thêm phim" :disabled="!movie.title.trim()" />
    </form>
    <form class="card" @submit.prevent="addRoom">
      <h3>Phòng</h3>
      <InputText v-model="room.name" placeholder="Tên phòng" aria-label="Tên phòng" fluid />
      <label>Số hàng<InputNumber v-model="room.rows" :min="1" :max="12" fluid /></label>
      <label>Ghế mỗi hàng<InputNumber v-model="room.cols" :min="1" :max="16" fluid /></label>
      <label>Hàng VIP cuối phòng<InputNumber v-model="room.vipRows" :min="0" :max="12" fluid /></label>
      <Button type="submit" label="Thêm phòng" :disabled="!room.name.trim()" />
    </form>
    <form class="card" @submit.prevent="addShow">
      <h3>Suất chiếu</h3>
      <Select v-model="show.movieId" :options="movies" option-label="title" option-value="id" placeholder="Chọn phim" fluid />
      <Select v-model="show.roomId" :options="rooms" option-label="name" option-value="id" placeholder="Chọn phòng" fluid />
      <label>Giờ chiếu<input v-model="show.startsAt" type="datetime-local" aria-label="Giờ chiếu" /></label>
      <Button type="submit" label="Thêm suất" :disabled="!show.movieId || !show.roomId || !show.startsAt" />
    </form>
  </div>

  <ul class="shows">
    <li v-for="s in shows" :key="s.id">
      <strong>{{ s.movieTitle }}</strong>
      <span>{{ dateTime(s.startsAt) }} · {{ s.roomName }}</span>
      <span>{{ s.sold }}/{{ s.seats }} ghế đã bán</span>
    </li>
  </ul>
  <p v-if="!shows.length" class="muted">Chưa có suất chiếu.</p>
  <p v-if="movies.length" class="muted">
    <span v-for="m in movies" :key="m.id">{{ m.title }} · {{ vnd(m.priceVnd) }}<template v-if="m.vipPriceVnd != null"> / VIP {{ vnd(m.vipPriceVnd) }}</template>. </span>
  </p>
</template>

<style scoped>
h2 { margin-bottom: 0.35rem; }
.lead, .muted { color: var(--p-text-muted-color); }
.forms { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.75rem; margin: 1rem 0; }
.card, .card label { display: flex; flex-direction: column; gap: 0.5rem; }
.card { background: var(--p-surface-0); border: 1px solid var(--p-content-border-color); border-radius: 12px; padding: 0.9rem; }
.card h3 { margin: 0; font-size: 1rem; }
.card label { font-size: 0.85rem; font-weight: 500; }
input[type='datetime-local'] { font: inherit; padding: 0.45rem 0.6rem; border: 1px solid var(--p-content-border-color); border-radius: 6px; }
.shows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.45rem; }
.shows li { display: grid; grid-template-columns: 1.2fr 1.4fr auto; gap: 0.75rem; align-items: center; background: var(--p-surface-0); border: 1px solid var(--p-content-border-color); border-radius: 10px; padding: 0.7rem 0.9rem; }
@media (max-width: 700px) { .shows li { grid-template-columns: 1fr; } }
</style>
