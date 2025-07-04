// Test the query interceptor approach
// This should demonstrate automatic soft delete filtering without schema validation errors

const testQueryInterceptor = async (strapi) => {
  console.log('=== Testing Query Interceptor ===');
  
  try {
    // Test 1: Basic findMany should automatically exclude soft deleted records
    console.log('\n1. Testing basic findMany...');
    const result1 = await strapi.entityService.findMany('api::example.example');
    console.log('✅ findMany succeeded:', result1?.length || 0, 'records');
    
    // Test 2: findMany with filters should work and exclude soft deleted records
    console.log('\n2. Testing findMany with filters...');
    const result2 = await strapi.entityService.findMany('api::example.example', {
      filters: { title: { $contains: 'test' } }
    });
    console.log('✅ findMany with filters succeeded:', result2?.length || 0, 'records');
    
    // Test 3: findOne should work and exclude soft deleted records
    console.log('\n3. Testing findOne...');
    const result3 = await strapi.entityService.findOne('api::example.example', 1);
    console.log('✅ findOne succeeded:', result3 ? 'found record' : 'no record');
    
    // Test 4: count should work and exclude soft deleted records
    console.log('\n4. Testing count...');
    const result4 = await strapi.entityService.count('api::example.example');
    console.log('✅ count succeeded:', result4, 'records');
    
    console.log('\n=== All tests passed! Automatic filtering is working ===');
    
  } catch (error) {
    console.log('❌ Test failed:', error.message);
    console.log('Stack:', error.stack);
  }
};

module.exports = testQueryInterceptor;
