export default [
  {
    method: 'GET',
    path: '/content-types',
    handler: 'admin.getContentTypes',
    config: {
      policies: [],
    },
  },
  {
    method: 'GET',
    path: '/content-types/:uid/entries',
    handler: 'admin.getSoftDeletedEntries',
    config: {
      policies: [],
    },
  },
  {
    method: 'PUT',
    path: '/content-types/:uid/entries/:id/restore',
    handler: 'admin.restoreEntry',
    config: {
      policies: [],
    },
  },
  {
    method: 'DELETE',
    path: '/content-types/:uid/entries/:id',
    handler: 'admin.deletePermanently',
    config: {
      policies: [],
    },
  },
  {
    method: 'GET',
    path: '/settings',
    handler: 'admin.getSettings',
    config: {
      policies: [],
    },
  },
  {
    method: 'PUT',
    path: '/settings',
    handler: 'admin.updateSettings',
    config: {
      policies: [],
    },
  },
];
