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

      // Check if this content type supports draft/publish
      const contentType = strapi.contentTypes[uid];
      const supportsDraftPublish = contentType?.options?.draftAndPublish;
      console.log(
        `Content type ${uid} supports draft/publish: ${supportsDraftPublish}`,
        contentType
      );
      if (supportsDraftPublish) {
        // Group entries by documentId for draft/publish content types
        const groupedEntries = new Map();

        entries.forEach((entry) => {
          const docId = entry.documentId || entry.id;
          if (!groupedEntries.has(docId)) {
            groupedEntries.set(docId, {
              documentId: docId,
              versions: [],
              _softDeletedAt: entry._softDeletedAt, // Use the latest deletion time for sorting
            });
          }
          groupedEntries.get(docId).versions.push({
            ...entry,
            status: entry.publishedAt ? 'published' : 'draft',
          });
        });

        // Convert to array and sort by deletion time
        const groupedArray = Array.from(groupedEntries.values()).sort(
          (a, b) => new Date(b._softDeletedAt).getTime() - new Date(a._softDeletedAt).getTime()
        );

        ctx.body = { entries: groupedArray, grouped: true };
      } else {
        // For non-draft/publish content types, return entries as before
        ctx.body = { entries, grouped: false };
      }
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

      // Check if this content type supports draft/publish
      const contentType = strapi.contentTypes[uid];
      const supportsDraftPublish = contentType?.options?.draftAndPublish;

      const restoreData = {
        _softDeletedAt: null,
        _softDeletedById: null,
        _softDeletedByType: null,
      };

      let restoredEntries = [];

      if (supportsDraftPublish) {
        // For draft/publish content types, treat the id as documentId and restore all versions
        const documentId = id;

        // Find all entries with this documentId that are soft deleted
        const entriesToRestore = await strapi.db.query(uid).findMany({
          where: {
            $and: [{ documentId }, { _softDeletedAt: { $notNull: true } }],
          },
        });

        if (entriesToRestore.length === 0) {
          return ctx.throw(404, 'No soft deleted entries found for this document');
        }

        // Restore all versions using document service
        for (const entry of entriesToRestore) {
          try {
            const status = entry.publishedAt ? 'published' : 'draft';
            const restoredEntry = await (strapi.documents(uid) as any).update({
              documentId,
              status,
              data: restoreData,
            });
            restoredEntries.push({ ...restoredEntry, status });
          } catch (error) {
            console.log(
              `Error restoring ${entry.publishedAt ? 'published' : 'draft'} version:`,
              error
            );

            // Fallback to database query for this specific entry
            try {
              const fallbackEntry = await strapi.db.query(uid).update({
                where: { id: entry.id },
                data: restoreData,
              });
              restoredEntries.push({
                ...fallbackEntry,
                status: entry.publishedAt ? 'published' : 'draft',
              });
            } catch (fallbackError) {
              console.error(`Failed to restore entry ${entry.id}:`, fallbackError);
            }
          }
        }
      } else {
        // For non-draft/publish content types, use the original approach with actual entry id
        const restoredEntry = await strapi.db.query(uid).update({
          where: { id },
          data: restoreData,
        });
        restoredEntries.push(restoredEntry);
      }

      ctx.body = {
        entries: restoredEntries,
        message: `Restored ${restoredEntries.length} version(s) of the document`,
      };
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

      // Check if this content type supports draft/publish
      const contentType = strapi.contentTypes[uid];
      const supportsDraftPublish = contentType?.options?.draftAndPublish;

      let deletedCount = 0;

      if (supportsDraftPublish) {
        // For draft/publish content types, treat the id as documentId and delete all versions
        const documentId = id;

        // Find all entries with this documentId that are soft deleted
        const entriesToDelete = await strapi.db.query(uid).findMany({
          where: {
            $and: [{ documentId }, { _softDeletedAt: { $notNull: true } }],
          },
        });

        if (entriesToDelete.length === 0) {
          return ctx.throw(404, 'No soft deleted entries found for this document');
        }

        // Delete all versions
        for (const entry of entriesToDelete) {
          await strapi.db.query(uid).delete({
            where: { id: entry.id },
          });
          deletedCount++;
        }
      } else {
        // For non-draft/publish content types, use the original approach with actual entry id
        await strapi.db.query(uid).delete({
          where: { id },
        });
        deletedCount = 1;
      }

      ctx.body = {
        success: true,
        deletedCount,
        message: `Permanently deleted ${deletedCount} version(s) of the document`,
      };
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
