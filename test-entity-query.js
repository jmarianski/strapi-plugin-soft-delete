// Test to reproduce the "Invalid key _softDeletedAt" error
// This should demonstrate that entity service queries with non-schema fields fail

const testEntityQuery = async (strapi) => {
  try {
    console.log('Testing entity service query with soft delete field...');
    
    // This should fail with "Invalid key _softDeletedAt" because the field is not in schema
    const result = await strapi.entityService.findMany('api::example.example', {
      filters: {
        _softDeletedAt: { $null: true }
      }
    });
    
    console.log('Query succeeded (unexpected):', result);
  } catch (error) {
    console.log('Query failed (expected):', error.message);
  }
  
  try {
    console.log('Testing direct database query with soft delete field...');
    
    // This should work because it bypasses schema validation
    const knex = strapi.db.connection;
    const result = await knex('examples')
      .whereNull('_softDeletedAt')
      .limit(1);
    
    console.log('Direct DB query succeeded:', result.length, 'records');
  } catch (error) {
    console.log('Direct DB query failed:', error.message);
  }
};

module.exports = testEntityQuery;
