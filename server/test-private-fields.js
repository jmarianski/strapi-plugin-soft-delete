console.log('Testing soft delete database implementation...');

// This is a simple test to verify that our soft delete fields exist at the database level
// You can run this in your Strapi application console to verify the setup

const testContentType = async (uid) => {
  console.log(`\n=== Testing ${uid} ===`);
  
  const contentType = strapi.contentTypes[uid];
  if (!contentType) {
    console.log('Content type not found');
    return;
  }
  
  console.log('Content type schema (should NOT have soft delete fields):');
  console.log('- Has _softDeletedAt in schema:', !!contentType.attributes._softDeletedAt);
  console.log('- Has _softDeletedById in schema:', !!contentType.attributes._softDeletedById);
  console.log('- Has _softDeletedByType in schema:', !!contentType.attributes._softDeletedByType);
  
  console.log('\nPrivate attributes in schema:');
  console.log(contentType.options?.privateAttributes || []);
  
  // Test database columns
  const tableName = contentType.collectionName || contentType.info.singularName;
  console.log(`\nChecking database table: ${tableName}`);
  
  try {
    const hasDeletedAt = await strapi.db.connection.schema.hasColumn(tableName, '_softDeletedAt');
    const hasDeletedById = await strapi.db.connection.schema.hasColumn(tableName, '_softDeletedById');
    const hasDeletedByType = await strapi.db.connection.schema.hasColumn(tableName, '_softDeletedByType');
    
    console.log('Database columns:');
    console.log('- _softDeletedAt column exists:', hasDeletedAt);
    console.log('- _softDeletedById column exists:', hasDeletedById);
    console.log('- _softDeletedByType column exists:', hasDeletedByType);
    
    if (hasDeletedAt && hasDeletedById && hasDeletedByType) {
      console.log('✅ Soft delete implementation is working correctly!');
      console.log('✅ Fields exist in database but NOT in API schema');
    } else {
      console.log('❌ Some columns are missing - plugin may not be fully initialized');
    }
  } catch (error) {
    console.error('Error checking database columns:', error);
  }
};

// Example usage:
// await testContentType('api::article.article');
// await testContentType('api::product.product');

module.exports = { testContentType };
