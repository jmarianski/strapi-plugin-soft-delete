export const pluginId = 'soft-delete';
export const name = 'Soft Delete';

export const supportsContentType = (uid?: string) => {
  const isSupported = uid?.match(/^api::/) || false;
  return isSupported;
};
