import { NextRequest, NextResponse } from "next/server";
import { MongoClient, ObjectId } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await client.connect();
    const db = client.db("smartcontracts");
    const collection = db.collection("contracts");

    const { id } = await params;

    // Try to find by ObjectId first
    let transaction;
    try {
      transaction = await collection.findOne({ _id: new ObjectId(id) });
    } catch {
      // If ObjectId fails, try to find by other fields
      transaction = await collection.findOne({
        $or: [{ name: id }, { transactionName: id }],
      });
    }

    if (!transaction) {
      return NextResponse.json(
        {
          success: false,
          message: "Transaction not found",
        },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        transaction,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch transaction",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    await client.close();
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await client.connect();
    const db = client.db("smartcontracts");
    const collection = db.collection("transactions");

    const { id } = await params;

    // Try to delete by ObjectId first
    let result;
    try {
      result = await collection.deleteOne({ _id: new ObjectId(id) });
    } catch {
      // If ObjectId fails, try to delete by other fields
      result = await collection.deleteOne({
        $or: [{ name: id }, { transactionName: id }],
      });
    }

    if (result.deletedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          message: "Transaction not found",
        },
        { status: 404, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Transaction deleted successfully",
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Error deleting transaction:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete transaction",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500, headers: corsHeaders }
    );
  } finally {
    await client.close();
  }
}
