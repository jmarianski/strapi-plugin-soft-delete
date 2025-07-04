import type { Core } from '@strapi/strapi';
import { supportsContentType } from './plugin';
import { getSoftDeleteFields, hasSoftDeleteColumns } from './database';

/**
 * Setup automatic soft delete filtering by replacing entity service methods
 */
export const setupQueryInterceptor = async (strapi: Core.Strapi) => {
  const softDeleteFields = getSoftDeleteFields();
  
  // Store which content types have soft delete columns for performance  
  const contentTypesWithSoftDelete = new Set<string>();
  const contentTypeToTable = new Map<string, string>();
  
  // Pre-populate the cache
  const supportedContentTypes = Object.keys(strapi.contentTypes).filter(supportsContentType);
  for (const uid of supportedContentTypes) {
    if (await hasSoftDeleteColumns(strapi, uid)) {
      contentTypesWithSoftDelete.add(uid);
      
      const model = strapi.contentTypes[uid];
      const tableName = model.collectionName || model.info.singularName;
      contentTypeToTable.set(uid, tableName);
      
      console.log(`[SOFT DELETE] Registered automatic filtering for content type: ${uid} (table: ${tableName})`);
    }
  }
  
  // Store the original entityService methods
  const originalFindMany = strapi.entityService.findMany.bind(strapi.entityService);
  const originalFindOne = strapi.entityService.findOne.bind(strapi.entityService);
  const originalCount = strapi.entityService.count.bind(strapi.entityService);
  
  // Override findMany
  strapi.entityService.findMany = async function(uid: string, params: any = {}) {
    if (contentTypesWithSoftDelete.has(uid)) {
      // Use direct database query to avoid schema validation
      const tableName = contentTypeToTable.get(uid);
      const knex = strapi.db.connection;
      
      console.log(`[SOFT DELETE] Intercepted findMany for ${uid}, using direct DB query`);
      
      try {
        // Build the query with automatic soft delete filtering
        let query = knex(tableName).whereNull(softDeleteFields.deletedAt);
        
        // Apply any additional filters (but skip soft delete fields to avoid validation)
        if (params.where) {
          // We need to convert Strapi's where format to Knex format
          // For now, let's use a simplified approach
          Object.keys(params.where).forEach(key => {
            if (key !== softDeleteFields.deletedAt && key !== '_softDeletedAt') {
              const value = params.where[key];
              if (value && typeof value === 'object') {
                // Handle Strapi operators
                if (value.$eq !== undefined) query = query.where(key, value.$eq);
                if (value.$ne !== undefined) query = query.whereNot(key, value.$ne);
                if (value.$in !== undefined) query = query.whereIn(key, value.$in);
                if (value.$notIn !== undefined) query = query.whereNotIn(key, value.$notIn);
                if (value.$null !== undefined) query = value.$null ? query.whereNull(key) : query.whereNotNull(key);
                if (value.$notNull !== undefined) query = value.$notNull ? query.whereNotNull(key) : query.whereNull(key);
                // Add more operators as needed
              } else {
                query = query.where(key, value);
              }
            }
          });
        }
        
        // Apply pagination
        if (params.start) query = query.offset(params.start);
        if (params.limit) query = query.limit(params.limit);
        
        // Apply sorting
        if (params.sort) {
          if (Array.isArray(params.sort)) {
            params.sort.forEach((sortObj: any) => {
              const [field, direction] = Object.entries(sortObj)[0];
              query = query.orderBy(field as string, direction as string);
            });
          }
        }
        
        const results = await query;
        console.log(`[SOFT DELETE] Found ${results.length} non-deleted records for ${uid}`);
        return results;
        
      } catch (error) {
        console.log(`[SOFT DELETE] Direct query failed for ${uid}, falling back to original:`, error.message);
        // Fallback to original if our direct query fails
        return originalFindMany(uid, params);
      }
    }
    
    return originalFindMany(uid, params);
  };
  
  // Override findOne
  strapi.entityService.findOne = async function(uid: string, id: any, params: any = {}) {
    if (contentTypesWithSoftDelete.has(uid)) {
      const tableName = contentTypeToTable.get(uid);
      const knex = strapi.db.connection;
      
      console.log(`[SOFT DELETE] Intercepted findOne for ${uid}:${id}, using direct DB query`);
      
      try {
        const result = await knex(tableName)
          .where('id', id)
          .whereNull(softDeleteFields.deletedAt)
          .first();
          
        return result || null;
        
      } catch (error) {
        console.log(`[SOFT DELETE] Direct query failed for ${uid}:${id}, falling back to original:`, error.message);
        return originalFindOne(uid, id, params);
      }
    }
    
    return originalFindOne(uid, id, params);
  };
  
  // Override count  
  strapi.entityService.count = async function(uid: string, params: any = {}) {
    if (contentTypesWithSoftDelete.has(uid)) {
      const tableName = contentTypeToTable.get(uid);
      const knex = strapi.db.connection;
      
      console.log(`[SOFT DELETE] Intercepted count for ${uid}, using direct DB query`);
      
      try {
        let query = knex(tableName).whereNull(softDeleteFields.deletedAt);
        
        // Apply filters (simplified)
        if (params.where) {
          Object.keys(params.where).forEach(key => {
            if (key !== softDeleteFields.deletedAt && key !== '_softDeletedAt') {
              const value = params.where[key];
              if (value && typeof value === 'object') {
                if (value.$eq !== undefined) query = query.where(key, value.$eq);
                // Add other operators as needed
              } else {
                query = query.where(key, value);
              }
            }
          });
        }
        
        const result = await query.count('* as count');
        return parseInt(String(result[0].count));
        
      } catch (error) {
        console.log(`[SOFT DELETE] Direct count query failed for ${uid}, falling back to original:`, error.message);
        return originalCount(uid, params);
      }
    }
    
    return originalCount(uid, params);
  };
  
  console.log(`[SOFT DELETE] Entity service interceptor setup complete for ${contentTypesWithSoftDelete.size} content types`);
};
