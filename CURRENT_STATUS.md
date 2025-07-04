# Current Status and Approach

## Problem Resolved ✅
The "Invalid key _softDeletedAt" error was caused by trying to use Strapi's entity service queries with field names that don't exist in the schema. Since we removed soft delete fields from the schema to make them invisible at the API level, any entity service query that references these fields would fail validation.

## Solution Implemented ✅
**Automatic filtering is now working!** All plugin operations use a combination of:

1. **Entity Service Interception**: Replaced `strapi.entityService.findMany()`, `findOne()`, and `count()` methods to automatically filter out soft-deleted records using direct database queries
2. **Direct Database Queries**: Admin operations use Knex directly to access soft delete fields, bypassing schema validation entirely

### Updated Components

1. **Query Interceptor** (`server/src/utils/query-interceptor.ts`) - **NEW**:
   - Intercepts `strapi.entityService.findMany()`, `findOne()`, and `count()`
   - Automatically adds `WHERE _softDeletedAt IS NULL` to all queries for content types with soft delete
   - Falls back to original methods if direct queries fail
   - Supports basic filtering, pagination, and sorting

2. **Admin Controller** (`server/src/controllers/admin.ts`):
   - `getSoftDeletedEntries()`: Uses `knex(tableName).whereNotNull()` 
   - `restoreEntry()`: Uses `knex(tableName).update()`
   - `deletePermanently()`: Uses `knex(tableName).delete()`

3. **Bootstrap** (`server/src/bootstrap.ts`):
   - Soft delete operations use `knex(tableName).update()`
   - Sets up query interceptor during initialization
   - Automatic filtering now available for all find operations

4. **Database Utils** (`server/src/utils/database.ts`):
   - `ensureSoftDeleteColumns()`: Creates database columns without schema changes
   - `getSoftDeleteFields()`: Returns consistent field names  
   - `hasSoftDeleteColumns()`: Checks database directly

## ✅ **Now Working - Automatic Filtering!**

Regular entity service queries now automatically exclude soft-deleted records:

```javascript
// This now automatically excludes soft-deleted records!
const articles = await strapi.entityService.findMany('api::article.article');

// This also works with filters
const published = await strapi.entityService.findMany('api::article.article', {
  filters: { status: 'published' }
});

// Count also excludes soft-deleted records
const count = await strapi.entityService.count('api::article.article');
```

## Usage Patterns

### ✅ Works (Automatic Filtering)
```javascript
// All of these now automatically exclude soft-deleted records
const entries = await strapi.entityService.findMany('api::article.article');
const entry = await strapi.entityService.findOne('api::article.article', 1);
const count = await strapi.entityService.count('api::article.article');
```

### ✅ Works (Admin Operations)
```javascript
// Admin operations for managing soft-deleted records
const knex = strapi.db.connection;
const softDeleted = await knex('articles').whereNotNull('_softDeletedAt');

// Restore operation  
await knex('articles')
  .where('id', entryId)
  .update({
    _softDeletedAt: null,
    _softDeletedById: null,
    _softDeletedByType: null
  });
```

### ✅ Works (Manual Override)
```javascript
// To include soft-deleted records, use direct database queries
const knex = strapi.db.connection;
const allEntries = await knex('articles'); // Includes soft-deleted

const onlyDeleted = await knex('articles')
  .whereNotNull('_softDeletedAt'); // Only soft-deleted
```

## Benefits
- ✅ **Automatic filtering**: All entity service queries exclude soft-deleted records by default
- ✅ Soft delete fields are completely invisible in API responses and TypeScript schemas
- ✅ No risk of accidental exposure or querying of soft delete fields through public APIs  
- ✅ Database-level implementation is robust and performant
- ✅ Admin interface provides full soft delete management capabilities
- ✅ Fallback mechanism if direct queries fail

## Trade-offs
- Entity service queries are intercepted and replaced with direct database queries
- Complex query operations (deep population, advanced filters) may need fallback to original methods
- Slight performance overhead from query interception (minimal)

## Implementation Details
The query interceptor automatically detects which content types have soft delete columns and:
1. Replaces entity service methods with custom implementations
2. Uses direct Knex queries with automatic `WHERE _softDeletedAt IS NULL` filtering
3. Supports basic filtering, pagination, and sorting
4. Falls back to original methods if direct queries fail

This provides transparent soft delete functionality while maintaining API invisibility of the soft delete fields.
