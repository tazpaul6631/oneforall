import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { In, Repository } from 'typeorm';
import { TenantRepository } from '../../platform/tenant/tenant-repository';
import { CustomerDto, UpdateCustomerDto } from './customer.dto';
import { Customer } from './customer.entity';

@Injectable()
export class CustomerService {
  private readonly repo: TenantRepository<Customer>;

  constructor(@InjectRepository(Customer) raw: Repository<Customer>, cls: ClsService) {
    this.repo = new TenantRepository(raw, cls);
  }

  async list(q?: string) {
    const rows = await this.repo.find({}, { order: { name: 'ASC' }, take: 200 });
    const s = q?.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((c) =>
      c.name.toLowerCase().includes(s) || (c.phone ?? '').toLowerCase().includes(s) || (c.email ?? '').toLowerCase().includes(s),
    );
  }

  listByIds(ids: string[]) {
    if (!ids.length) return Promise.resolve([] as Customer[]);
    return this.repo.find({ id: In(ids) });
  }

  async get(id: string) {
    const c = await this.repo.findOne({ id });
    if (!c) throw new NotFoundException('Không tìm thấy khách hàng');
    return c;
  }

  getOptional(id: string) {
    return this.repo.findOne({ id });
  }

  create(dto: CustomerDto) {
    return this.repo.save({
      name: dto.name.trim(),
      phone: dto.phone?.trim() || null,
      email: dto.email?.trim() || null,
      note: dto.note?.trim() || null,
    });
  }

  async update(id: string, dto: UpdateCustomerDto) {
    await this.get(id);
    await this.repo.save({
      id,
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.phone !== undefined && { phone: dto.phone.trim() || null }),
      ...(dto.email !== undefined && { email: dto.email.trim() || null }),
      ...(dto.note !== undefined && { note: dto.note.trim() || null }),
    });
    return this.get(id);
  }
}
