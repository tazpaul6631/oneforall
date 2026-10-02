import { VerticalManifest } from '../../platform/manifest/vertical-manifest';

export const cinemaManifest: VerticalManifest = {
  key: 'cinema',
  features: ['cinema.showtime', 'cinema.seat_map'],
  menu: [
    { label: 'Bán vé', route: '/cinema/box', icon: 'pi pi-ticket', feature: 'cinema.seat_map' },
    { label: 'Lịch chiếu', route: '/cinema/showtimes', icon: 'pi pi-calendar', feature: 'cinema.showtime' },
  ],
  presets: {
    cinema_hall: {
      label: 'Rạp chiếu phim',
      description: 'Suất chiếu, sơ đồ ghế, giữ chỗ và bán vé.',
      color: 'purple',
      features: ['cinema.showtime', 'cinema.seat_map'],
    },
  },
};
