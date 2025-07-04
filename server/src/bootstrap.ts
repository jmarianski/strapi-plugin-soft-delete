import type { Core } from '@strapi/strapi';
import { pluginId, supportsContentType } from './utils/plugin';
import { getSoftDeletedByAuth, eventHubEmit } from './utils';
import {
  ensureSoftDeleteColumns,
  hasSoftDeleteColumns,
  getSoftDeleteFields,
} from './utils/database';
import { setupQueryInterceptor } from './utils/query-interceptor';
import * as SoftDeleteStatus from './utils/soft-delete-status';

interface PluginSettings {
  singleTypesRestorationBehavior?: string;
  draftPublishRestorationBehavior?: string;
}

const bootstrap = ({ strapi }: { strapi: Core.Strapi }) => {
  console.log('Soft Delete plugin bootstrap started');

  // Setup Database Schema and Query Interceptor
  const setupDatabaseSchema = async () => {
    try {
      await ensureSoftDeleteColumns(strapi);
      console.log('[SOFT DELETE] Database schema setup completed');
      
      // Setup automatic query filtering after database columns are ready
      await setupQueryInterceptor(strapi);
      console.log('[SOFT DELETE] Query interceptor setup completed');
    } catch (error) {
      console.error('[SOFT DELETE] Database setup failed:', error);
    }
  };
  // Setup Plugin Settings
  const setupPluginSettings = async () => {
    const pluginStore = strapi.store({
      environment: strapi.config.environment,
      type: 'plugin',
      name: pluginId,
    });

    const pluginStoreSettings = (await pluginStore.get({
      key: 'settings',
    })) as PluginSettings | null;
    if (
      !pluginStoreSettings ||
      !pluginStoreSettings.singleTypesRestorationBehavior ||
      !pluginStoreSettings.draftPublishRestorationBehavior
    ) {
      const defaultSettings = {
        singleTypesRestorationBehavior:
          pluginStoreSettings?.singleTypesRestorationBehavior || 'soft-delete',
        draftPublishRestorationBehavior:
          pluginStoreSettings?.draftPublishRestorationBehavior || 'unchanged',
      };
      await pluginStore.set({ key: 'settings', value: defaultSettings });
    }
  };

  // Setup Permissions
  const setupPermissions = () => {
    try {
      // Change the display name of the delete permission
      const deleteAction = strapi.admin.services.permission.actionProvider.get(
        'plugin::content-manager.explorer.delete'
      );
      if (deleteAction) {
        deleteAction.displayName = 'Soft Delete';
      }

      const contentTypeUids = Object.keys(strapi.contentTypes).filter(supportsContentType);
      console.log(`Content types supported for soft delete: ${contentTypeUids.join(', ')}`);

      // Register plugin permissions
      strapi.admin.services.permission.actionProvider.register({
        uid: 'read',
        displayName: 'Read',
        pluginName: pluginId,
        section: 'plugins',
      });

      strapi.admin.services.permission.actionProvider.register({
        uid: 'settings',
        displayName: 'Settings',
        pluginName: pluginId,
        section: 'plugins',
      });

      strapi.admin.services.permission.actionProvider.register({
        uid: 'explorer.read',
        displayName: 'Deleted Read',
        pluginName: pluginId,
        section: 'plugins',
      });

      strapi.admin.services.permission.actionProvider.register({
        uid: 'explorer.restore',
        displayName: 'Deleted Restore',
        pluginName: pluginId,
        section: 'plugins',
      });

      strapi.admin.services.permission.actionProvider.register({
        uid: 'explorer.delete-permanently',
        displayName: 'Delete Permanently',
        pluginName: pluginId,
        section: 'plugins',
      });
    } catch (error) {
      console.error('Error setting up permissions:', error);
    }
  };

  // Setup Entity Service Decoration
  const setupEntityServiceDecoration = () => {
    // Try different approaches to access decorate
    try {
      strapi.documents.use(async (context: any, next) => {
        const { action, uid, params } = context;

        // Handle delete operations
        if (action === 'delete' && supportsContentType(uid)) {
          // Get the document ID from params
          const { documentId } = params;
          if (!documentId) {
            return next();
          }

          try {
            // Check if this content type has soft delete columns
            const hasColumns = await hasSoftDeleteColumns(strapi, uid);
            if (!hasColumns) {
              console.log(
                `[SOFT DELETE] No soft delete columns found for ${uid}, proceeding with hard delete`
              );
              return next();
            }

            // Ensure the entity exists
            const entity = await strapi.documents(uid).findOne({ documentId });

            if (!entity) {
              return next();
            }

            // Get auth info from request context
            const ctx = strapi.requestContext.get();
            const { id: authId, strategy: authStrategy } = getSoftDeletedByAuth(ctx?.state?.auth);

            // Use camelCase field names to match existing codebase
            const fields = getSoftDeleteFields();
            const softDeleteData = {
              [fields.deletedAt]: new Date().toISOString(),
              [fields.deletedById]: authId,
              [fields.deletedByType]: authStrategy,
            };

            // Check if this content type supports draft/publish
            const contentType = strapi.contentTypes[uid];
            const supportsDraftPublish = contentType?.options?.draftAndPublish;
            const tableName = contentType.collectionName || contentType.info.singularName;

            let softDeletedEntity;

            if (supportsDraftPublish) {
              // For draft/publish content types, we need to soft-delete both versions
              // Use raw SQL to avoid schema validation issues
              const knex = strapi.db.connection;

              // Update both draft and published versions
              await knex(tableName).where('document_id', documentId).update(softDeleteData);

              // Get the updated entity to return (use entity service since we're just reading)
              softDeletedEntity = await strapi.documents(uid).findOne({ documentId });
            } else {
              // For non-draft/publish content types, use raw SQL update
              const knex = strapi.db.connection;

              await knex(tableName).where('document_id', documentId).update(softDeleteData);

              // Get the updated entity to return
              softDeletedEntity = await strapi.documents(uid).findOne({ documentId });
            }

            // Emit soft delete event
            eventHubEmit({
              uid,
              event: 'entry.delete',
              action: 'soft-delete',
              entity: softDeletedEntity,
            });

            // Return the soft deleted entity instead of proceeding with actual deletion
            context.result = softDeletedEntity;
            return; // Don't call next() to prevent actual deletion
          } catch (error) {
            console.error('Soft delete failed:', error);
            // If soft delete fails, DONT proceed with original delete
            //return next();
            return;
          }
        }

        // Handle find operations - now we have automatic filtering via query interceptor!
        if (['findOne', 'findMany', 'findFirst'].includes(action) && supportsContentType(uid)) {
          console.log(`[SOFT DELETE] Find operation for ${uid} - automatic filtering active via query interceptor`);
        }

        // Continue with the operation
        return next();
      });
    } catch (error) {}
  };

  // Initialize everything
  setupPluginSettings();
  setupPermissions();
  setupEntityServiceDecoration();

  // Setup database schema after everything else is ready
  setupDatabaseSchema();
};

export default bootstrap;
