# MongoDB Contract Upload (Backend Only)

This project includes backend API endpoints to upload smart contract data to MongoDB with dynamic bytecode extraction.

## 🚀 Quick Start

### Option 1: Direct Script Upload
```bash
node upload-to-mongodb.js
```

### Option 2: API Upload
1. Start the server: `npm run dev`
2. Run the test: `node test-api.js`

### Option 3: Manual API Call
```bash
curl -X POST http://localhost:3000/api/upload-contract \
  -H "Content-Type: application/json" \
  -d @src/lib/out/DCA.json
```

## 📊 What Gets Uploaded

The system automatically extracts and normalizes:

- **ABI**: Contract interface
- **Bytecode**: Extracted from `bytecode.object` (just the hex string)
- **Deployed Bytecode**: Extracted from `deployedBytecode.object` (just the hex string)
- **Contract Name**: Auto-detected from metadata
- **Metadata**: Upload timestamp, source, format info

## 🗄️ Database Structure

- **Database**: `smartcontracts`
- **Collection**: `contracts`
- **Document**: Normalized contract data with extracted bytecode strings

## 🔧 Dynamic Bytecode Extraction

The system handles different contract formats automatically:

### Foundry Output Format
```json
{
  "bytecode": {
    "object": "0x60a060405234801561000f575f5ffd5b...",
    "sourceMap": "233:18253:22:-:0;;;504:394...",
    "linkReferences": {}
  }
}
```

### Simple String Format
```json
{
  "bytecode": "0x60a060405234801561000f575f5ffd5b..."
}
```

**Result**: Always extracts just the hex string from the `object` field.

## 📁 Files

- `src/app/api/upload-contract/route.ts` - API endpoint
- `src/lib/bytecode-utils.ts` - Dynamic extraction utilities
- `upload-to-mongodb.js` - Direct upload script
- `test-api.js` - API test script

## ✅ Verification

Check your MongoDB Atlas dashboard:
1. Database: `smartcontracts`
2. Collection: `contracts`
3. Look for your uploaded contract with extracted bytecode strings
