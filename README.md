# express-yup-middleware

Middleware to validate incoming data in express endpoints using Yup's dead simple schema validation.

[![Build Status](https://travis-ci.org/flasd/express-yup-middleware.svg?branch=master)](https://travis-ci.org/flasd/express-yup-middleware)
[![Coverage Status](https://coveralls.io/repos/github/flasd/express-yup-middleware/badge.svg?branch=master)](https://coveralls.io/github/flasd/express-yup-middleware?branch=master)
[![npm version](https://badge.fury.io/js/flasd%2Fexpress-yup-middleware.svg)](https://www.npmjs.com/package/@flasd/express-yup-middleware)
[![npm downloads per month](https://img.shields.io/npm/dm/@flasd/express-yup-middleware.svg)](https://www.npmjs.com/package/@flasd/express-yup-middleware)

## Instalation

Install the latest version of express-yup-middleware:

```
$ yarn add @flasd/express-yup-middleware

// if you are feeling old school
$ npm install @flasd/express-yup-middleware --save
```

Now you just import it as a module:

```javascript
const createValidation = require('express-yup-middleware');

// ou, em ES6+

import createValidation from 'express-yup-middleware';
```

This module is [UMD](https://github.com/umdjs/umd) compliant, therefore it's compatible with RequireJs, AMD, CommonJs 1 & 2, etc. It would even work on the browser, but you probably should only use it in NodeJs.

Also, this comes with type definitions in Typescript!

## API & Usage.

#### createValidation();

Method signature:

```typescript
function createValidation<T>(
  schema: Schema<object> | ObjectSchemaDefinition<object>,
  entityFrom: 'query' | 'body' | 'request' = 'body',
  options?: ExpressYupMiddlewareOptions,
): QueryValidator<T> | BodyValidator<T> | RequestValidator;
```

```typescript
import createValidation from 'express-yup-middleware';
import express from 'express';
import * as Yup from 'yup';

const validate = createValidation({
  name: Yup.string('Name must be a string!')
    .min(3, 'Name too short!')
    .required('Name is required!'),
});

const app = express();

app.post('/save-name', [
  validate,
  (req, res) => {
    /* req.body.name has been validated! */
  },
]);
```

#### Args

##### schema: Schema<any> | any,

This first argument passed to `createValidation` is a Yup schema or an Object that can will transformed into one.
All are valid:

```typescript
/* here req.body must be an object */
createValidation({
  name: Yup.string().required(),
});

// or
/* here req.body must also be an object */
createValidation(
  Yup.object().shape({
    name: Yup.string().required(),
  }),
);

// or
/* here req.body must be an array */
createValidation(Yup.array());
```

##### entityFrom: 'query' | 'body' | 'request' = 'body',

```typescript
/* here req.body must be an object */
createValidation(
  {
    name: Yup.string().required(),
  },
  'body',
);

// or
/* here req.body must also be an object */
createValidation(
  Yup.object().shape({
    name: Yup.string().required(),
  }),
  'query',
);

// or
/* here req.body must be an array */
createValidation(Yup.string(), 'request', {
  entityPath: ['headers', 'authroization'],
});
```

##### options?: ExpressYupMiddlewareOptions

The second argument passed to `createValidation` is an optional configuration object:

```typescript
type ExpressYupMiddlewareOptions = {
  // Yup schema.validate(options) object. Check their documentation! (link below)
  /* Defaults are:
   * {
   *   strict: true,
   *   stripUnknown: true,
   *   abortEarly: false,
   * }
   */
  validateOptions?: ValidateOptions;

  // Whenever validation fails, how to send the response to client?
  responseOptions?: {
    // res.status(errorCode), defaults is 422 (Unprocessable Entity)
    errorCode?: number;
    // should we return errors to the client? default is true
    returnErrors?: boolean;

    // If you need to transform errors returned from Yup before sending them:
    transformErrors?: (errors: Array<string>) => any;
  };

  // where in the given object is the data to be validated (uses lodash.get to access data)
  // if you want to only validate nested data (eg: req.body.data), pass 'data'
  // if 'entityFrom' is 'request' and you want to access, for example, req.files, pass 'files';
  entityPath?: string | number | Array<string | number>;

  // If you need to transform the entity in some way before validating:
  transformEntity?: (entity: any) => any;
};
```

#### Middleware

When you call `createValidation()` the returned value will be a regular express middleware.

```typescript
const app = express();

const validateHeader = createValidation(
  Yup.string().required('Authorization'),
  'request',
  { entityPath: ['headers', 'Authorization'] },
);

app.use(validateHeader);

const validateLogin = createValidation(
  {
    email: Yup.string().email().required(),
    password: Yup.string().required(),
  },
  'body',
  { responseOptions: { errorCode: 401 } },
);

app.post('/login', [
  validateLogin,
  (req, res) => {
    /* do login */
  },
]);
```

### Copyright & License

Copyright (c) 2020 [Marcel de Oliveira Coelho](https://github.com/flasd) under the [MIT License](https://github.com/flasd/express-yup-middleware/blob/master/LICENSE.md). Go Crazy. :rocket:
