// Test Cognito Configuration
console.log('Testing Cognito Configuration...');
console.log('User Pool ID:', process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID);
console.log('Client ID:', process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID);
console.log('Region:', process.env.NEXT_PUBLIC_AWS_REGION);

// Check if values are defined
if (!process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID) {
  console.error('❌ NEXT_PUBLIC_COGNITO_USER_POOL_ID is not defined');
}
if (!process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID) {
  console.error('❌ NEXT_PUBLIC_COGNITO_CLIENT_ID is not defined');
}
if (!process.env.NEXT_PUBLIC_AWS_REGION) {
  console.error('❌ NEXT_PUBLIC_AWS_REGION is not defined');
}

console.log('Configuration test complete.');
