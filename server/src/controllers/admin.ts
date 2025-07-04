import type { Core } from '@strapi/strapi';
import { supportsContentType } from '../utils/plugin';
import { getSoftDeleteFields } from '../utils/database';

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

      // Get the table name for this content type
      const contentType = strapi.contentTypes[uid];
      const tableName = contentType.collectionName || contentType.info.singularName;
      const softDeleteFields = getSoftDeleteFields();

      // Use raw SQL to find soft deleted entries, bypassing schema validation
      const knex = strapi.db.connection;
      const entries = await knex(tableName)
        .whereNotNull(softDeleteFields.deletedAt)
        .orderBy(softDeleteFields.deletedAt, 'desc');

      // Check if this content type supports draft/publish
      const supportsDraftPublish = contentType?.options?.draftAndPublish;
      console.log(
        `Content type ${uid} supports draft/publish: ${supportsDraftPublish}`,
        contentType
      );

      if (supportsDraftPublish) {
        // Group entries by documentId for draft/publish content types
        const groupedEntries = new Map();

        entries.forEach((entry) => {
          const docId = entry.document_id || entry.id;
          if (!groupedEntries.has(docId)) {
            groupedEntries.set(docId, {
              documentId: docId,
              versions: [],
              [softDeleteFields.deletedAt]: entry[softDeleteFields.deletedAt], // Use the latest deletion time for sorting
            });
          }
          groupedEntries.get(docId).versions.push({
            ...entry,
            status: entry.published_at ? 'published' : 'draft',
          });
        });

        // Convert to array and sort by deletion time
        const groupedArray = Array.from(groupedEntries.values()).sort(
          (a, b) =>
            new Date(b[softDeleteFields.deletedAt]).getTime() -
            new Date(a[softDeleteFields.deletedAt]).getTime()
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
      const tableName = contentType.collectionName || contentType.info.singularName;
      const softDeleteFields = getSoftDeleteFields();

      const restoreData = {
        [softDeleteFields.deletedAt]: null,
        [softDeleteFields.deletedById]: null,
        [softDeleteFields.deletedByType]: null,
      };

      let restoredEntries = [];

      if (supportsDraftPublish) {
        // For draft/publish content types, treat the id as documentId and restore all versions
        const documentId = id;

        // Find all entries with this documentId that are soft deleted using raw SQL
        const knex = strapi.db.connection;
        const entriesToRestore = await knex(tableName)
          .where('document_id', documentId)
          .whereNotNull(softDeleteFields.deletedAt);

        if (entriesToRestore.length === 0) {
          return ctx.throw(404, 'No soft deleted entries found for this document');
        }

        // Restore all versions using direct database update
        for (const entry of entriesToRestore) {
          try {
            // Update directly in the database to avoid schema validation
            await knex(tableName).where('id', entry.id).update(restoreData);

            // Fetch the updated entry
            const updatedEntry = await knex(tableName).where('id', entry.id).first();

            restoredEntries.push({
              ...updatedEntry,
              status: entry.publishedAt ? 'published' : 'draft',
            });
          } catch (error) {
            console.error(`Failed to restore entry ${entry.id}:`, error);
          }
        }
      } else {
        // For non-draft/publish content types, use direct database update
        const knex = strapi.db.connection;

        await knex(tableName).where('id', id).update(restoreData);

        const restoredEntry = await knex(tableName).where('id', id).first();

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
      const tableName = contentType.collectionName || contentType.info.singularName;
      const softDeleteFields = getSoftDeleteFields();

      let deletedCount = 0;

      if (supportsDraftPublish) {
        // For draft/publish content types, treat the id as documentId and delete all versions
        const documentId = id;

        // Find all entries with this documentId that are soft deleted using raw SQL
        const knex = strapi.db.connection;
        const entriesToDelete = await knex(tableName)
          .where('document_id', documentId)
          .whereNotNull(softDeleteFields.deletedAt);

        if (entriesToDelete.length === 0) {
          return ctx.throw(404, 'No soft deleted entries found for this document');
        }

        // Delete all versions using direct database delete
        for (const entry of entriesToDelete) {
          await knex(tableName).where('id', entry.id).delete();
          deletedCount++;
        }
      } else {
        // For non-draft/publish content types, use direct database delete
        const knex = strapi.db.connection;
        const deletedRows = await knex(tableName).where('id', id).delete();
        deletedCount = deletedRows;
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
