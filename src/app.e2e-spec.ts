import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './app.module';

describe('App (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health', () => {
    it('/health (GET)', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect({ status: 'ok' });
    });
  });

  describe('Printers', () => {
    it('/printers (GET) without API key should fail', () => {
      return request(app.getHttpServer())
        .get('/printers')
        .expect(401);
    });

    it('/printers (GET) with API key', () => {
      process.env.API_KEY = 'test-key';
      return request(app.getHttpServer())
        .get('/printers')
        .set('X-API-Key', 'test-key')
        .expect(200)
        .expect((res) => {
          expect(res.body.printers).toBeDefined();
          expect(res.body.printers.length).toBe(2);
        });
    });
  });
});
