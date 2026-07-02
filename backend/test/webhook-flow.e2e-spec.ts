import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TenantDocument } from '../src/modules/tenants/schemas/tenant.schema';
import { WebhookEventDocument } from '../src/modules/webhooks/schemas/webhook-event.schema';
import { createHmac } from 'crypto';

describe('Webhook Engine (e2e)', () => {
  let app: INestApplication;
  let tenantModel: Model<TenantDocument>;
  let webhookEventModel: Model<WebhookEventDocument>;
  let testTenant: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Setup same global pipes as main.ts
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // Explicitly enable rawBody to allow HMAC verification
    // (Note: in E2E tests with supertest, rawBody might need special handling,
    // but we simulate it by stringifying the payload).
    
    await app.init();

    tenantModel = moduleFixture.get<Model<TenantDocument>>(getModelToken('Tenant'));
    webhookEventModel = moduleFixture.get<Model<WebhookEventDocument>>(getModelToken('WebhookEvent'));

    // Create a test tenant
    testTenant = await tenantModel.create({
      name: 'Test Tenant',
      slug: `test-tenant-${Date.now()}`,
      webhookSecret: 'test_secret_key_123',
      isActive: true,
    });
  });

  afterAll(async () => {
    await tenantModel.deleteMany({ _id: testTenant._id });
    await webhookEventModel.deleteMany({ tenantId: testTenant._id });
    await app.close();
  });

  const generateSignature = (payload: any, secret: string) => {
    return createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  };

  describe('Webhook Ingestion (/webhooks/:tenantId/:source)', () => {
    const payload = {
      eventType: 'order.created',
      id: `evt_test_${Date.now()}`,
      data: { amount: 100 }
    };

    it('should reject requests without a valid signature', () => {
      return request(app.getHttpServer())
        .post(`/webhooks/${testTenant._id}/shopify`)
        .send(payload)
        .set('x-webhook-signature', 'invalid_signature_hex')
        .expect(401);
    });

    it('should accept valid webhooks and return 200 fast ACK', async () => {
      const signature = generateSignature(payload, testTenant.webhookSecret);

      const response = await request(app.getHttpServer())
        .post(`/webhooks/${testTenant._id}/shopify`)
        .send(payload)
        .set('x-webhook-signature', signature)
        .expect(200);

      expect(response.body).toHaveProperty('status', 'accepted');
      expect(response.body).toHaveProperty('eventId');
      
      // Verify it was saved to DB
      const dbEvent = await webhookEventModel.findById(response.body.eventId);
      expect(dbEvent).toBeDefined();
      expect(dbEvent?.source).toBe('shopify');
    });

    it('should reject duplicate webhooks idempotently (return 200 but not process twice)', async () => {
      const dupPayload = {
        eventType: 'customer.updated',
        id: `evt_dup_${Date.now()}`, // Same ID for both requests
        data: { name: 'Duplicate Test' }
      };
      
      const signature = generateSignature(dupPayload, testTenant.webhookSecret);

      // First request - should be accepted
      const res1 = await request(app.getHttpServer())
        .post(`/webhooks/${testTenant._id}/shopify`)
        .send(dupPayload)
        .set('x-webhook-signature', signature)
        .expect(200);

      expect(res1.body.status).toBe('accepted');

      // Second request immediately after - should return duplicate status
      const res2 = await request(app.getHttpServer())
        .post(`/webhooks/${testTenant._id}/shopify`)
        .send(dupPayload)
        .set('x-webhook-signature', signature)
        .expect(200);

      expect(res2.body.status).toBe('duplicate');
      
      // Ensure only ONE event was saved in the DB for this idempotency key
      const count = await webhookEventModel.countDocuments({ 
        idempotencyKey: `idemp:${testTenant._id}:shopify:${dupPayload.id}` 
      });
      expect(count).toBe(1);
    });
  });

  describe('Tenant Isolation', () => {
    let tenantB: any;

    beforeAll(async () => {
      // Create a second tenant for isolation testing
      tenantB = await tenantModel.create({
        name: 'Isolation Test Tenant B',
        slug: `test-tenant-b-${Date.now()}`,
        webhookSecret: 'test_secret_b_456',
        isActive: true,
      });
    });

    afterAll(async () => {
      await tenantModel.deleteMany({ _id: tenantB._id });
      await webhookEventModel.deleteMany({ tenantId: tenantB._id });
    });

    it('should not allow Tenant A to see Tenant B events via API', async () => {
      const payloadB = {
        eventType: 'order.created',
        id: `evt_iso_b_${Date.now()}`,
        data: { tenant: 'B', amount: 999 },
      };

      // Send a webhook to Tenant B
      await request(app.getHttpServer())
        .post(`/webhooks/${tenantB._id}/shopify`)
        .send(payloadB)
        .expect(200);

      // Query events as Tenant A — should NOT see Tenant B's event
      const resA = await request(app.getHttpServer())
        .get('/api/events')
        .set('X-Tenant-Id', testTenant._id.toString())
        .expect(200);

      const tenantAEventIds = (resA.body.data || []).map((e: any) =>
        e.tenantId?.toString?.() || e.tenantId,
      );

      // None of Tenant A's returned events should belong to Tenant B
      for (const tid of tenantAEventIds) {
        expect(tid).not.toBe(tenantB._id.toString());
      }

      // Query events as Tenant B — should see Tenant B's event
      const resB = await request(app.getHttpServer())
        .get('/api/events')
        .set('X-Tenant-Id', tenantB._id.toString())
        .expect(200);

      const tenantBEvents = resB.body.data || [];
      expect(tenantBEvents.length).toBeGreaterThan(0);
      // All Tenant B's events should belong to Tenant B
      for (const event of tenantBEvents) {
        const eventTenantId = event.tenantId?.toString?.() || event.tenantId;
        expect(eventTenantId).toBe(tenantB._id.toString());
      }
    });

    it('should reject requests with a non-existent tenant ID', async () => {
      const fakeId = '000000000000000000000000'; // Valid ObjectId format, but doesn't exist

      await request(app.getHttpServer())
        .get('/api/events')
        .set('X-Tenant-Id', fakeId)
        .expect(401); // TenantGuard should reject
    });
  });
});
