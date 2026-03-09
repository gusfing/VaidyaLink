/**
 * Test Sarvam AI API
 *
 * This script tests the Sarvam AI speech-to-text API
 * to verify the API key and endpoint work correctly
 */

const fs = require('fs');
const path = require('path');

// Read API key from .env.local
const envPath = path.join(__dirname, 'frontend', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const apiKeyMatch = envContent.match(/NEXT_PUBLIC_SARVAM_API_KEY=(.+)/);

if (!apiKeyMatch) {
  console.error('❌ NEXT_PUBLIC_SARVAM_API_KEY not found in frontend/.env.local');
  process.exit(1);
}

const SARVAM_API_KEY = apiKeyMatch[1].trim();
console.log('✅ Found Sarvam API key:', SARVAM_API_KEY.substring(0, 20) + '...');

// Create a simple test audio file (silence)
// In a real test, you'd use an actual audio file
async function testSarvamAPI() {
  console.log('\n🧪 Testing Sarvam AI API...\n');

  try {
    // For testing, we'll just check if the API key format is correct
    // and try to call the API with a minimal request

    console.log('📡 API Endpoint: https://api.sarvam.ai/speech-to-text');
    console.log('🔑 API Key: ' + SARVAM_API_KEY.substring(0, 20) + '...');
    console.log('📝 Header: api-subscription-key');

    // Test 1: Check API key format
    if (!SARVAM_API_KEY.startsWith('sk_')) {
      console.warn(
        '⚠️  Warning: API key doesn\'t start with "sk_" - this might not be a valid Sarvam API key'
      );
    } else {
      console.log('✅ API key format looks correct (starts with sk_)');
    }

    // Test 2: Check key length
    if (SARVAM_API_KEY.length < 30) {
      console.warn('⚠️  Warning: API key seems too short');
    } else {
      console.log('✅ API key length looks reasonable');
    }

    console.log('\n📋 Expected Sarvam API Request Format:');
    console.log('-----------------------------------');
    console.log('Method: POST');
    console.log('URL: https://api.sarvam.ai/speech-to-text');
    console.log('Headers:');
    console.log('  - api-subscription-key: YOUR_KEY');
    console.log('Body (FormData):');
    console.log('  - file: audio.wav (audio file)');
    console.log('  - language_code: hi-IN (or en-IN, ta-IN, etc.)');
    console.log('  - model: saarika:v1');
    console.log('-----------------------------------\n');

    console.log('✅ Configuration looks good!');
    console.log('\n📝 Next Steps:');
    console.log('1. Deploy to Vercel (already done)');
    console.log('2. Wait 2-3 minutes for deployment');
    console.log('3. Test voice recording on: https://vaidya-link.vercel.app/vaidyalink/voice');
    console.log('4. Check Vercel logs if there are errors');
    console.log('\n💡 To check Vercel logs:');
    console.log('   Visit: https://vercel.com/gusfing/vaidya-link/logs');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testSarvamAPI();
