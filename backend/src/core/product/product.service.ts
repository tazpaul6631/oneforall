import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { In, Repository } from 'typeorm';
import { StockLevel, StockMove } from '../inventory/stock.entity';
import { TenantRepository } from '../../platform/tenant/tenant-repository';
import { CreateCategoryDto, CreateProductDto, ModifierGroupDto, UpdateCategoryDto, UpdateProductDto, VariantDto } from './product.dto';
import { Category, ModifierGroup, ModifierOption, Product, ProductModifierGroup, ProductVariant } from './product.entity';

export interface ProductDeletedEvent { tenantId: string; productId: string }

export interface SaleItem {
  productId: string;
  variantId: string | null;
  name: string;
  unitPriceVnd: number;
  qty: number;
  lineTotalVnd: number;
  note: string | null;
  options: { name: string; extraVnd: number }[];
}

@Injectable()
export class ProductService {
  private categories: TenantRepository<Category>;
  private products: TenantRepository<Product>;
  private variants: TenantRepository<ProductVariant>;
  private groups: TenantRepository<ModifierGroup>;
  private options: TenantRepository<ModifierOption>;
  private groupLinks: TenantRepository<ProductModifierGroup>;

  constructor(
    @InjectRepository(Category) c: Repository<Category>,
    @InjectRepository(Product) p: Repository<Product>,
    @InjectRepository(ProductVariant) v: Repository<ProductVariant>,
    @InjectRepository(ModifierGroup) g: Repository<ModifierGroup>,
    @InjectRepository(ModifierOption) o: Repository<ModifierOption>,
    @InjectRepository(ProductModifierGroup) links: Repository<ProductModifierGroup>,
    @InjectRepository(StockLevel) private readonly stockLevels: Repository<StockLevel>,
    @InjectRepository(StockMove) private readonly stockMoves: Repository<StockMove>,
    private readonly events: EventEmitter2,
    cls: ClsService,
  ) {
    this.categories = new TenantRepository(c, cls);
    this.products = new TenantRepository(p, cls);
    this.variants = new TenantRepository(v, cls);
    this.groups = new TenantRepository(g, cls);
    this.options = new TenantRepository(o, cls);
    this.groupLinks = new TenantRepository(links, cls);
  }

  listCategories() {
    return this.categories.find({}, { order: { sortOrder: 'ASC', name: 'ASC' } });
  }

  createCategory(dto: CreateCategoryDto) {
    return this.categories.save({ name: dto.name.trim(), sortOrder: 0 });
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const c = await this.categories.findOne({ id });
    if (!c) throw new NotFoundException('Không tìm thấy danh mục');
    await this.categories.save({ id: c.id, name: dto.name.trim() });
    return this.categories.findOne({ id });
  }

  /** Xóa danh mục không xóa sản phẩm: sản phẩm chuyển về không phân loại. */
  async deleteCategory(id: string) {
    const c = await this.categories.findOne({ id });
    if (!c) throw new NotFoundException('Không tìm thấy danh mục');
    const used = await this.products.find({ categoryId: id });
    for (const p of used) await this.products.save({ id: p.id, categoryId: null });
    await this.categories.remove({ id });
    return { ok: true };
  }

  async list(includeInactive = false) {
    const rows = await this.products.find(includeInactive ? {} : { active: true }, {
      relations: { variants: true },
      order: { name: 'ASC' },
    });
    return this.withGroups(rows);
  }

  async get(id: string) {
    const p = await this.products.findOne({ id }, { relations: { variants: true } });
    if (!p) throw new NotFoundException('Không tìm thấy sản phẩm');
    const [row] = await this.withGroups([p]);
    return row;
  }

  private async withGroups<T extends { id: string }>(rows: T[]) {
    if (!rows.length) return [];
    const links = await this.groupLinks.find({ productId: In(rows.map((r) => r.id)) });
    return rows.map((r) => ({
      ...r,
      modifierGroupIds: links.filter((l) => l.productId === r.id).map((l) => l.groupId),
    }));
  }

  private async assertCategory(categoryId?: string) {
    if (categoryId && !(await this.categories.findOne({ id: categoryId }))) {
      throw new BadRequestException('Danh mục không tồn tại');
    }
  }

  private skuOf(value?: string | null) {
    const s = value?.trim();
    return s ? s : null;
  }

  /** Mã (SKU / mã vạch) không trùng trong tenant, kể cả giữa sản phẩm và phiên bản. */
  private async assertSkus(codes: (string | null)[], ignoreProductId?: string) {
    const present = codes.filter((c): c is string => !!c);
    if (new Set(present).size !== present.length) throw new ConflictException('Mã bị trùng');
    for (const sku of present) {
      const products = await this.products.find({ sku });
      if (products.some((p) => p.id !== ignoreProductId)) throw new ConflictException(`Mã ${sku} đã được dùng`);
      const variants = await this.variants.find({ sku });
      if (variants.some((v) => v.productId !== ignoreProductId)) throw new ConflictException(`Mã ${sku} đã được dùng`);
    }
  }

  private async saveVariants(productId: string, variants: VariantDto[]) {
    for (const v of variants) {
      await this.variants.save({ productId, name: v.name.trim(), priceVnd: v.priceVnd, sku: this.skuOf(v.sku) });
    }
  }

  async create(dto: CreateProductDto) {
    await this.assertCategory(dto.categoryId);
    const sku = this.skuOf(dto.sku);
    await this.assertSkus([sku, ...(dto.variants ?? []).map((v) => this.skuOf(v.sku))]);
    const p = await this.products.save({
      name: dto.name.trim(),
      priceVnd: dto.priceVnd,
      categoryId: dto.categoryId ?? null,
      sku,
      active: true,
    });
    if (dto.variants?.length) await this.saveVariants(p.id, dto.variants);
    await this.saveGroupLinks(p.id, dto.modifierGroupIds ?? []);
    return this.get(p.id);
  }

  async update(id: string, dto: UpdateProductDto) {
    const p = await this.get(id);
    await this.assertCategory(dto.categoryId);
    const nextSku = dto.sku !== undefined ? this.skuOf(dto.sku) : p.sku;
    const nextVariantSkus = dto.variants
      ? dto.variants.map((v) => this.skuOf(v.sku))
      : p.variants.map((v) => v.sku);
    await this.assertSkus([nextSku, ...nextVariantSkus], p.id);
    await this.products.save({
      id: p.id,
      ...(dto.name !== undefined && { name: dto.name.trim() }),
      ...(dto.priceVnd !== undefined && { priceVnd: dto.priceVnd }),
      ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
      ...(dto.sku !== undefined && { sku: nextSku }),
      ...(dto.active !== undefined && { active: dto.active }),
    });
    if (dto.variants) {
      await this.variants.remove({ productId: id });
      await this.saveVariants(id, dto.variants);
    }
    if (dto.modifierGroupIds) await this.saveGroupLinks(id, dto.modifierGroupIds);
    return this.get(id);
  }

  /**
   * Xóa sản phẩm và phiên bản. Đơn đã bán giữ tên đã chụp, không phụ thuộc dòng này.
   * Tồn kho xóa theo. Công thức và phim được vertical dọn qua sự kiện `product.deleted`.
   */
  async delete(id: string) {
    const p = await this.get(id);
    const tenantId = this.products.tenantId;
    await this.events.emitAsync('product.deleted', { tenantId, productId: p.id } satisfies ProductDeletedEvent);
    await this.stockMoves.delete({ tenantId, productId: p.id });
    await this.stockLevels.delete({ tenantId, productId: p.id });
    await this.groupLinks.remove({ productId: p.id });
    await this.products.remove({ id: p.id });
    return { ok: true };
  }

  /** Tìm theo SKU sản phẩm hoặc phiên bản — dùng cho máy quét mã vạch. */
  async findByCode(code: string) {
    const sku = code.trim();
    if (!sku) throw new BadRequestException('Thiếu mã');
    const variant = await this.variants.findOne({ sku });
    if (variant) {
      const product = await this.get(variant.productId);
      if (!product.active) throw new NotFoundException('Sản phẩm đã ngừng bán');
      return { product, variant: product.variants.find((v) => v.id === variant.id) ?? variant };
    }
    const product = await this.products.findOne({ sku }, { relations: { variants: true } });
    if (!product || !product.active) throw new NotFoundException('Không tìm thấy mã này');
    return { product, variant: null };
  }

  private assertGroupRules(dto: ModifierGroupDto) {
    if (dto.maxSelect < dto.minSelect) throw new BadRequestException('Số chọn tối đa phải lớn hơn hoặc bằng số tối thiểu');
    if (dto.required && dto.minSelect < 1) throw new BadRequestException('Nhóm bắt buộc phải chọn ít nhất một món');
    const names = dto.options.map((o) => o.name.trim());
    if (new Set(names).size !== names.length) throw new BadRequestException('Tên món kèm bị trùng trong nhóm');
  }

  private async saveOptions(groupId: string, options: ModifierGroupDto['options']) {
    for (const [i, o] of options.entries()) {
      await this.options.save({ groupId, name: o.name.trim(), extraVnd: o.extraVnd, sortOrder: i });
    }
  }

  async listGroups() {
    const groups = await this.groups.find({}, { order: { name: 'ASC' } });
    const options = await this.options.find({}, { order: { sortOrder: 'ASC', name: 'ASC' } });
    return groups.map((g) => ({ ...g, options: options.filter((o) => o.groupId === g.id) }));
  }

