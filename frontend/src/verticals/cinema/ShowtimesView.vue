<script setup lang="ts">
import Button from 'primevue/button';
import InputNumber from 'primevue/inputnumber';
import FloatLabel from 'primevue/floatlabel';
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
  <h2 class="mb-1">Lịch chiếu</h2>
  <p class="text-muted">Phim dùng giá trong danh mục sản phẩm. Ghế VIP lấy giá phiên bản VIP.</p>

  <div v-if="canEdit" class="my-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
    <form class="panel flex flex-col gap-2 p-3.5" @submit.prevent="addMovie">
      <h3>Phim</h3>
      <FloatLabel variant="on">
        <InputText id="movie-title" v-model="movie.title" fluid />
        <label for="movie-title">Tên phim</label>
      </FloatLabel>
      <label class="field">Thời lượng (phút)
        <InputNumber v-model="movie.durationMin" :min="1" :max="400" fluid />
      </label>
      <label class="field">Giá vé
        <InputNumber v-model="movie.priceVnd" :min="0" :max-fraction-digits="0" locale="vi-VN" fluid />
      </label>
      <label class="field">Giá VIP (bỏ trống nếu không có)
        <InputNumber v-model="movie.vipPriceVnd" :min="0" :max-fraction-digits="0" locale="vi-VN" fluid />
      </label>
      <Button type="submit" raised label="Thêm phim" :disabled="!movie.title.trim()" />
    </form>
    <form class="panel flex flex-col gap-2 p-3.5" @submit.prevent="addRoom">
      <h3>Phòng</h3>
      <FloatLabel variant="on">
        <InputText id="room-name" v-model="room.name" fluid />
        <label for="room-name">Tên phòng</label>
      </FloatLabel>
      <label class="field">Số hàng
        <InputNumber v-model="room.rows" :min="1" :max="12" fluid />
      </label>
      <label class="field">Ghế mỗi hàng
        <InputNumber v-model="room.cols" :min="1" :max="16" fluid />
      </label>
      <label class="field">Hàng VIP cuối phòng
        <InputNumber v-model="room.vipRows" :min="0" :max="12" fluid />
      </label>
      <Button type="submit" raised label="Thêm phòng" :disabled="!room.name.trim()" />
    </form>
    <form class="panel flex flex-col gap-2 p-3.5" @submit.prevent="addShow">
      <h3>Suất chiếu</h3>
      <Select v-model="show.movieId" :options="movies" option-label="title" option-value="id" placeholder="Chọn phim"
        fluid />
      <Select v-model="show.roomId" :options="rooms" option-label="name" option-value="id" placeholder="Chọn phòng"
        fluid />
      <label class="field">Giờ chiếu<input v-model="show.startsAt"
          class="rounded-md border border-line px-2.5 py-2 font-[inherit]" type="datetime-local"
          aria-label="Giờ chiếu" /></label>
      <Button type="submit" raised label="Thêm suất" :disabled="!show.movieId || !show.roomId || !show.startsAt" />
    </form>
  </div>

  <ul class="m-0 flex list-none flex-col gap-2 p-0">
    <li v-for="s in shows" :key="s.id"
      class="panel grid grid-cols-1 items-center gap-1 px-3.5 py-3 md:grid-cols-[1.2fr_1.4fr_auto] md:gap-3">
      <strong>{{ s.movieTitle }}</strong>
      <span>{{ dateTime(s.startsAt) }} · {{ s.roomName }}</span>
      <span>{{ s.sold }}/{{ s.seats }} ghế đã bán</span>
    </li>
  </ul>
  <p v-if="!shows.length" class="text-muted">Chưa có suất chiếu.</p>
  <p v-if="movies.length" class="text-muted">
    <span v-for="m in movies" :key="m.id">{{ m.title }} · {{ vnd(m.priceVnd) }}<template v-if="m.vipPriceVnd != null"> /
        VIP {{ vnd(m.vipPriceVnd) }}</template>.
    </span>
  </p>
</template>