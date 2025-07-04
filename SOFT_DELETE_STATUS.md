# Soft Delete Status System

This plugin now implements a status-based filtering system similar to Strapi's draft/published mechanism.

## Status Values

The plugin supports three status values:

- **`active`** (default): Shows only active (non-deleted) content
- **`deleted`**: Shows only soft-deleted content  
- **`all`**: Shows all content regardless of deletion status

## Usage Examples

### 1. Default Behavior (Active Content Only)
```javascript
// These are equivalent - both show only active content
const activeArticles1 = await strapi.documents('api::article.article').findMany();
const activeArticles2 = await strapi.documents('api::article.article').findMany({ status: 'active' });
```

### 2. Show Only Deleted Content
```javascript
// Show only soft-deleted articles
const deletedArticles = await strapi.documents('api::article.article').findMany({ 
  status: 'deleted' 
});
```

### 3. Show All Content (Active + Deleted)
```javascript
// Show both active and deleted articles
const allArticles = await strapi.documents('api::article.article').findMany({ 
  status: 'all' 
});
```

### 4. Status with Other Filters
```javascript
// Find deleted articles by a specific author
const deletedByAuthor = await strapi.documents('api::article.article').findMany({
  status: 'deleted',
  filters: {
    author: { id: 123 }
  }
});

// Find active articles with title containing "test"
const activeTestArticles = await strapi.documents('api::article.article').findMany({
  status: 'active', // Can be omitted since it's default
  filters: {
    title: { $contains: 'test' }
  }
});
```

### 5. Status with Population
```javascript
// Find deleted articles and populate their (active) categories
const deletedWithActiveCategories = await strapi.documents('api::article.article').findMany({
  status: 'deleted',
  populate: {
    categories: true // Will only show active categories by default
  }
});

// Find active articles and populate their deleted categories
const activeWithDeletedCategories = await strapi.documents('api::article.article').findMany({
  status: 'active',
  populate: {
    categories: {
      filters: { _softDeletedAt: { $notNull: true } } // Manually override to show deleted
    }
  }
});
```

### 6. REST API Usage
```javascript
// GET requests with status parameter
GET /api/articles?status=active    // Default behavior
GET /api/articles?status=deleted   // Show deleted only
GET /api/articles?status=all       // Show all

// With other parameters
GET /api/articles?status=deleted&filters[author][id]=123
GET /api/articles?status=all&populate=*
```

### 7. GraphQL Usage
```graphql
# Query active articles (default)
query {
  articles(status: ACTIVE) {
    data {
      id
      attributes {
        title
      }
    }
  }
}

# Query deleted articles
query {
  articles(status: DELETED) {
    data {
      id
      attributes {
        title
        _softDeletedAt
      }
    }
  }
}

# Query all articles
query {
  articles(status: ALL) {
    data {
      id
      attributes {
        title
        _softDeletedAt
      }
    }
  }
}
```

## Implementation Details

### How It Works

1. **Status Parameter**: Similar to Strapi's `status: 'draft'` or `status: 'published'`, this plugin accepts `status: 'active'`, `status: 'deleted'`, or `status: 'all'`.

2. **Automatic Filter Translation**: The plugin automatically translates the status parameter into appropriate database filters:
   - `status: 'active'` → `{ _softDeletedAt: { $null: true } }`
   - `status: 'deleted'` → `{ _softDeletedAt: { $notNull: true } }`  
   - `status: 'all'` → No soft delete filters applied

3. **Relation Handling**: The status filtering is automatically applied to populated relations as well, maintaining consistency throughout the data tree.

4. **Backward Compatibility**: Existing queries without a status parameter continue to work as before (showing only active content).

### Middleware Integration

The plugin integrates at the document service level using Strapi's middleware system:

```typescript
strapi.documents.use(async (context: any, next) => {
  const { action, uid, params } = context;
  
  if (['findOne', 'findMany', 'findFirst'].includes(action)) {
    // Apply status-based filtering
    context.params = SoftDeleteStatus.statusToFilters(contentType, context.params);
    
    // Handle relations
    if (context.params.populate) {
      context.params.populate = SoftDeleteStatus.addSoftDeleteToPopulate(
        context.params.populate,
        uid,
        context.params.status || 'active',
        strapi
      );
    }
  }
  
  return next();
});
```

## Comparison with Strapi's Draft/Publish

| Strapi Draft/Publish | Soft Delete Plugin |
|---------------------|-------------------|
| `status: 'draft'` | `status: 'active'` |
| `status: 'published'` | `status: 'deleted'` |
| `publishedAt: null` | `_softDeletedAt: null` |
| `publishedAt: { $notNull: true }` | `_softDeletedAt: { $notNull: true }` |
| Shows drafts by default | Shows active by default |
| Two states: draft/published | Three states: active/deleted/all |

This approach provides a clean, intuitive API that follows Strapi's existing patterns while providing powerful soft delete functionality.
