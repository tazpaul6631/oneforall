import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Column({ type: 'varchar', nullable: true }) actorId: string | null;
  @Column() action: string;
  @Column() entityType: string;
  @Column() entityId: string;
  @Column({ type: 'text', nullable: true }) detail: string | null;
  @CreateDateColumn() createdAt: Date;
}
