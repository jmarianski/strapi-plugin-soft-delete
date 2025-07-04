# Strapi v5 - Soft Delete Plugin

A powerful Strapi v5 plugin that adds soft delete functionality to your content types, allowing you to "delete" entries without permanently removing them from the database.

## ✨ Features

- 🛢 **Database Integration**
  - Adds `_softDeletedAt`, `_softDeletedById` and `_softDeletedByType` fields to all collection content types
  - Fields are private and not visible in the Content Manager or through the API

- 🗂️ **Content Manager & API**
  - Delete operations behave as soft deletes
  - Sets `_softDeletedAt` to current datetime, `_softDeletedById` to user ID, and `_softDeletedByType` to deletion initiator type
  - Soft deleted entries are automatically excluded from queries

- 👤 **RBAC (Role-Based Access Control)**
  - Renames "Delete" permission to "Soft Delete"
  - Adds "Deleted Read" permission for viewing soft deleted entries
  - Adds "Deleted Restore" permission for restoring entries
  - Adds "Delete Permanently" permission for permanent deletion
  - Plugin-level "Read" and "Settings" permissions

- 🗂️ **Soft Delete Explorer**
  - Admin panel interface for viewing soft deleted entries
  - Restore entries with one click
  - Permanently delete entries when needed
  - Organized by content type

- ⚙️ **Settings**
  - Restoration Behavior configuration
  - Single Type restoration options (soft delete vs permanent delete existing entries)
  - Draft & Publish restoration options (restore as draft vs unchanged state)

## 📦 Installation

Install the plugin via npm:

```bash
npm install strapi-plugin-soft-delete
```

Add the plugin to your Strapi configuration in `config/plugins.js` or `config/plugins.ts`:

```javascript
module.exports = {
  // ...other plugins
  'soft-delete': {
    enabled: true,
  },
};
```

## 🚀 Usage

1. **Install and configure** the plugin as described above
2. **Restart your Strapi server** to apply the database changes
3. **Access the Soft Delete Explorer** from the admin panel sidebar
4. **Configure permissions** for your admin roles in Settings > Administration Panel > Roles
5. **Set restoration behavior** in Settings > Soft Delete > Restoration Behavior

## ⚠️ Important Notes

- **Backup your database** before installing in production
- The plugin modifies your database schema by adding soft delete fields
- Once enabled, all delete operations become soft deletes for supported content types
- Use "Delete Permanently" feature with caution as it cannot be undone

## 📋 Requirements

- Node.js >= 18.x
- Strapi >= 5.0.0
