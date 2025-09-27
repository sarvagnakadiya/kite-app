import { NextRequest, NextResponse } from "next/server";
import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error("Please add your MongoDB URI to .env.local");
}

const client = new MongoClient(MONGODB_URI);

// Simple CORS headers allowing any origin. Adjust as needed.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: NextRequest) {
  try {
    await client.connect();
    const db = client.db("smartcontracts");
    const collection = db.collection("contracts");

    // Get the JSON data from the request body
    const rawContractData = await request.json();

    // Normalize the contract data to extract bytecode strings dynamically

    // Add timestamp and metadata
    const document = {
      ...rawContractData,
      uploadedAt: new Date(),
      createdAt: new Date(),
    };

    // Insert the document into MongoDB
    const result = await collection.insertOne(document);

    return NextResponse.json(
      {
        success: true,
        message: "Contract data uploaded successfully",
        insertedId: result.insertedId,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error uploading contract data:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to upload contract data",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    await client.close();
  }
}

export async function GET() {
  try {
    await client.connect();
    const db = client.db("smartcontracts");
    const collection = db.collection("contracts");

    // Get all contracts
    const contracts = await collection.find({}).toArray();

    return NextResponse.json(
      {
        success: true,
        contracts,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error fetching contracts:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch contracts",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    await client.close();
  }
}
