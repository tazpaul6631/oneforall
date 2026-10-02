import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** Người vận hành phần mềm. Không thuộc cửa hàng nào. */
@Entity('operators')
export class Operator {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ unique: true }) email: string;
  @Column({ select: false }) passwordHash: string;
  @Column() fullName: string;
  @Column({ default: true }) active: boolean;
  @CreateDateColumn() createdAt: Date;
}
