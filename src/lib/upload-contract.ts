import DCA from './out/DCA.json';
import { normalizeContractData, extractContractName } from './bytecode-utils';

export async function uploadContractToMongoDB() {
  try {
    // Normalize the contract data to extract bytecode strings
    const normalizedData = normalizeContractData(DCA);
    
    // Add metadata
    const contractData = {
      ...normalizedData,
      contractName: extractContractName(DCA),
      source: 'foundry-output',
      originalFormat: 'foundry'
    };

    const response = await fetch('/api/upload-contract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(contractData),
    });

    const result = await response.json();

    if (result.success) {
      console.log('Contract uploaded successfully:', result);
      return result;
    } else {
      console.error('Failed to upload contract:', result.message);
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error uploading contract:', error);
    throw error;
  }
}

export async function fetchContractsFromMongoDB() {
  try {
    const response = await fetch('/api/upload-contract', {
      method: 'GET',
    });

    const result = await response.json();

    if (result.success) {
      console.log('Contracts fetched successfully:', result);
      return result.contracts;
    } else {
      console.error('Failed to fetch contracts:', result.message);
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Error fetching contracts:', error);
    throw error;
  }
}
