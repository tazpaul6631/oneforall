import { UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { FindManyOptions, FindOneOptions, FindOptionsWhere, Repository } from 'typeorm';

/**
 * Repository tự gắn `tenantId` lấy từ request context vào MỌI truy vấn.
 * Mọi bảng nghiệp vụ có cột tenantId đều phải đi qua lớp này.
 */
export class TenantRepository<T extends { tenantId: string }> {
  constructor(
    private readonly repo: Repository<T>,
    private readonly cls: ClsService,
  ) {}

  get tenantId(): string {
    const id = this.cls.get('tenantId');
    if (!id) throw new UnauthorizedException('Thiếu ngữ cảnh tenant');
    return id;
  }

  private scope(where: FindOptionsWhere<T> = {}) {
    return { ...where, tenantId: this.tenantId } as FindOptionsWhere<T>;
  }

  find(where?: FindOptionsWhere<T>, options: Omit<FindManyOptions<T>, 'where'> = {}) {
    return this.repo.find({ ...options, where: this.scope(where) });
  }

  findOne(where: FindOptionsWhere<T>, options: Omit<FindOneOptions<T>, 'where'> = {}) {
    return this.repo.findOne({ ...options, where: this.scope(where) });
  }

  save(data: Partial<T>): Promise<T> {
    return this.repo.save({ ...data, tenantId: this.tenantId } as any) as Promise<T>;
  }

  remove(where: FindOptionsWhere<T>) {
    return this.repo.delete(this.scope(where));
  }
}
