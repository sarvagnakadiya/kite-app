// Simple script to upload DCA contract to MongoDB
// Run with: node upload-to-mongodb.js

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const MONGODB_URI = process.env.NEXT_PUBLIC_MONGODB_URI || 'mongodb+srv://deepakrjdr:RTg4fd5y8741Tf@cluster0.srg85.mongodb.net/';

// Utility function to extract bytecode string dynamically
function extractBytecodeString(contractData) {
  // If bytecode is already a string, return it
  if (typeof contractData.bytecode === 'string') {
    return contractData.bytecode;
  }

  // If bytecode is an object with 'object' property (Foundry format)
  if (contractData.bytecode && typeof contractData.bytecode === 'object' && contractData.bytecode.object) {
    return contractData.bytecode.object;
  }

  // If deployedBytecode exists and has 'object' property
  if (contractData.deployedBytecode && typeof contractData.deployedBytecode === 'object' && contractData.deployedBytecode.object) {
    return contractData.deployedBytecode.object;
  }

  // If deployedBytecode is a string
  if (typeof contractData.deployedBytecode === 'string') {
    return contractData.deployedBytecode;
  }

  return '';
}

// Utility function to extract deployed bytecode string
function extractDeployedBytecodeString(contractData) {
  // If deployedBytecode is already a string, return it
  if (typeof contractData.deployedBytecode === 'string') {
    return contractData.deployedBytecode;
  }

  // If deployedBytecode is an object with 'object' property (Foundry format)
  if (contractData.deployedBytecode && typeof contractData.deployedBytecode === 'object' && contractData.deployedBytecode.object) {
    return contractData.deployedBytecode.object;
  }

  // Fallback to bytecode if deployedBytecode doesn't exist
  return extractBytecodeString(contractData);
}

// Utility function to get contract name
function extractContractName(contractData) {
  if (contractData.contractName) return contractData.contractName;
  if (contractData.contractId) return contractData.contractId;
  
  // Try to get from metadata
  if (contractData.metadata) {
    try {
      const metadata = typeof contractData.metadata === 'string' 
        ? JSON.parse(contractData.metadata) 
        : contractData.metadata;
      if (metadata.contractName) return metadata.contractName;
    } catch (e) {
      // Ignore parsing errors
    }
  }
  
  return 'DCA';
}

async function uploadContract() {
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('smartcontracts');
    const collection = db.collection('contracts');
    
    // Read the DCA.json file
    const contractPath = path.join(__dirname, 'src/lib/out/DCA.json');
    const rawContractData = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    
    console.log('📄 Contract data loaded');
    console.log('📊 Contract name:', extractContractName(rawContractData));
    
    // Extract bytecode strings dynamically
    const bytecodeString = extractBytecodeString(rawContractData);
    const deployedBytecodeString = extractDeployedBytecodeString(rawContractData);
    
    console.log('🔧 Bytecode extracted:', bytecodeString.length, 'characters');
    console.log('🔧 Deployed bytecode extracted:', deployedBytecodeString.length, 'characters');
    
    // Create normalized document
    const document = {
      ...rawContractData,
      bytecode: bytecodeString, // Just the hex string
      deployedBytecode: deployedBytecodeString, // Just the hex string
      contractName: extractContractName(rawContractData),
      source: 'script-upload',
      originalFormat: 'foundry',
      uploadedAt: new Date(),
      createdAt: new Date()
    };
    
    // Insert the document
    const result = await collection.insertOne(document);
    console.log('✅ Contract uploaded successfully!');
    console.log('🆔 Inserted ID:', result.insertedId);
    console.log('📊 Database: smartcontracts');
    console.log('📊 Collection: contracts');
    
  } catch (error) {
    console.error('❌ Error uploading contract:', error);
  } finally {
    await client.close();
    console.log('🔌 Disconnected from MongoDB');
  }
}

console.log('🚀 Starting MongoDB upload...');
uploadContract();
