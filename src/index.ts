import {
  isSchema,
  object,
  ValidationError,
  ObjectSchemaDefinition,
  Schema,
  ValidateOptions,
  ObjectSchema,
  // Its a peer dependency!
  // eslint-disable-next-line import/no-unresolved
} from 'yup';

import {
  Request, Response, NextFunction, request,
  // Its a peer dependency!
  // eslint-disable-next-line import/no-unresolved
} from 'express';
import deepmerge from 'deepmerge';
import get from 'lodash.get';

type ResponseOptions = {
  errorCode?: number;
  returnErrors?: boolean;
  transformErrors?: (errors: Array<string>) => any
}

export type ExpressYupMiddlewareOptions = {
  validateOptions?: ValidateOptions,
  responseOptions?: ResponseOptions,
  entityFrom?: 'query' | 'body' | 'request',
  entityPath?: string | number | Array<string | number>,
  transformEntity?: (entity: any) => any
}

export interface ExpressYupMiddleware<T> {
  (req: Request, res: Response, next: NextFunction): Promise<void>
}


const defaults: ExpressYupMiddlewareOptions = {
  validateOptions: {
    strict: true,
    stripUnknown: true,
    abortEarly: false,
  },
  responseOptions: {
    errorCode: 422,
    returnErrors: true,
    transformErrors: (e) => e,
  },
  entityFrom: 'body',
};

function getSchema<T>(
  schema: Schema<T> | ObjectSchemaDefinition<object & T>,
  validateOptions: ValidateOptions,
): Schema<T> | ObjectSchema<object & T> {
  if (isSchema(schema)) {
    return schema as Schema<T>;
  }

  return object<object & T>(schema).strict(validateOptions.strict);
}

function getEntity(req: Request, configs: ExpressYupMiddlewareOptions): any {
  const { entityFrom, entityPath } = configs;

  switch (entityFrom) {
    case 'query':
      return entityPath ? get(req.query, entityPath, {}) : req.query;
    case 'request':
      return entityPath ? get(req, entityPath, {}) : {};
    case 'body':
    default:
      return entityPath ? get(req.body, entityPath, {}) : req.body;
  }
}

function is<T>(it: any): it is T {
  return it;
}

function typeGuard<T>(
  req: Request,
  config: ExpressYupMiddlewareOptions,
) {
  const { entityFrom, entityPath } = config;

  if (entityFrom !== 'request') {
    return is<T>(req[entityFrom]);
  }

  return get(request, entityPath) as T;
}

export default function createValidation<T>(
  schema: Schema<T> | ObjectSchemaDefinition<object & T>,
  options?: ExpressYupMiddlewareOptions,
): ExpressYupMiddleware<T> {
  const configs: ExpressYupMiddlewareOptions = deepmerge(
    defaults,
    options || {},
  );

  const finalSchema = getSchema(schema, configs.validateOptions);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let entity: NonNullable<any> = getEntity(req, configs);

      if (typeof configs.transformEntity === 'function') {
        entity = configs.transformEntity(entity) || {};
      }

      await finalSchema
        .validate(entity, configs.validateOptions);

      typeGuard(req, configs);

      next();
    } catch (error) {
      if (!(error instanceof ValidationError)) {
        throw error;
      }

      const { errors } = error;
      let payload: string[] = [];

      if (typeof configs.responseOptions.transformErrors !== 'function') {
        // eslint-disable-next-line no-console
        console.warn(
          `[expressYupMiddleware]: configs.responseOptions.transformErrors must be a function. Instead got ${typeof configs.responseOptions.transformErrors}`,
        );
      }

      if (
        Array.isArray(errors)
        && typeof configs.responseOptions.transformErrors === 'function'
      ) {
        payload = configs.responseOptions.transformErrors(errors);
      }

      res
        .status(configs.responseOptions.errorCode)
        .send(configs.responseOptions.returnErrors ? { errors: payload } : { errors: [] });
    }
  };
}
