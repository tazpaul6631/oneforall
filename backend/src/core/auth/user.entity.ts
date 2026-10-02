import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Role } from '../../platform/access/auth-user';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column() tenantId: string;
  @Index({ unique: true }) @Column() email: string;
  @Column({ select: false }) passwordHash: string;
  @Column() fullName: string;
  @Column({ type: 'varchar', default: 'staff' }) role: Role;
  @Column({ default: true }) active: boolean;
  @CreateDateColumn() createdAt: Date;
}
