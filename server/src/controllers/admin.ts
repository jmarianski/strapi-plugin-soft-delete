import type { Core } from '@strapi/strapi';
import { supportsContentType } from '../utils/plugin';

const admin = ({ strapi }: { strapi: Core.Strapi }) => ({
  async getContentTypes(ctx: any) {
    try {
      const contentTypes = Object.keys(strapi.contentTypes)
        .filter(supportsContentType)
        .map((uid) => {
          const contentType = strapi.contentTypes[uid];
          return {
            uid,
            displayName: contentType.info?.displayName || contentType.modelName,
            pluralName: contentType.info?.pluralName || contentType.collectionName,
          };
        });

      ctx.body = { contentTypes };
    } catch (error) {
      ctx.throw(500, error);
    }
  },

  async getSoftDeletedEntries(ctx: any) {
    try {
      const { uid } = ctx.params;

      if (!supportsContentType(uid)) {
        return ctx.throw(400, 'Content type not supported');
      }

      // Check permissions
      const ability = await strapi.admin.services.permission.engine.generateUserAbility(
        ctx.state.user
      );
      const canRead = ability.can('plugin::soft-delete.explorer.read');

      if (!canRead) {
        return ctx.throw(403, 'Forbidden');
      }

      const entries = await strapi.db.query(uid).findMany({
        where: {
          _softDeletedAt: {
            $notNull: true,
          },
        },
        orderBy: { _softDeletedAt: 'desc' },
        populate: ctx.query.populate,
      });

      ctx.body = { entries };
    } catch (error) {
      ctx.throw(500, error);
    }
  },

  async restoreEntry(ctx: any) {
    try {
      const { uid, id } = ctx.params;

      if (!supportsContentType(uid)) {
        return ctx.throw(400, 'Content type not supported');
      }

      // Check permissions
      const ability = await strapi.admin.services.permission.engine.generateUserAbility(
        ctx.state.user
      );
      const canRestore = ability.can('plugin::soft-delete.explorer.restore');

      if (!canRestore) {
        return ctx.throw(403, 'Forbidden');
      }

      const entry = await strapi.db.query(uid).update({
        where: { id },
        data: {
          _softDeletedAt: null,
          _softDeletedById: null,
          _softDeletedByType: null,
        },
      });

      ctx.body = { entry };
    } catch (error) {
      ctx.throw(500, error);
    }
  },

  async deletePermanently(ctx: any) {
    try {
      const { uid, id } = ctx.params;

      if (!supportsContentType(uid)) {
        return ctx.throw(400, 'Content type not supported');
      }

      // Check permissions
      const ability = await strapi.admin.services.permission.engine.generateUserAbility(
        ctx.state.user
      );
      const canDeletePermanently = ability.can('plugin::soft-delete.explorer.delete-permanently');

      if (!canDeletePermanently) {
        return ctx.throw(403, 'Forbidden');
      }

      await strapi.db.query(uid).delete({
        where: { id },
      });

      ctx.body = { success: true };
    } catch (error) {
      ctx.throw(500, error);
    }
  },

  async getSettings(ctx: any) {
    try {
      // Check permissions
      const ability = await strapi.admin.services.permission.engine.generateUserAbility(
        ctx.state.user
      );
      const canReadSettings = ability.can('plugin::soft-delete.settings');

      if (!canReadSettings) {
        return ctx.throw(403, 'Forbidden');
      }

      const pluginStore = strapi.store({
        environment: strapi.config.environment,
        type: 'plugin',
        name: 'soft-delete',
      });

      const settings = await pluginStore.get({ key: 'settings' });

      ctx.body = { settings };
    } catch (error) {
      ctx.throw(500, error);
    }
  },

  async updateSettings(ctx: any) {
    try {
      // Check permissions
      const ability = await strapi.admin.services.permission.engine.generateUserAbility(
        ctx.state.user
      );
      const canUpdateSettings = ability.can('plugin::soft-delete.settings');

      if (!canUpdateSettings) {
        return ctx.throw(403, 'Forbidden');
      }

      const { body } = ctx.request;

      const pluginStore = strapi.store({
        environment: strapi.config.environment,
        type: 'plugin',
        name: 'soft-delete',
      });

      await pluginStore.set({ key: 'settings', value: body });

      ctx.body = { settings: body };
    } catch (error) {
      ctx.throw(500, error);
    }
  },
});

export default admin;
