import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Tenant, TenantDocument } from '../modules/tenants/schemas/tenant.schema';
import {
  AutomationRule,
  AutomationRuleDocument,
} from '../modules/rules/schemas/automation-rule.schema';

/**
 * Seed service that creates demo tenants and automation rules on startup.
 *
 * Creates 2 tenants with distinct rules to demonstrate:
 * 1. Tenant isolation (Tenant A sees only their rules/jobs)
 * 2. Different rule configurations per tenant
 * 3. Multiple action types (webhook, email, log)
 * 4. Various condition operators
 */
@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(Tenant.name) private tenantModel: Model<TenantDocument>,
    @InjectModel(AutomationRule.name)
    private ruleModel: Model<AutomationRuleDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seed();
  }

  async seed(): Promise<void> {
    // Check if data already exists
    const existingTenants = await this.tenantModel.countDocuments();
    if (existingTenants > 0) {
      this.logger.log('Seed data already exists, skipping...');
      return;
    }

    this.logger.log('Seeding demo data...');

    const tenantAId = new Types.ObjectId('6a460515c610ca63064b6027');
    const tenantBId = new Types.ObjectId('6bb71626d721db74175c7138');

    // =============================================
    // Tenant A: Acme Corp — Shopify-focused rules
    // =============================================
    const tenantA = await this.tenantModel.create({
      _id: tenantAId,
      name: 'Acme Corp',
      slug: 'acme-corp',
      webhookSecret: 'whsec_acme_secret_key_2024',
      isActive: true,
    });

    this.logger.log(`Created tenant: ${tenantA.name} (${tenantA._id})`);

    // Rule 1: High-value order alert
    await this.ruleModel.create({
      tenantId: tenantA._id,
      name: 'High-Value Order Alert',
      isActive: true,
      triggerSource: 'shopify',
      triggerEventType: 'order.created',
      conditions: [
        { field: 'order.total_price', operator: 'greater_than', value: 500 },
      ],
      actions: [
        {
          type: 'email',
          config: {
            to: 'sales@acmecorp.com',
            subject: 'High-Value Order Received!',
            body: 'A new order over $500 has been placed.',
          },
        },
        {
          type: 'log',
          config: {
            level: 'info',
            message: 'High-value order detected',
          },
        },
      ],
    });

    // Rule 2: All order notification (webhook to Slack)
    await this.ruleModel.create({
      tenantId: tenantA._id,
      name: 'Order Slack Notification',
      isActive: true,
      triggerSource: 'shopify',
      triggerEventType: 'order.created',
      conditions: [], // No conditions — triggers on ALL orders
      actions: [
        {
          type: 'webhook',
          config: {
            url: 'https://jsonplaceholder.typicode.com/posts', // Reliable public test endpoint
            headers: { 'X-Source': 'webhook-engine' },
          },
        },
      ],
    });

    // Rule 3: Payment failure alert
    await this.ruleModel.create({
      tenantId: tenantA._id,
      name: 'Payment Failure Alert',
      isActive: true,
      triggerSource: 'stripe',
      triggerEventType: 'payment.failed',
      conditions: [
        { field: 'amount', operator: 'greater_than', value: 100 },
      ],
      actions: [
        {
          type: 'email',
          config: {
            to: 'finance@acmecorp.com',
            subject: 'Payment Failure Alert',
          },
        },
        {
          type: 'webhook',
          config: {
            url: 'https://httpbin.org/post',
          },
        },
      ],
    });

    // =============================================
    // Tenant B: Beta Store — Different platform rules
    // =============================================
    const tenantB = await this.tenantModel.create({
      _id: tenantBId,
      name: 'Beta Store',
      slug: 'beta-store',
      webhookSecret: 'whsec_beta_secret_key_2024',
      isActive: true,
    });

    this.logger.log(`Created tenant: ${tenantB.name} (${tenantB._id})`);

    // Rule 1: CRM deal update notification
    await this.ruleModel.create({
      tenantId: tenantB._id,
      name: 'CRM Deal Update Logger',
      isActive: true,
      triggerSource: 'crm',
      triggerEventType: 'deal.updated',
      conditions: [
        { field: 'deal.stage', operator: 'equals', value: 'won' },
      ],
      actions: [
        {
          type: 'log',
          config: {
            level: 'info',
            message: 'Deal won! Celebrate!',
          },
        },
        {
          type: 'email',
          config: {
            to: 'team@betastore.com',
            subject: 'Deal Won!',
          },
        },
      ],
    });

    // Rule 2: Failing webhook action (for demo — URL that returns 500)
    await this.ruleModel.create({
      tenantId: tenantB._id,
      name: 'Intentional Failure Rule (Demo)',
      isActive: true,
      triggerSource: 'shopify',
      triggerEventType: 'order.created',
      conditions: [],
      actions: [
        {
          type: 'webhook',
          config: {
            url: 'https://httpbin.org/status/500', // Will return 500 error
            headers: {},
          },
        },
      ],
    });

    this.logger.log('Seed data created successfully!');
    this.logger.log('');
    this.logger.log('Demo Tenants:');
    this.logger.log(`   Tenant A: "${tenantA.name}" → ID: ${tenantA._id}`);
    this.logger.log(`   Tenant B: "${tenantB.name}" → ID: ${tenantB._id}`);
    this.logger.log('');
    this.logger.log('Test with:');
    this.logger.log(
      `   curl -X POST http://localhost:3000/webhooks/${tenantA._id}/shopify \\`,
    );
    this.logger.log(`     -H "Content-Type: application/json" \\`);
    this.logger.log(
      `     -d '{"eventType":"order.created","id":"evt_001","order":{"total_price":750,"currency":"USD"}}'`,
    );
  }
}
