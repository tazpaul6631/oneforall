import { randomUUID } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ClsService } from 'nestjs-cls';
import { IsNull, Repository } from 'typeorm';
import { ProductService } from '../product/product.service';
import { AuditService } from '../audit/audit.service';
import { ReceiveStockDto } from './stock.dto';
import { StockLevel, StockMove } from './stock.entity';

export interface StockDelta {
  productId: string;
  variantId: string | null;
  delta: number;
  reason: string;
  refType: string;
  refId: string;
  note?: string | null;
}

@Injectable()
export class StockService {
  constructor(
    @InjectRepository(StockLevel) private readonly levels: Repository<StockLevel>,
    @InjectRepository(StockMove) private readonly moves: Repository<StockMove>,
    private readonly cls: ClsService,
    private readonly products: ProductService,
    private readonly audit: AuditService,
  ) {}

  private tid() {
    return this.cls.get('tenantId') as string;
  }

  private findLevel(tenantId: string, productId: string, variantId: string | null) {
    return this.levels.findOne({
      where: { tenantId, productId, variantId: variantId ? variantId : IsNull() },
    });
  }

  /**
   * Chỉ trừ/cộng khi đã có dòng tồn. Sản phẩm chưa nhập kho thì chưa theo dõi,
   * bán hàng không bị chặn và không bị âm kho oan.
   */
  async applyIfTracked(tenantId: string, move: StockDelta) {
    const dup = await this.moves.findOne({
      where: { tenantId, refType: move.refType, refId: move.refId, reason: move.reason },
    });
    if (dup) return false;
    const level = await this.findLevel(tenantId, move.productId, move.variantId);
    if (!level) return false;
    level.qty += move.delta;
    await this.levels.save(level);
    await this.moves.save(this.moves.create({
      tenantId,
      productId: move.productId,
      variantId: move.variantId,
      delta: move.delta,
      reason: move.reason,
      refType: move.refType,
      refId: move.refId,
      note: move.note ?? null,
    }));
    return true;
  }

  async overview() {
    const tenantId = this.tid();
    const [products, levels, moves] = await Promise.all([
      this.products.list(false),
      this.levels.find({ where: { tenantId } }),
      this.moves.find({ where: { tenantId }, order: { createdAt: 'DESC' }, take: 30 }),
    ]);
    const key = (productId: string, variantId: string | null) => `${productId}:${variantId ?? ''}`;
    const qtyOf = new Map(levels.map((l) => [key(l.productId, l.variantId), l.qty]));
    const nameOf = new Map<string, string>();
    const items: { productId: string; variantId: string | null; name: string; sku: string | null; qty: number | null }[] = [];
    for (const p of products) {
      if (p.variants?.length) {
        for (const v of p.variants) {
          const k = key(p.id, v.id);
          nameOf.set(k, `${p.name} (${v.name})`);
          items.push({
            productId: p.id,
            variantId: v.id,
            name: `${p.name} (${v.name})`,
            sku: v.sku ?? p.sku,
            qty: qtyOf.has(k) ? qtyOf.get(k)! : null,
          });
        }
      } else {
        const k = key(p.id, null);
        nameOf.set(k, p.name);
        items.push({ productId: p.id, variantId: null, name: p.name, sku: p.sku, qty: qtyOf.has(k) ? qtyOf.get(k)! : null });
      }
    }
    return {
      items,
      moves: moves.map((m) => ({
        id: m.id,
        name: nameOf.get(key(m.productId, m.variantId)) ?? 'Sản phẩm',
        delta: m.delta,
        reason: m.reason,
        note: m.note,
        createdAt: m.createdAt,
      })),
    };
  }

  async receive(dto: ReceiveStockDto) {
    const tenantId = this.tid();
    const product = await this.products.get(dto.productId);
    if (product.variants.length && !dto.variantId) throw new BadRequestException('Chọn phiên bản để nhập kho');
    if (dto.variantId && !product.variants.some((v) => v.id === dto.variantId)) {
      throw new BadRequestException('Phiên bản không thuộc sản phẩm này');
    }
    const variantId = dto.variantId ?? null;
    let level = await this.findLevel(tenantId, dto.productId, variantId);
    if (!level) {
      level = await this.levels.save(this.levels.create({ tenantId, productId: dto.productId, variantId, qty: 0 }));
    }
    level.qty += dto.qty;
    await this.levels.save(level);
    await this.moves.save(this.moves.create({
      tenantId,
      productId: dto.productId,
      variantId,
      delta: dto.qty,
      reason: 'in',
      refType: 'receive',
      refId: randomUUID(),
      note: dto.note?.trim() || null,
    }));
    await this.audit.write({
      action: 'stock.received',
      entityType: 'product',
      entityId: dto.productId,
      detail: { variantId, qty: dto.qty },
    });
    return this.overview();
  }
}
