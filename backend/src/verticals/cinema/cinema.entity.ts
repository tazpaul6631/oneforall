import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('cinema_movies')
export class CinemaMovie {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column() productId: string;
  @Column({ type: 'varchar', nullable: true }) vipVariantId: string | null;
  @Column() title: string;
  @Column({ type: 'integer' }) durationMin: number;
}

@Entity('cinema_rooms')
export class CinemaRoom {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column() name: string;
}

export type SeatKind = 'standard' | 'vip';

@Entity('cinema_seats')
@Unique(['tenantId', 'roomId', 'rowLabel', 'number'])
export class CinemaSeat {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Index() @Column() roomId: string;
  @Column() rowLabel: string;
  @Column({ type: 'integer' }) number: number;
  @Column({ type: 'varchar', default: 'standard' }) kind: SeatKind;
}

@Entity('cinema_showtimes')
export class CinemaShowtime {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column() movieId: string;
  @Column() roomId: string;
  @Column({ type: 'datetime' }) startsAt: Date;
}

export type TicketStatus = 'held' | 'sold' | 'refunded';

/** Một ghế trong một suất. Không xóa khi hoàn vé: chuyển refunded để bán lại trên cùng dòng. */
@Entity('cinema_tickets')
@Unique(['tenantId', 'showtimeId', 'seatId'])
export class CinemaTicket {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Index() @Column() showtimeId: string;
  @Column() seatId: string;
  @Column({ type: 'varchar' }) status: TicketStatus;
  @Index() @Column({ type: 'varchar', nullable: true }) orderId: string | null;
  @Column({ type: 'varchar', nullable: true }) orderLineId: string | null;
  @Column({ type: 'varchar', nullable: true }) holdKey: string | null;
  @Column({ type: 'datetime', nullable: true }) holdUntil: Date | null;
}

@Entity('cinema_sales')
@Unique(['tenantId', 'idempotencyKey'])
export class CinemaSale {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column() idempotencyKey: string;
  @Column() orderId: string;
  @CreateDateColumn() createdAt: Date;
}
