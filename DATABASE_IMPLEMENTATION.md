# Database-Level Soft Delete Implementation

## Problem Solved
The previous approach added soft delete fields to content type schemas during `register`, which caused:
1. TypeScript generation to include these fields in generated schemas
2. Fields to appear in API interfaces as explicitly private
3. Made the fields more visible rather than hidden

## New Approach

### 1. No Schema Modification
- Removed field additions from content type schemas in `register.ts`
- Content types remain clean without soft delete fields in their TypeScript definitions

### 2. Database-Level Implementation
- Fields are added directly to database tables during bootstrap
- Uses `ensureSoftDeleteColumns()` to add columns if they don't exist
- Columns use camelCase names to match existing codebase conventions:
  - `_softDeletedAt` (timestamp)
  - `_softDeletedById` (integer)
  - `_softDeletedByType` (string)

### 3. Entity Service Level Handling
- Soft delete operations work at the database query level
- Direct database updates using `strapi.db.query(uid).update()`
- Filtering works by adding database-level where clauses

### 4. Invisible to API
- Fields don't appear in TypeScript schemas
- No need for complex response filtering
- Fields cannot be queried by API consumers
- Completely hidden from the public API surface

## Key Files Changed

### `server/src/register.ts`
- Simplified to only log registration
- No longer modifies content type schemas

### `server/src/utils/database.ts`
- New utilities for database column management
- `ensureSoftDeleteColumns()` - adds columns to tables
- `hasSoftDeleteColumns()` - checks if columns exist
- `getSoftDeleteFields()` - returns field name constants

### `server/src/bootstrap.ts`
- Added database schema setup during bootstrap
- Updated entity service decoration to use direct database operations
- Uses `strapi.db.query()` for soft delete operations instead of document service

## Benefits

1. **Truly Hidden Fields**: Fields don't appear in any generated schemas or TypeScript definitions
2. **Clean API**: No trace of soft delete fields in public API
3. **Backward Compatible**: Existing admin panel and plugin functionality still works
4. **Database Efficient**: Direct database operations for better performance
5. **Future Proof**: Won't interfere with Strapi's type generation or schema validation

## Migration Notes

If you had the previous version installed:
1. The plugin will automatically add the new database columns
2. Existing soft deleted content will work seamlessly
3. No data migration needed - just restart your Strapi application
