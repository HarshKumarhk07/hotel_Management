import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

/**
 * OpenAPI definition. Route-level docs are written as JSDoc `@openapi` blocks in
 * each *.routes.ts file and merged in here via the `apis` glob.
 */
export const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'KDS & QR Room Ordering API',
      version: '0.1.0',
      description:
        'Enterprise Kitchen Display System & QR room food-ordering platform. Phase 1: Auth & Security.',
    },
    servers: [{ url: `${env.API_URL}${env.API_PREFIX}`, description: env.NODE_ENV }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string' },
                message: { type: 'string' },
                details: { type: 'object' },
                requestId: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  apis: ['./src/modules/**/*.routes.ts', './src/modules/**/*.routes.js'],
});
