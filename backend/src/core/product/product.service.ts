import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { In, Repository } from 'typeorm';
import { TenantRepository } from '../../platform/tenant/tenant-repository';
import { CreateCategoryDto, CreateProductDto, UpdateCategoryDto, UpdateProductDto, VariantDto } from './product.dto';
import { Category, Product, ProductVariant } from './product.entity';

export interface SaleItem {
  productId: string;
  variantId: string | null;
  name: string;
  unitPriceVnd: number;
  qty: number;
  lineTotalVnd: number;
}

@Injectable()
export class ProductService {
  private categories: TenantRepository<Category>;
  private products: TenantRepository<Product>;
  private variants: TenantRepository<ProductVariant>;

  constructor(
    @InjectRepository(Category) c: Repository<Category>,
    @InjectRepository(Product) p: Repository<Product>,
    @InjectRepository(ProductVariant) v: Repository<ProductVariant>,
    cls: ClsService,
  ) {
    this.categories = new TenantRepository(c, cls);
    this.products = new TenantRepository(p, cls);
    this.variants = new TenantRepository(v, cls);
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

  list(includeInactive = false) {
    return this.products.find(includeInactive ? {} : { active: true }, {
      relations: { variants: true },
      order: { name: 'ASC' },
    });
  }

  async get(id: string) {
    const p = await this.products.findOne({ id }, { relations: { variants: true } });
    if (!p) throw new NotFoundException('Không tìm thấy sản phẩm');
    return p;
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
    return this.get(id);
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

  /** Lấy giá và tên từ DB (không tin giá do client gửi) cho các dòng bán hàng. */
  async resolveForSale(lines: { productId: string; variantId?: string; qty: number }[]): Promise<SaleItem[]> {
    const ids = [...new Set(lines.map((l) => l.productId))];
    const found = await this.products.find({ id: In(ids) }, { relations: { variants: true } });
    const byId = new Map(found.map((p) => [p.id, p]));
    return lines.map((l) => {
      const p = byId.get(l.productId);
      if (!p || !p.active) throw new BadRequestException('Có sản phẩm không tồn tại hoặc đã ngừng bán');
      const v = l.variantId ? p.variants.find((x) => x.id === l.variantId) : undefined;
      if (l.variantId && !v) throw new BadRequestException(`Phiên bản không thuộc sản phẩm "${p.name}"`);
      const unitPriceVnd = v ? v.priceVnd : p.priceVnd;
      return {
        productId: p.id,
        variantId: v?.id ?? null,
        name: v ? `${p.name} (${v.name})` : p.name,
        unitPriceVnd,
        qty: l.qty,
        lineTotalVnd: unitPriceVnd * l.qty,
      };
    });
  }
}
