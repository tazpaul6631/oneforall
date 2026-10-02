import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { AuthUser, assertRole } from '../../platform/access/auth-user';
import { CurrentUser, RequireFeature } from '../../platform/access/decorators';
import { CheckoutDto, MovieDto, RoomDto, ShowtimeDto } from './cinema.dto';
import { CinemaService } from './cinema.service';

@Controller('cinema')
export class CinemaController {
  constructor(private readonly svc: CinemaService) {}

  @Get('catalog') @RequireFeature('cinema.showtime')
  catalog() { return this.svc.catalog(); }

  @Post('movies') @RequireFeature('cinema.showtime')
  createMovie(@CurrentUser() u: AuthUser, @Body() dto: MovieDto) {
    assertRole(u, 'owner', 'manager');
    return this.svc.createMovie(dto);
  }

  @Post('rooms') @RequireFeature('cinema.showtime')
  createRoom(@CurrentUser() u: AuthUser, @Body() dto: RoomDto) {
    assertRole(u, 'owner', 'manager');
    return this.svc.createRoom(dto);
  }

  @Post('showtimes') @RequireFeature('cinema.showtime')
  createShowtime(@CurrentUser() u: AuthUser, @Body() dto: ShowtimeDto) {
    assertRole(u, 'owner', 'manager');
    return this.svc.createShowtime(dto);
  }

  @Get('showtimes/:id') @RequireFeature('cinema.seat_map')
  seatMap(@Param('id') id: string) { return this.svc.seatMap(id); }

  @Post('checkout') @RequireFeature('cinema.seat_map')
  checkout(@CurrentUser() u: AuthUser, @Body() dto: CheckoutDto) {
    return this.svc.checkout(dto, u);
  }
}
