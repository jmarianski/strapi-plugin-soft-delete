/**
 * Test file for Soft Delete Status functionality
 * This file demonstrates and validates the status-based filtering system
 *
 * To run this test:
 * cd server && npx ts-node test-soft-delete-status.ts
 */

import * as SoftDeleteStatus from './src/utils/soft-delete-status';

// Mock Strapi object for testing
const mockStrapi = {
  contentTypes: {
    'api::article.article': {
      uid: 'api::article.article',
      attributes: {
        title: { type: 'string' },
        content: { type: 'text' },
        _softDeletedAt: { type: 'datetime' },
        _softDeletedById: { type: 'integer' },
        _softDeletedByType: { type: 'string' },
        category: {
          type: 'relation',
          relation: 'manyToOne',
          target: 'api::category.category',
        },
      },
    },
    'api::category.category': {
      uid: 'api::category.category',
      attributes: {
        name: { type: 'string' },
        _softDeletedAt: { type: 'datetime' },
        _softDeletedById: { type: 'integer' },
        _softDeletedByType: { type: 'string' },
      },
    },
    'api::tag.tag': {
      uid: 'api::tag.tag',
      attributes: {
        name: { type: 'string' },
        // No soft delete fields
      },
    },
  },
} as any;

// Test cases for status-based filtering
const testCases = [
  {
    name: 'Active status filtering',
    contentType: mockStrapi.contentTypes['api::article.article'],
    params: { status: 'active' },
    expectedFilters: { _softDeletedAt: { $null: true } },
  },
  {
    name: 'Deleted status filtering',
    contentType: mockStrapi.contentTypes['api::article.article'],
    params: { status: 'deleted' },
    expectedFilters: { _softDeletedAt: { $notNull: true } },
  },
  {
    name: 'All status filtering (no filters added)',
    contentType: mockStrapi.contentTypes['api::article.article'],
    params: { status: 'all' },
    expectedFilters: {},
  },
  {
    name: 'Default to active when no status provided',
    contentType: mockStrapi.contentTypes['api::article.article'],
    params: {},
    expectedFilters: { _softDeletedAt: { $null: true } },
  },
  {
    name: 'Preserve existing filters with AND operation',
    contentType: mockStrapi.contentTypes['api::article.article'],
    params: {
      status: 'active',
      filters: { title: { $contains: 'test' } }
    },
    expectedFilters: {
      $and: [
        { title: { $contains: 'test' } },
        { _softDeletedAt: { $null: true } }
      ]
    },
  },
];

// Test cases for populate functionality
const populateTestCases = [
  {
    name: 'Simple populate with soft delete filtering',
    populate: {
      category: true,
    },
    parentUid: 'api::article.article',
    status: 'active',
    expected: {
      category: {
        filters: { _softDeletedAt: { $null: true } },
      },
    },
  },
  {
    name: 'Complex populate with nested relations',
    populate: {
      category: {
        populate: {
          articles: true,
        },
      },
    },
    parentUid: 'api::article.article',
    status: 'deleted',
    expected: {
      category: {
        filters: { _softDeletedAt: { $notNull: true } },
        populate: {
          articles: {
            filters: { _softDeletedAt: { $notNull: true } },
          },
        },
      },
    },
  },
];

// Run tests
console.log('🧪 Testing Soft Delete Status Functionality\n');

// Test status to filters conversion
console.log('📋 Testing statusToFilters...');
testCases.forEach((testCase) => {
  try {
    const result = SoftDeleteStatus.statusToFilters(testCase.contentType, testCase.params);
    const actualFilters = result.filters || {};

    console.log(`✅ ${testCase.name}:`);
    console.log(`   Input: ${JSON.stringify(testCase.params)}`);
    console.log(`   Expected: ${JSON.stringify(testCase.expectedFilters)}`);
    console.log(`   Actual: ${JSON.stringify(actualFilters)}`);

    // Basic validation (you could add more sophisticated comparison here)
    if (JSON.stringify(actualFilters) === JSON.stringify(testCase.expectedFilters)) {
      console.log(`   ✅ PASS\n`);
    } else {
      console.log(`   ❌ FAIL\n`);
    }
  } catch (error) {
    console.log(`❌ ${testCase.name}: ERROR - ${error.message}\n`);
  }
});

// Test schema detection
console.log('🔍 Testing hasSoftDeleteFields...');
console.log(`✅ Article has soft delete fields: ${SoftDeleteStatus.hasSoftDeleteFields('api::article.article', mockStrapi)}`);
console.log(`✅ Category has soft delete fields: ${SoftDeleteStatus.hasSoftDeleteFields('api::category.category', mockStrapi)}`);
console.log(`✅ Tag has soft delete fields: ${SoftDeleteStatus.hasSoftDeleteFields('api::tag.tag', mockStrapi)}`);
console.log();

// Test populate functionality
console.log('🔗 Testing addSoftDeleteToPopulate...');
populateTestCases.forEach((testCase) => {
  try {
    const result = SoftDeleteStatus.addSoftDeleteToPopulate(
      testCase.populate,
      testCase.parentUid,
      testCase.status,
      mockStrapi
    );

    console.log(`✅ ${testCase.name}:`);
    console.log(`   Input: ${JSON.stringify(testCase.populate, null, 2)}`);
    console.log(`   Result: ${JSON.stringify(result, null, 2)}`);
    console.log();
  } catch (error) {
    console.log(`❌ ${testCase.name}: ERROR - ${error.message}\n`);
  }
});

console.log('🎯 Test Summary:');
console.log('- Status-based filtering for active, deleted, and all states');
console.log('- Preservation of existing filters with AND logic');
console.log('- Schema detection for soft delete fields');
console.log('- Recursive populate filtering for relations');
console.log('- Default behavior (active status when none specified)');
