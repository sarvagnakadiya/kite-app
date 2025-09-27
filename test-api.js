// Test script to upload contract via API
// Run with: node test-api.js

const fs = require('fs');
const path = require('path');

async function testAPI() {
  try {
    // Read the DCA.json file
    const contractPath = path.join(__dirname, 'src/lib/out/DCA.json');
    const contractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    
    console.log('📄 Contract data loaded');
    
    // Make API call
    const response = await fetch('http://localhost:3000/api/upload-contract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contractData),
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Contract uploaded via API successfully!');
      console.log('🆔 Inserted ID:', result.insertedId);
    } else {
      console.error('❌ API upload failed:', result.message);
    }
    
  } catch (error) {
    console.error('❌ Error testing API:', error);
    console.log('💡 Make sure your Next.js server is running: npm run dev');
  }
}

console.log('🚀 Testing API upload...');
testAPI();
