# Soft Delete Field Privacy Implementation

## Problem
The soft delete fields (`_softDeletedAt`, `_softDeletedById`, `_softDeletedByType`) were appearing in API responses even though they were marked as `private: true`. This made them queryable and visible in the public API.

## Solution
We implemented a two-pronged approach to ensure these fields are properly hidden from API responses:

### 1. Attribute-level Privacy
Each soft delete field is marked with `private: true` in its attribute definition:

```typescript
const _softDeletedAt = {
  type: 'datetime',
  configurable: false,
  writable: false,
  visible: false,
  private: true, // ← This marks the field as private
};
```

### 2. Model-level Privacy
The fields are also added to the content type's `privateAttributes` array in the model options:

```typescript
// Ensure privateAttributes option includes our soft delete fields
if (!contentType.options) {
  contentType.options = {};
}

const existingPrivateAttributes = contentType.options.privateAttributes || [];
const softDeleteFields = ['_softDeletedAt', '_softDeletedById', '_softDeletedByType'];

contentType.options.privateAttributes = [
  ...existingPrivateAttributes,
  ...softDeleteFields.filter(field => !existingPrivateAttributes.includes(field))
];
```

## How Strapi Handles Private Attributes

Strapi has built-in sanitization mechanisms that remove private attributes from API responses:

1. **Attribute-level**: Fields with `private: true` are automatically filtered out
2. **Model-level**: Fields listed in `options.privateAttributes` are treated as private
3. **Global-level**: Fields can be made private globally via `api.responses.privateAttributes` config

## Benefits

- **Security**: Soft delete metadata is not exposed in public API responses
- **Clean API**: API consumers don't see internal plugin fields
- **Query Protection**: Private fields cannot be used in filters or sorting
- **Consistent**: Follows Strapi's standard privacy mechanisms

## Similar to publishedAt

This implementation follows the same pattern used by Strapi's `publishedAt` field, which is hidden from API responses when draft/publish is disabled but still used internally for query filtering.

## Testing

To verify the implementation works:

1. Create content with the soft delete plugin enabled
2. Soft delete an entry
3. Query the API - the soft delete fields should not appear in the response
4. Try to filter by `_softDeletedAt` - should return a validation error
