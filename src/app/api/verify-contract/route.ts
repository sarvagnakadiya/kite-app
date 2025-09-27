import { NextRequest, NextResponse } from "next/server";
import { MongoClient, ObjectId } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const ETHERSCAN_API_KEY =
  process.env.ETHERSCAN_API_KEY || "JGWS1C3GSNW3GQYVU5AHMB5Y2I9KUI6YHW";
const CHAIN_ID = 84532; // Base Sepolia

if (!MONGODB_URI) {
  throw new Error("Please add your MongoDB URI to .env.local");
}

const client = new MongoClient(MONGODB_URI);

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// Check verification status
async function checkVerificationStatus(guid: string, chainId: number) {
  try {
    const statusEndpoint = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=checkverifystatus&guid=${guid}&apikey=${ETHERSCAN_API_KEY}`;

    const response = await fetch(statusEndpoint);
    const result = await response.json();

    return result;
  } catch (err) {
    console.error("❌ Error checking status:", err);
    return null;
  }
}

// Submit verification request
async function submitVerification(
  contractData: any,
  contractAddress: string,
  constructorArgs?: string
) {
  try {
    // Use sourceCode if available, otherwise fall back to source
    const sourceCode = contractData.source || contractData.sourcePath || "";

    if (!sourceCode) {
      throw new Error("No source code found in contract data");
    }

    const formData = new URLSearchParams({
      apikey: ETHERSCAN_API_KEY,
      contractaddress: contractAddress,
      chainid: CHAIN_ID.toString(),
      module: "contract",
      action: "verifysourcecode",
      contractname: String(
        contractData.contractName || contractData.name || "Contract"
      ),
      codeformat: "solidity-single-file",
      compilerversion: `v${String(contractData.compilerVersion)}`,
      constructorArguments: constructorArgs ?? "",
      OptimizationUsed: contractData.settings?.optimizer?.enabled ? "1" : "0",
      runs: "200",
      sourceCode: sourceCode,
      evmversion: String(contractData.settings?.evmVersion ?? ""),
    });

    const endpoint = `https://api.etherscan.io/v2/api?chainId=${CHAIN_ID}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });

    const text = await response.text();

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error("Non-JSON response received: " + text);
    }

    return result;
  } catch (err) {
    console.error("❌ Error submitting verification:", err);
    throw err;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { contractId, contractAddress, constructorArgs } = body;

    if (!contractId || !contractAddress) {
      return NextResponse.json(
        {
          success: false,
          message: "Contract ID and contract address are required",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // Connect to MongoDB and fetch contract data
    await client.connect();
    const db = client.db("smartcontracts");
    const collection = db.collection("contracts");

    // Find contract by ID (ObjectId or name)
    let contract;
    try {
      contract = await collection.findOne({ _id: new ObjectId(contractId) });
    } catch {
      // If ObjectId fails, try to find by name or contractName
      contract = await collection.findOne({
        $or: [{ name: contractId }, { contractName: contractId }],
      });
    }

    if (!contract) {
      return NextResponse.json(
        {
          success: false,
          message: "Contract not found in database",
        },
        { status: 404, headers: corsHeaders }
      );
    }

    // Check if contract has source code (either sourceCode or source field)
    if (!contract.source && !contract.sourcePath) {
      return NextResponse.json(
        {
          success: false,
          message: "Contract source code not found in database",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    console.log(
      `Submitting verification for contract: ${
        contract.contractName || contract.name
      }`
    );
    console.log(`Contract address: ${contractAddress}`);

    // Submit verification request
    const verificationResult = await submitVerification(
      contract,
      contractAddress,
      constructorArgs
    );

    if (verificationResult.status === "1") {
      console.log("✅ Verification submitted successfully!");
      console.log("GUID:", verificationResult.result);

      const guid = verificationResult.result;
      let attempts = 0;
      const maxAttempts = 30; // Check for up to 5 minutes (30 * 10 seconds)
      let finalStatus = null;

      // Check status in a loop
      while (attempts < maxAttempts) {
        console.log(
          `Checking verification status... (attempt ${
            attempts + 1
          }/${maxAttempts})`
        );

        const statusResult = await checkVerificationStatus(guid, CHAIN_ID);

        if (statusResult && statusResult.status === "1") {
          console.log("✅ Contract verified successfully!");
          finalStatus = {
            status: "verified",
            message: "Contract verified successfully",
            result: statusResult.result,
          };
          break;
        } else if (statusResult && statusResult.result === "Pending in queue") {
          console.log("⏳ Verification pending in queue...");
          finalStatus = {
            status: "pending",
            message: "Verification pending in queue",
          };
        } else if (statusResult && statusResult.result === "Already Verified") {
          console.log("✅ Contract is already verified!");
          finalStatus = {
            status: "already_verified",
            message: "Contract is already verified",
          };
          break;
        } else if (statusResult) {
          console.log("❌ Verification failed:", statusResult.result);
          finalStatus = {
            status: "failed",
            message: "Verification failed",
            result: statusResult.result,
          };
          break;
        }

        // Wait 10 seconds before next check
        await new Promise((resolve) => setTimeout(resolve, 10000));
        attempts++;
      }

      if (attempts >= maxAttempts && !finalStatus) {
        finalStatus = {
          status: "timeout",
          message: "Verification status check completed after maximum attempts",
        };
      }

      return NextResponse.json(
        {
          success: true,
          message: "Verification process completed",
          guid: guid,
          status: finalStatus,
        },
        { headers: corsHeaders }
      );
    } else {
      console.log("❌ Verification failed:", verificationResult);
      return NextResponse.json(
        {
          success: false,
          message: "Verification submission failed",
          error: verificationResult.result || "Unknown error",
        },
        { status: 400, headers: corsHeaders }
      );
    }
  } catch (error) {
    console.error("❌ Error in verification process:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to verify contract",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    await client.close();
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const guid = searchParams.get("guid");

    if (!guid) {
      return NextResponse.json(
        {
          success: false,
          message: "GUID parameter is required",
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const statusResult = await checkVerificationStatus(guid, CHAIN_ID);

    if (statusResult) {
      return NextResponse.json(
        {
          success: true,
          status: statusResult,
        },
        { headers: corsHeaders }
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          message: "Failed to check verification status",
        },
        { status: 500, headers: corsHeaders }
      );
    }
  } catch (error) {
    console.error("❌ Error checking verification status:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to check verification status",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders }
    );
  }
}
