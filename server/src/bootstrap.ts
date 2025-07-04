import type { Core } from '@strapi/strapi';
import { pluginId, supportsContentType } from './utils/plugin';
import { getSoftDeletedByAuth, eventHubEmit } from './utils';
import * as SoftDeleteStatus from './utils/soft-delete-status';

interface PluginSettings {
  singleTypesRestorationBehavior?: string;
  draftPublishRestorationBehavior?: string;
}

const bootstrap = ({ strapi }: { strapi: Core.Strapi }) => {
  console.log('Soft Delete plugin bootstrap started');
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
            // Ensure the entity exists
            const entity = await strapi.documents(uid).findOne({ documentId });

            if (!entity) {
              return next();
            }

            // Get auth info from request context
            const ctx = strapi.requestContext.get();
            const { id: authId, strategy: authStrategy } = getSoftDeletedByAuth(ctx?.state?.auth);

            const softDeleteData = {
              _softDeletedAt: new Date().toISOString(),
              _softDeletedById: authId,
              _softDeletedByType: authStrategy,
            };

            // Check if this content type supports draft/publish
            const contentType = strapi.contentTypes[uid];
            const supportsDraftPublish = contentType?.options?.draftAndPublish;

            let softDeletedEntity;

            if (supportsDraftPublish) {
              // For draft/publish content types, we need to soft-delete both versions
              
              // First, check if there's a published version
              let publishedEntity = null;
              try {
                publishedEntity = await strapi.documents(uid).findOne({ 
                  documentId,
                  status: 'published'
                });
              } catch (e) {
                // Published version might not exist
              }

              // Soft-delete the draft version
              const draftEntity = await (strapi.documents(uid) as any).update({
                documentId,
                status: 'draft',
                data: softDeleteData,
              });

              // If published version exists, soft-delete it too
              if (publishedEntity) {
                await (strapi.documents(uid) as any).update({
                  documentId,
                  status: 'published',
                  data: softDeleteData,
                });
              }

              softDeletedEntity = draftEntity;
            } else {
              // For non-draft/publish content types, update normally
              softDeletedEntity = await (strapi.documents(uid) as any).update({
                documentId,
                data: softDeleteData,
              });
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
            // If soft delete fails, proceed with original delete
            return next();
          }
        }

        // Handle find operations - filter based on soft delete status
        if (['findOne', 'findMany', 'findFirst'].includes(action) && supportsContentType(uid)) {
          // Only proceed if this content type actually has soft delete fields
          if (!SoftDeleteStatus.hasSoftDeleteFields(uid, strapi)) {
            console.log(`[SOFT DELETE] Skipping ${uid} - no soft delete fields in schema`);
            return next();
          }

          // Apply status-based filtering using our utility functions
          const contentType = strapi.contentTypes[uid];
          context.params = SoftDeleteStatus.statusToFilters(contentType, context.params);

          // Handle populated fields with status-aware filtering
          if (context.params.populate) {
            context.params.populate = SoftDeleteStatus.addSoftDeleteToPopulate(
              context.params.populate,
              uid,
              context.params.status || 'published',
              strapi
            );

            console.log(
              `[SOFT DELETE] Applied soft delete status filter (${context.params.status || 'published'}) to populate for ${uid}:`,
              JSON.stringify(context.params.populate, null, 2)
            );
            console.log(
              '[SOFT DELETE] Current filters:',
              JSON.stringify(context.params.filters, null, 2)
            );
          }
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
};

export default bootstrap;
