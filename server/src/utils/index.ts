import type { Core } from '@strapi/strapi';

export const getSoftDeletedByAuth = (auth: any) => {
  if (auth?.strategy === 'users-permissions') {
    return {
      id: auth.credentials?.id || null,
      strategy: 'users-permissions',
    };
  }

  if (auth?.strategy === 'admin') {
    return {
      id: auth.credentials?.id || null,
      strategy: 'admin',
    };
  }

  return {
    id: null,
    strategy: 'unknown',
  };
};

export const eventHubEmit = (params: {
  uid: string;
  event: string;
  action: string;
  entity: any;
}) => {
  const { uid, event, action, entity } = params;

  // Use strapi.eventHub.emit in a way that works with our plugin identification
  // @ts-ignore - strapi is available globally
  strapi.eventHub.emit(event, {
    uid,
    entry: entity,
    plugin: {
      id: 'soft-delete',
    },
    action,
  });
};

// Export soft delete status utilities
export * as SoftDeleteStatus from './soft-delete-status';