  private async getGroup(id: string) {
    const groups = await this.listGroups();
    const g = groups.find((x) => x.id === id);
    if (!g) throw new NotFoundException('Không tìm thấy nhóm món kèm');
    return g;
  }

  async createGroup(dto: ModifierGroupDto) {
    this.assertGroupRules(dto);
    const g = await this.groups.save({
      name: dto.name.trim(), required: dto.required, minSelect: dto.minSelect, maxSelect: dto.maxSelect, sortOrder: 0,
    });
    await this.saveOptions(g.id, dto.options);
    return this.getGroup(g.id);
  }

  async updateGroup(id: string, dto: ModifierGroupDto) {
    const g = await this.groups.findOne({ id });
    if (!g) throw new NotFoundException('Không tìm thấy nhóm món kèm');
    this.assertGroupRules(dto);
    await this.groups.save({ id, name: dto.name.trim(), required: dto.required, minSelect: dto.minSelect, maxSelect: dto.maxSelect });
    await this.options.remove({ groupId: id });
    await this.saveOptions(id, dto.options);
    return this.getGroup(id);
  }

  async deleteGroup(id: string) {
    const g = await this.groups.findOne({ id });
    if (!g) throw new NotFoundException('Không tìm thấy nhóm món kèm');
    await this.groupLinks.remove({ groupId: id });
    await this.options.remove({ groupId: id });
    await this.groups.remove({ id });
    return { ok: true };
  }

  private async saveGroupLinks(productId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    if (unique.length) {
      const found = await this.groups.find({ id: In(unique) });
      if (found.length !== unique.length) throw new BadRequestException('Nhóm món kèm không tồn tại');
    }
    await this.groupLinks.remove({ productId });
    for (const groupId of unique) await this.groupLinks.save({ productId, groupId });
  }

  /** Lấy giá và tên từ DB (không tin giá do client gửi) cho các dòng bán hàng. */
  async resolveForSale(lines: { productId: string; variantId?: string; qty: number; optionIds?: string[]; note?: string }[]): Promise<SaleItem[]> {
    const ids = [...new Set(lines.map((l) => l.productId))];
    const found = await this.products.find({ id: In(ids) }, { relations: { variants: true } });
    const byId = new Map(found.map((p) => [p.id, p]));
    const links = ids.length ? await this.groupLinks.find({ productId: In(ids) }) : [];
    const groupIds = [...new Set(links.map((l) => l.groupId))];
    const groups = groupIds.length ? await this.groups.find({ id: In(groupIds) }) : [];
    const options = groupIds.length ? await this.options.find({ groupId: In(groupIds) }) : [];
    return lines.map((l) => {
      const p = byId.get(l.productId);
      if (!p || !p.active) throw new BadRequestException('Có sản phẩm không tồn tại hoặc đã ngừng bán');
      const v = l.variantId ? p.variants.find((x) => x.id === l.variantId) : undefined;
      if (l.variantId && !v) throw new BadRequestException(`Phiên bản không thuộc sản phẩm "${p.name}"`);
      const assigned = new Set(links.filter((x) => x.productId === p.id).map((x) => x.groupId));
      const chosenIds = l.optionIds ?? [];
      if (new Set(chosenIds).size !== chosenIds.length) throw new BadRequestException('Món kèm bị chọn trùng');
      const chosen = chosenIds.map((id) => {
        const opt = options.find((o) => o.id === id);
        if (!opt || !assigned.has(opt.groupId)) throw new BadRequestException(`Món kèm không thuộc "${p.name}"`);
        return opt;
      });
      for (const gid of assigned) {
        const g = groups.find((x) => x.id === gid);
        if (!g) continue;
        const count = chosen.filter((o) => o.groupId === gid).length;
        const min = g.required ? Math.max(g.minSelect, 1) : g.minSelect;
        if (count < min) throw new BadRequestException(`"${p.name}" cần chọn ${g.name}`);
        if (count > g.maxSelect) throw new BadRequestException(`"${p.name}" chọn quá nhiều ${g.name}`);
      }
      const extra = chosen.reduce((sum, o) => sum + o.extraVnd, 0);
      const unitPriceVnd = (v ? v.priceVnd : p.priceVnd) + extra;
      const base = v ? `${p.name} (${v.name})` : p.name;
      const note = l.note?.trim() || null;
      return {
        productId: p.id,
        variantId: v?.id ?? null,
        name: chosen.length ? `${base} · ${chosen.map((o) => o.name).join(', ')}` : base,
        unitPriceVnd,
        qty: l.qty,
        lineTotalVnd: unitPriceVnd * l.qty,
        note,
        options: chosen.map((o) => ({ name: o.name, extraVnd: o.extraVnd })),
      };
    });
  }
}
