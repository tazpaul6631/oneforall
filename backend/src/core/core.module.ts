import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ManifestRegistry } from '../platform/manifest/manifest-registry.service';
import { AuditController } from './audit/audit.controller';
import { AuditLog } from './audit/audit.entity';
import { AuditService } from './audit/audit.service';
import { AuthController } from './auth/auth.controller';
import { AuthService } from './auth/auth.service';
import { jwtSecret } from './auth/jwt';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { JwtStrategy } from './auth/jwt.strategy';
import { Operator } from './auth/operator.entity';
import { User } from './auth/user.entity';
import { UsersService } from './auth/users.service';
import { OpsController } from './ops/ops.controller';
import { OpsService } from './ops/ops.service';
import { coreManifest } from './core.manifest';
import { CustomerController } from './customer/customer.controller';
import { Customer } from './customer/customer.entity';
import { CustomerService } from './customer/customer.service';
import { StockController } from './inventory/stock.controller';
import { StockLevel, StockMove } from './inventory/stock.entity';
import { StockService } from './inventory/stock.service';
import { OrderController } from './order/order.controller';
import { Order, OrderLine, OrderLineOption, Payment, Refund, RefundLine } from './order/order.entity';
import { OrderLifecycleListener } from './order/order.lifecycle';
import { OrderService } from './order/order.service';
import { ProductController } from './product/product.controller';
import { Category, ModifierGroup, ModifierOption, Product, ProductModifierGroup, ProductVariant } from './product/product.entity';
import { ProductService } from './product/product.service';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({ secret: jwtSecret(), signOptions: { expiresIn: '12h' } }),
    TypeOrmModule.forFeature([
      User, Operator, Category, Product, ProductVariant, ModifierGroup, ModifierOption, ProductModifierGroup,
      Order, OrderLine, OrderLineOption, Payment, Refund, RefundLine,
      Customer, StockLevel, StockMove, AuditLog,
    ]),
  ],
  controllers: [AuthController, ProductController, OrderController, CustomerController, StockController, AuditController, OpsController],
  providers: [
    AuthService, UsersService, ProductService, OrderService, CustomerService, StockService, AuditService, OpsService,
    OrderLifecycleListener, JwtStrategy, JwtAuthGuard,
  ],
  exports: [AuthService, JwtAuthGuard, OrderService, ProductService],
})
export class CoreModule {
  constructor(registry: ManifestRegistry) {
    registry.register(coreManifest);
  }
}
