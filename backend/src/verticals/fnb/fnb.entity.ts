import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('fnb_areas')
export class FnbArea {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column() name: string;
  @Column({ type: 'integer', default: 0 }) sortOrder: number;
}

@Entity('fnb_tables')
export class FnbTable {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Index() @Column() areaId: string;
  @Column() name: string;
  @Column({ type: 'integer', default: 4 }) seats: number;
  @Column({ type: 'varchar', default: 'free' }) status: 'free' | 'occupied';
  @Index() @Column({ type: 'varchar', nullable: true }) orderId: string | null;
}

export type TicketStatus = 'queued' | 'cooking' | 'ready' | 'served';

@Entity('fnb_tickets')
export class FnbTicket {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Index() @Column() orderId: string;
  @Column({ type: 'varchar', default: 'queued' }) status: TicketStatus;
  @CreateDateColumn() createdAt: Date;
}

@Entity('fnb_ticket_lines')
export class FnbTicketLine {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Index() @Column() ticketId: string;
  @Column() name: string;
  @Column({ type: 'integer' }) qty: number;
}

@Entity('fnb_recipes')
@Unique(['tenantId', 'productId'])
export class FnbRecipe {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column() productId: string;
  @Column() name: string;
}

@Entity('fnb_recipe_items')
export class FnbRecipeItem {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Index() @Column() recipeId: string;
  @Column() name: string;
  @Column({ type: 'integer' }) qty: number;
  @Column() unit: string;
}
