import { isSchema, object } from 'yup';
import { Schema, ValidateOptions, ValidationError } from 'yup';
import { Request, Response, NextFunction } from 'express';
import deepmerge from 'deepmerge';
import get from 'lodash.get';

type ResponseOptions = {
  errorCode?: number;
  returnErrors?: boolean;
  transformErrors?: (errors: Array<string>) => Array<string>
}

type ExpressYupMiddlewareConfig = {
  validateOptions?: ValidateOptions,
  responseOptions?: ResponseOptions,
  entityFrom: 'query' | 'body' | 'other',
  entityPath?: string,
  transformEntity?: (entity: any) => any
}

const defaults: ExpressYupMiddlewareConfig = {
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
}

function getSchema(schema: Schema<any> | object, validateOptions: ValidateOptions) {
  if (isSchema(schema)) {
    return schema;
  }

  return object(schema).strict(validateOptions.strict);
}

export default function validate(schema: Schema<any> | Object, options?: ExpressYupMiddlewareConfig) {
  const configs: ExpressYupMiddlewareConfig = deepmerge(
    defaults,
    options || {}
  );

  const finalSchema = getSchema(schema, configs.validateOptions);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      let entity: any;

      if (configs.entityFrom === 'body') {
        entity = configs.entityPath ? get(req.body, configs.entityPath, {}) : req.body;
      } else if (configs.entityFrom === 'query') {
        entity = configs.entityPath ? get(req.query, configs.entityPath, {}) : req.query;
      } else {
        entity = configs.entityPath ? get(req, configs.entityPath, {}) : null;
      }

      if (typeof configs.transformEntity === 'function') {
        entity = configs.transformEntity(entity);
      }

      await finalSchema.validate(entity, configs.validateOptions);
      next();
    } catch (error) {
      if (!(error instanceof ValidationError)) {
        throw error;
      }

      const { errors } = error;
      let payload = [];

      if (
        Array.isArray(errors)
        && typeof configs.responseOptions.transformErrors === 'function'
      ) {
        payload = configs.responseOptions.transformErrors(errors);
      }

      res
        .status(configs.responseOptions.errorCode)
        .send(configs.responseOptions.returnErrors ? { errors: payload } : {});
    }
  }
}