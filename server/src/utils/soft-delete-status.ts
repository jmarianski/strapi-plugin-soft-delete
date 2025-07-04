import { assoc, curry } from 'lodash/fp';
import type { Core } from '@strapi/strapi';
import { supportsContentType } from './plugin';

type ParamsTransform = (params: any) => any;

type TransformWithContentType = (contentType: any, params: any) => any;

/**
 * Soft Delete enabled -> set status to published by default
 * Soft Delete disabled -> Used mostly for parsing relations, so there is not a need for a default.
 */
const setStatusToPublished: TransformWithContentType = (contentType, params) => {
  if (!supportsContentType(contentType.uid) && params.status) {
    return params;
  }

  return assoc('status', 'published', params);
};

/**
 * Adds a default status of `published` to the params
 */
const defaultToPublished: ParamsTransform = (params) => {
  // Default to published if no status is provided or it's invalid
  if (!params.status || !['published', 'deleted', 'all'].includes(params.status)) {
    return assoc('status', 'published', params);
  }

  return params;
};

/**
 * Soft Delete disabled -> ignore status
 * Soft Delete enabled -> set status to published if no status is provided or it's invalid
 */
const defaultStatus: TransformWithContentType = (contentType, params) => {
  if (!supportsContentType(contentType.uid)) {
    return params;
  }

  // Default to published if no status is provided or it's invalid
  if (!params.status || !['published', 'deleted', 'all'].includes(params.status)) {
    return defaultToPublished(params);
  }

  return params;
};

/**
 * Add status lookup query to the params (similar to Strapi's statusToLookup)
 */
const statusToLookup: TransformWithContentType = (contentType, params) => {
  if (!supportsContentType(contentType.uid)) {
    return params;
  }

  const lookup = params.lookup || {};

  switch (params?.status) {
    case 'deleted':
      return assoc(['lookup', '_softDeletedAt'], { $notNull: true }, params);
    case 'published':
      return assoc(['lookup', '_softDeletedAt'], { $null: true }, params);
    case 'all':
      // Don't add any soft delete filters
      return assoc('lookup', lookup, params);
    default:
      break;
  }

  return assoc('lookup', lookup, params);
};

/**
 * Convert status parameter to filters (for backwards compatibility)
 */
const statusToFilters: TransformWithContentType = (contentType, params) => {
  if (!supportsContentType(contentType.uid)) {
    return params;
  }

  const filters = params.filters || {};

  switch (params?.status) {
    case 'deleted':
      return assoc(
        ['filters'],
        filters && Object.keys(filters).length > 0
          ? { $and: [filters, { _softDeletedAt: { $notNull: true } }] }
          : { _softDeletedAt: { $notNull: true } },
        params
      );
    case 'published':
      return assoc(
        ['filters'],
        filters && Object.keys(filters).length > 0
          ? { $and: [filters, { _softDeletedAt: { $null: true } }] }
          : { _softDeletedAt: { $null: true } },
        params
      );
    case 'all':
      // Don't add any soft delete filters
      return params;
    default:
      // Default to published
      return assoc(
        ['filters'],
        filters && Object.keys(filters).length > 0
          ? { $and: [filters, { _softDeletedAt: { $null: true } }] }
          : { _softDeletedAt: { $null: true } },
        params
      );
  }
};

/**
 * Check if a content type has soft delete fields in its schema
 */
const hasSoftDeleteFields = (contentTypeUid: string, strapi: Core.Strapi): boolean => {
  try {
    const contentType = strapi.contentTypes[contentTypeUid];
    if (!contentType || !contentType.attributes) {
      return false;
    }

    // Check if the schema has the _softDeletedAt field
    return contentType.attributes._softDeletedAt !== undefined;
  } catch (error) {
    console.error(`[SOFT DELETE] Error checking schema for ${contentTypeUid}:`, error);
    return false;
  }
};

/**
 * Apply soft delete status filtering to populate queries
 */
const addSoftDeleteToPopulate = (
  populate: any,
  parentUid: string,
  currentStatus: string,
  strapi: Core.Strapi,
  parentUidContext?: string
): any => {
  if (typeof populate === 'boolean') {
    return populate;
  }

  if (Array.isArray(populate)) {
    return populate.map((item) =>
      addSoftDeleteToPopulate(item, parentUid, currentStatus, strapi, parentUidContext)
    );
  }
  console.log(
    `[SOFT DELETE] Adding soft delete filters to populate for ${parentUid} with status ${currentStatus}:`,
    populate
  );

  if (typeof populate === 'object') {
    const newPopulate: any = {};

    for (const [key, value] of Object.entries(populate)) {
      if (typeof value === 'object' && value !== null) {
        // Try to determine the related content type UID for this relation
        let relatedUid: string | undefined;
        try {
          const parentContentType = strapi.contentTypes[parentUidContext || parentUid];
          if (parentContentType?.attributes?.[key]) {
            const attribute = parentContentType.attributes[key] as any;
            if (attribute.type === 'relation') {
              relatedUid = attribute.target || attribute.model;
            }
          }
        } catch (error) {
          console.warn(`[SOFT DELETE] Could not determine related UID for ${key}:`, error);
        }

        const populateValue = value as any;

        // Apply same status-based filtering to relations
        let relationFilters = populateValue.filters;
        console.log(
          `[SOFT DELETE]`,
          relatedUid,
          `has soft delete fields:`,
          hasSoftDeleteFields(relatedUid, strapi)
        );
        if (relatedUid && hasSoftDeleteFields(relatedUid, strapi)) {
          console.log(
            `[SOFT DELETE] Adding soft delete filters to relation ${key} for ${relatedUid} with status ${currentStatus}`
          );
          if (currentStatus === 'deleted') {
            // Show only soft-deleted related items
            relationFilters = relationFilters
              ? { $and: [relationFilters, { _softDeletedAt: { $notNull: true } }] }
              : { _softDeletedAt: { $notNull: true } };
          } else if (currentStatus === 'published' || !currentStatus) {
            // Show only published related items (default behavior)
            relationFilters = relationFilters
              ? { $and: [relationFilters, { _softDeletedAt: { $null: true } }] }
              : { _softDeletedAt: { $null: true } };
          }
          // If status is 'all', don't add any soft delete filters to relations
        }

        newPopulate[key] = {
          ...populateValue,
          filters: relationFilters,
          // Recursively handle nested populates
          populate: populateValue.populate
            ? addSoftDeleteToPopulate(
                populateValue.populate,
                relatedUid || parentUid,
                currentStatus,
                strapi,
                relatedUid
              )
            : undefined,
        };
      } else {
        newPopulate[key] = value;
      }
    }

    return newPopulate;
  }

  return populate;
};

// Curry the functions for easier use
const setStatusToPublishedCurry = curry(setStatusToPublished);
const defaultToPublishedCurry = curry(defaultToPublished);
const defaultStatusCurry = curry(defaultStatus);
const statusToLookupCurry = curry(statusToLookup);
const statusToFiltersCurry = curry(statusToFilters);

export {
  setStatusToPublishedCurry as setStatusToPublished,
  defaultToPublishedCurry as defaultToPublished,
  defaultStatusCurry as defaultStatus,
  statusToLookupCurry as statusToLookup,
  statusToFiltersCurry as statusToFilters,
  hasSoftDeleteFields,
  addSoftDeleteToPopulate,
};

export type { ParamsTransform, TransformWithContentType };
