import type { Role } from '@prisma/client';

declare module 'express-serve-static-core' {
  interface Request {
    /** Populated by the requireAuth middleware for authenticated requests. */
    user?: {
      id: string;
      role: Role;
    };
  }
}
