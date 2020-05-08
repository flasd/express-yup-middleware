import {
  isSchema,
  object,
  ValidationError,
  ObjectSchemaDefinition,
  Schema,
  ValidateOptions,
  ObjectSchema,
} from 'yup';

import { Request, Response, NextFunction } from 'express';
import deepmerge from 'deepmerge';
import get from 'lodash.get';
import {
  Params,
  ParamsDictionary,
  Query,
  // eslint-disable-next-line import/no-unresolved
} from 'express-serve-static-core';

interface RequestHandler<
  P extends Params = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = Query
> {
  (
    req: Request<P, ResBody, ReqBody, ReqQuery>,
    res: Response<ResBody>,
    next: NextFunction,
  ): any;
}

type ResponseOptions = {
  errorCode?: number;
  returnErrors?: boolean;
  transformErrors?: (errors: Array<string>) => any;
};

export type ExpressYupMiddlewareOptions = {
  validateOptions?: ValidateOptions;
  responseOptions?: ResponseOptions;
  entityPath?: string | number | Array<string | number>;
  transformEntity?: (entity: any) => any;
};

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

type QueryValidator<Q> = RequestHandler<ParamsDictionary, any, any, Q>;
type BodyValidator<B> = RequestHandler<ParamsDictionary, any, B, Query>;
type RequestValidator = RequestHandler<ParamsDictionary, any, any, Query>;

export default function createValidation<T>(
  schema: Schema<object> | ObjectSchemaDefinition<object>,
  entityFrom: 'query' | 'body' | 'request' = 'body',
  options?: ExpressYupMiddlewareOptions,
): QueryValidator<T> | BodyValidator<T> | RequestValidator {
  const configs: ExpressYupMiddlewareOptions = deepmerge(
    defaults,
    typeof entityFrom !== 'string' ? entityFrom : options || {},
  );

  const finalSchema = getSchema(schema, configs.validateOptions);

  const { entityPath } = configs;

  function handleError(res: Response, error: Error) {
    if (!(error instanceof ValidationError)) {
      if (process.env.NODE_ENV === 'development') {
        res.status(500).send(error);
      } else {
        res.status(500).send();
      }

      return;
    }

    const { errors } = error;
    let payload: string[] = [];

    if (typeof configs.responseOptions.transformErrors !== 'function') {
      // eslint-disable-next-line no-console
      console.warn(
        `[expressYupMiddleware]: configs.responseOptions.transformErrors must be a function. Instead got ${typeof configs
          .responseOptions.transformErrors}`,
      );
    }

    if (
      Array.isArray(errors) &&
      typeof configs.responseOptions.transformErrors === 'function'
    ) {
      payload = configs.responseOptions.transformErrors(errors);
    }

    res
      .status(configs.responseOptions.errorCode)
      .send(
        configs.responseOptions.returnErrors
          ? { errors: payload }
          : { errors: [] },
      );
  }

  if (entityFrom === 'body') {
    return async (
      req: Request & { body: any },
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        let entity = entityPath ? get(req.body, entityPath, {}) : req.body;

        if (typeof configs.transformEntity === 'function') {
          entity = configs.transformEntity(entity) || {};
        }

        await finalSchema.validate(entity, configs.validateOptions);

        next();
      } catch (error) {
        handleError(res, error);
      }
    };
  }

  if (entityFrom === 'query') {
    return async (
      req: Request & { query: any },
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        let entity = entityPath ? get(req.query, entityPath, {}) : req.query;

        if (typeof configs.transformEntity === 'function') {
          entity = configs.transformEntity(entity) || {};
        }

        await finalSchema.validate(entity, configs.validateOptions);

        next();
      } catch (error) {
        handleError(res, error);
      }
    };
  }

  if (entityFrom === 'request') {
    return async (
      req: Request,
      res: Response,
      next: NextFunction,
    ): Promise<void> => {
      try {
        let entity = entityPath ? get(req, entityPath, {}) : {};

        if (typeof configs.transformEntity === 'function') {
          entity = configs.transformEntity(entity) || {};
        }

        await finalSchema.validate(entity, configs.validateOptions);

        next();
      } catch (error) {
        handleError(res, error);
      }
    };
  }

  throw new Error(
    `[expressYupMiddleware]: Failed to instantiate validator. Option ${entityFrom} is not valid oneOf ['body', 'query', 'request']`,
  );
}
