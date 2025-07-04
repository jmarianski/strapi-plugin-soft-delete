import type { Core } from '@strapi/strapi';
import { supportsContentType } from './plugin';

/**
 * Ensure soft delete columns exist in database tables for supported content types
 */
export const ensureSoftDeleteColumns = async (strapi: Core.Strapi) => {
  const supportedContentTypes = Object.keys(strapi.contentTypes).filter(supportsContentType);
  
  for (const uid of supportedContentTypes) {
    const model = strapi.contentTypes[uid];
    const tableName = model.collectionName || model.info.singularName;
    
    try {
      // Check if soft delete columns exist, if not create them
      // Use camelCase field names to match the existing codebase
      const hasColumns = await strapi.db.connection.schema.hasColumn(tableName, '_softDeletedAt');
      
      if (!hasColumns) {
        console.log(`[SOFT DELETE] Adding soft delete columns to table: ${tableName}`);
        
        await strapi.db.connection.schema.table(tableName, (table) => {
          table.timestamp('_softDeletedAt').nullable();
          table.integer('_softDeletedById').nullable();
          table.string('_softDeletedByType').nullable();
        });
        
        console.log(`[SOFT DELETE] Successfully added soft delete columns to: ${tableName}`);
      }
    } catch (error) {
      console.error(`[SOFT DELETE] Failed to add columns to ${tableName}:`, error);
    }
  }
};

/**
 * Get the soft delete field names (keeping them consistent with existing codebase)
 */
export const getSoftDeleteFields = () => ({
  deletedAt: '_softDeletedAt',
  deletedById: '_softDeletedById', 
  deletedByType: '_softDeletedByType'
});

/**
 * Check if a content type has soft delete columns in the database
 */
export const hasSoftDeleteColumns = async (strapi: Core.Strapi, uid: string): Promise<boolean> => {
  const model = strapi.contentTypes[uid];
  if (!model) return false;
  
  const tableName = model.collectionName || model.info.singularName;
  
  try {
    // Check for camelCase field name
    return await strapi.db.connection.schema.hasColumn(tableName, '_softDeletedAt');
  } catch (error) {
    console.error(`[SOFT DELETE] Error checking columns for ${tableName}:`, error);
    return false;
  }
};
