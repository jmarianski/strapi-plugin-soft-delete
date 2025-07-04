import type { Core } from '@strapi/strapi';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  // We don't add fields to content type schemas here anymore
  // Instead, we'll handle soft delete fields at the database level
  // This prevents them from appearing in TypeScript generated schemas
  console.log('Soft Delete plugin registered');
};

export default register;
