# Why The Previous Approach Didn't Work

## The Problem with `strapi.db.query()` Interception

The initial approach tried to intercept `strapi.db.query()` calls and add soft delete filters to the `params.where` clause:

```javascript
// ❌ This doesn't work!
strapi.db.query = function(uid: string) {
  const originalQueryBuilder = originalQuery(uid);
  
  return new Proxy(originalQueryBuilder, {
    get(target, prop) {
      if (prop === 'findMany') {
        return function(params: any = {}) {
          // This still goes through schema validation!
          params.where[softDeleteFields.deletedAt] = { $null: true };
          return original.call(target, params);
        };
      }
    }
  });
};
```

**Why it fails:**
- Even though we intercept the call, `strapi.db.query()` still processes the `params.where` through Strapi's schema validation
- Since `_softDeletedAt` doesn't exist in the schema, it throws "Invalid key _softDeletedAt"
- The interception happens too late in the process

## The Working Solution: Entity Service Replacement

Instead, we completely replace the `strapi.entityService` methods and use direct database queries:

```javascript
// ✅ This works!
strapi.entityService.findMany = async function(uid: string, params: any = {}) {
  if (contentTypesWithSoftDelete.has(uid)) {
    const tableName = contentTypeToTable.get(uid);
    const knex = strapi.db.connection;
    
    // Direct database query - no schema validation!
    let query = knex(tableName).whereNull(softDeleteFields.deletedAt);
    
    // Apply other filters manually
    if (params.where) {
      Object.keys(params.where).forEach(key => {
        if (key !== '_softDeletedAt') { // Skip soft delete fields
          const value = params.where[key];
          if (value && typeof value === 'object') {
            if (value.$eq !== undefined) query = query.where(key, value.$eq);
            // ... more operators
          } else {
            query = query.where(key, value);
          }
        }
      });
    }
    
    return await query;
  }
  
  return originalFindMany(uid, params);
};
```

**Why it works:**
- Completely bypasses Strapi's entity service and schema validation
- Uses direct Knex queries that don't know about schemas
- Automatically adds `WHERE _softDeletedAt IS NULL` at the SQL level
- Manually converts Strapi query syntax to Knex syntax
- Falls back to original methods for unsupported content types

## Key Differences

| Approach | Level | Schema Validation | Result |
|----------|-------|-------------------|---------|
| `strapi.db.query()` intercept | Query builder | ✅ Still applied | ❌ Fails |
| `strapi.entityService` replacement | Entity service | ❌ Completely bypassed | ✅ Works |

The working approach essentially creates a "bypass lane" around Strapi's validation system for content types with soft delete columns.
