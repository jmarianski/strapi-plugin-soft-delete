import type { Core } from '@strapi/strapi';
import { supportsContentType } from './utils/plugin';

const register = ({ strapi }: { strapi: Core.Strapi }) => {
  // Add soft delete fields to all supported content types
  for (const [uid, contentType] of Object.entries(strapi.contentTypes)) {
    if (supportsContentType(uid)) {
      const _softDeletedAt = {
        type: 'datetime',
        configurable: false,
        writable: false,
        visible: false,
        private: true,
      };
      contentType.attributes._softDeletedAt = _softDeletedAt;

      const _softDeletedById = {
        type: 'integer',
        configurable: false,
        writable: false,
        visible: false,
        private: true,
      };
      contentType.attributes._softDeletedById = _softDeletedById;

      const _softDeletedByType = {
        type: 'string',
        configurable: false,
        writable: false,
        visible: false,
        private: true,
      };
      contentType.attributes._softDeletedByType = _softDeletedByType;
    }
  }
};

export default register;
