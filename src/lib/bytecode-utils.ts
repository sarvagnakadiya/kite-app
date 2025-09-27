// Utility functions to extract bytecode from different contract formats

export interface BytecodeStructure {
  object?: string;
  sourceMap?: string;
  linkReferences?: Record<string, any>;
}

export interface ContractData {
  abi: any[];
  bytecode?: BytecodeStructure | string;
  deployedBytecode?: BytecodeStructure | string;
  [key: string]: any;
}

/**
 * Extracts the actual bytecode string from various contract formats
 * Handles both Foundry output format and simple string format
 */
export function extractBytecodeString(contractData: ContractData): string {
  // If bytecode is already a string, return it
  if (typeof contractData.bytecode === 'string') {
    return contractData.bytecode;
  }

  // If bytecode is an object with 'object' property (Foundry format)
  if (contractData.bytecode && typeof contractData.bytecode === 'object' && 'object' in contractData.bytecode) {
    return (contractData.bytecode as BytecodeStructure).object || '';
  }

  // If deployedBytecode exists and has 'object' property
  if (contractData.deployedBytecode && typeof contractData.deployedBytecode === 'object' && 'object' in contractData.deployedBytecode) {
    return (contractData.deployedBytecode as BytecodeStructure).object || '';
  }

  // If deployedBytecode is a string
  if (typeof contractData.deployedBytecode === 'string') {
    return contractData.deployedBytecode;
  }

  return '';
}

/**
 * Extracts the deployed bytecode string from various contract formats
 */
export function extractDeployedBytecodeString(contractData: ContractData): string {
  // If deployedBytecode is already a string, return it
  if (typeof contractData.deployedBytecode === 'string') {
    return contractData.deployedBytecode;
  }

  // If deployedBytecode is an object with 'object' property (Foundry format)
  if (contractData.deployedBytecode && typeof contractData.deployedBytecode === 'object' && 'object' in contractData.deployedBytecode) {
    return (contractData.deployedBytecode as BytecodeStructure).object || '';
  }

  // Fallback to bytecode if deployedBytecode doesn't exist
  return extractBytecodeString(contractData);
}

/**
 * Normalizes contract data by extracting bytecode strings
 * This creates a clean version with just the hex strings
 */
export function normalizeContractData(contractData: ContractData): ContractData {
  const normalized = { ...contractData };
  
  // Extract bytecode string
  const bytecodeString = extractBytecodeString(contractData);
  if (bytecodeString) {
    normalized.bytecode = bytecodeString;
  }

  // Extract deployed bytecode string
  const deployedBytecodeString = extractDeployedBytecodeString(contractData);
  if (deployedBytecodeString) {
    normalized.deployedBytecode = deployedBytecodeString;
  }

  return normalized;
}

/**
 * Gets contract name from various sources
 */
export function extractContractName(contractData: ContractData): string {
  // Try to get from contractName field
  if (contractData.contractName) {
    return contractData.contractName;
  }

  // Try to get from metadata
  if (contractData.metadata) {
    try {
      const metadata = typeof contractData.metadata === 'string' 
        ? JSON.parse(contractData.metadata) 
        : contractData.metadata;
      
      if (metadata.contractName) {
        return metadata.contractName;
      }
    } catch (e) {
      // Ignore parsing errors
    }
  }

  // Try to get from contractId
  if (contractData.contractId) {
    return contractData.contractId;
  }

  return 'Unknown';
}
