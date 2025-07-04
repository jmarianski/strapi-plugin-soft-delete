import type { Core } from '@strapi/strapi';
import { pluginId, supportsContentType } from './utils/plugin';
import { getSoftDeletedByAuth, eventHubEmit } from './utils';

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

            // Instead of deleting, update the entity to mark it as soft-deleted
            const softDeletedEntity = await (strapi.documents(uid) as any).update({
              documentId,
              data: {
                _softDeletedAt: new Date().toISOString(),
                _softDeletedById: authId,
                _softDeletedByType: authStrategy,
              },
            });

            // Emit soft delete event
            eventHubEmit({
              uid,
              event: 'entry.delete',
              action: 'soft-delete',
              entity: softDeletedEntity,
            });

            // Return the soft deleted entity instead of proceeding with actual delete
            context.result = softDeletedEntity;
            return; // Don't call next() to prevent actual deletion
          } catch (error) {
            // If soft delete fails, proceed with original delete
            return next();
          }
        }

        // Handle find operations - filter out soft-deleted entries
        if (['findOne', 'findMany', 'findFirst'].includes(action) && supportsContentType(uid)) {
          // Add filter to exclude soft-deleted entries
          if (!context.params.filters) {
            context.params.filters = {};
          }

          // Simple null check - should work for both null and undefined values
          context.params.filters._softDeletedAt = { $null: true };
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
