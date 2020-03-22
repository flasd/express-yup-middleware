/* eslint-disable import/no-unresolved */
import request from 'supertest';
import * as Yup from 'yup';
import express from 'express';
import bodyParser from 'body-parser';
import mockHttp from 'node-mocks-http';
import createValidation from '.';

function getApp() {
  const app = express();
  app.use(bodyParser.json());

  return app;
}


describe('expressYupMiddleware', () => {
  it('should be ok', () => {
    expect(createValidation).toBeTruthy();
    expect(typeof createValidation).toBe('function');
  });

  it('should create a middleware with default options', () => {
    expect(() => createValidation({ name: Yup.string().required() })).not.toThrow();

    const middleware = createValidation({ name: Yup.string().required() });
    expect(typeof middleware).toBe('function');
  });

  it('should validate with default options', async () => {
    const app = getApp();

    app.use(
      createValidation({ name: Yup.string().required() }),
    );

    const response = await request(app)
      .post('/any')
      .send({
        name: { not: 'a string' },
      });

    expect(response.status).toBe(422);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveLength(1);
    expect(response.body.errors[0]).toContain('name must be a `string`');
  });

  it('should validate arrays', async () => {
    const app = getApp();

    app.use(
      // entity should be Array<number>
      createValidation(Yup.array().of(Yup.number())),
    );

    const response = await request(app)
      .post('/any')
      .send([1, 2, '3']);

    expect(response.status).toBe(422);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveLength(1);
    expect(response.body.errors[0]).toContain('must be a `number`');
  });

  it('should validate numbers', async () => {
    const app = getApp();

    app.use(
      createValidation(Yup.number()),
    );

    const response = await request(app)
      .post('/any')
      .send('hello!');

    expect(response.status).toBe(422);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveLength(1);
    expect(response.body.errors[0]).toContain('must be a `number`');
  });

  it('should validate strings', async () => {
    const app = getApp();

    app.use(
      createValidation(Yup.string()),
    );

    const response = await request(app)
      .post('/any')
      .send('2');

    expect(response.status).toBe(422);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveLength(1);
    expect(response.body.errors[0]).toContain('must be a `string`');
  });

  it('should send custom error codes', async () => {
    const app = getApp();

    app.use(
      createValidation(Yup.string(), { responseOptions: { errorCode: 400 } }),
    );

    const response = await request(app)
      .post('/any')
      .send([1, 2, 3]);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveLength(1);
    expect(response.body.errors[0]).toContain('must be a `string`');
  });

  it('should not return errors when flag is set', async () => {
    const app = getApp();

    app.use(
      createValidation(Yup.string(), { responseOptions: { returnErrors: false } }),
    );

    const response = await request(app)
      .post('/any')
      .send([1, 2, 3]);

    expect(response.status).toBe(422);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveLength(0);
  });

  it('should transform errors properly', async () => {
    const app = getApp();

    const transformErrors = jest.fn()
      .mockImplementation((errors: string[]) => errors.map((error) => `## ${error}`));

    app.use(
      createValidation(Yup.string(), { responseOptions: { transformErrors } }),
    );

    const response = await request(app)
      .post('/any')
      .send([1, 2, 3]);

    expect(response.status).toBe(422);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveLength(1);
    expect(response.body.errors[0]).toContain('## ');
    expect(transformErrors).toHaveBeenCalled();
  });

  it('should extract entity from body when entityPath is set', async () => {
    const app = getApp();

    app.use(
      createValidation(Yup.number(), { entityFrom: 'body', entityPath: 'hello' }),
    );

    const response = await request(app)
      .post('/any')
      .send({ hello: 'world' });

    expect(response.status).toBe(422);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveLength(1);
    expect(response.body.errors[0]).toContain('number');
    expect(response.body.errors[0]).toContain('world');
  });

  it('should extract entity from query', async () => {
    const app = getApp();

    app.use(
      createValidation(Yup.number(), { entityFrom: 'query' }),
    );

    const response = await request(app)
      .get('/any')
      .query({ hello: 'world' })
      .send();

    expect(response.status).toBe(422);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveLength(1);
    expect(response.body.errors[0]).toContain('number');
    expect(response.body.errors[0]).toContain('hello');
    expect(response.body.errors[0]).toContain('world');
  });

  it('should extract entity from query when entityPath is set', async () => {
    const app = getApp();

    app.use(
      createValidation(Yup.number(), { entityFrom: 'query', entityPath: 'hello' }),
    );

    const response = await request(app)
      .get('/any')
      .query({ hello: 'world' })
      .send();

    expect(response.status).toBe(422);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveLength(1);
    expect(response.body.errors[0]).toContain('world');
  });

  it('should extract entity from request when entityPath is set', async () => {
    const app = getApp();

    app.use(
      createValidation(Yup.number().required(), {
        entityFrom: 'request',
        entityPath: ['headers', 'authorization'],
      }),
    );

    const response = await request(app)
      .get('/any')
      .set('Authorization', 'Bearer some.jwt.token')
      .send();

    expect(response.status).toBe(422);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveLength(1);
    expect(response.body.errors[0]).toContain('Bearer some.jwt.token');
  });

  it('should fail to extract entity from request when entityPath is not set', async () => {
    const app = getApp();

    app.use(
      createValidation(Yup.number().required(), {
        entityFrom: 'request',
      }),
    );

    const response = await request(app)
      .get('/any')
      .send();

    expect(response.status).toBe(422);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveLength(1);
    expect(response.body.errors[0]).toContain('number');
  });

  it('should transform entity when needed', async () => {
    const app = getApp();

    const transformEntity = jest.fn()
      .mockImplementation(
        (entity: { data: { world: string } }) => entity.data.world,
      );

    app.use(
      createValidation(Yup.string(), { transformEntity }),
    );

    app.use((req, res) => {
      // Respond with success status
      res.status(200).send({ success: true });
    });

    const response = await request(app)
      .post('/any')
      .send({
        data: {
          world: 'world',
        },
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
  });

  it('should fail when transform entity returns falsy', async () => {
    const app = getApp();

    const transformEntity = jest.fn()
      .mockImplementation(
        () => null,
      );

    app.use(
      createValidation(Yup.string(), { transformEntity }),
    );

    const response = await request(app)
      .post('/any')
      .send({
        data: {
          world: 'world',
        },
      });

    expect(response.status).toBe(422);
    expect(response.body).toHaveProperty('errors');
    expect(response.body.errors).toHaveLength(1);
    expect(response.body.errors[0]).toContain('string');
  });

  it('should throw non-validation errors', async () => {
    const req = mockHttp.createRequest();
    const res = mockHttp.createResponse();

    const error = new Error('Not a validation error');
    const transformEntity = jest.fn()
      .mockImplementationOnce(
        () => { throw error; },
      );

    try {
      const middleware = createValidation(Yup.string(), { transformEntity });
      await middleware(req, res, () => {});
    } catch (thrown) {
      expect(thrown).toBe(error);
    }
  });

  it('should warn when transformErros is not a function', async () => {
    /* eslint-disable no-console */
    const app = getApp();

    app.use(
      // Ignore type definition since we are testing exception
      // @ts-ignore
      createValidation(Yup.string(), { responseOptions: { transformErrors: 2 } }),
    );

    const { warn } = console;
    console.warn = jest.fn();

    await request(app)
      .post('/any')
      .send({});

    expect(console.warn).toHaveBeenCalled();

    console.warn = warn;
  });
});
