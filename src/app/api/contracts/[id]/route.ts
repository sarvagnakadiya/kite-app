import { NextRequest, NextResponse } from 'next/server';
import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = process.env.NEXT_PUBLIC_MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error('Please add your MongoDB URI to .env.local');
}

const client = new MongoClient(MONGODB_URI);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await client.connect();
    const db = client.db('smartcontracts');
    const collection = db.collection('contracts');

    const { id } = await params;

    // Try to find by ObjectId first
    let contract;
    try {
      contract = await collection.findOne({ _id: new ObjectId(id) });
    } catch (e) {
      // If ObjectId fails, try to find by name or contractName
      contract = await collection.findOne({
        $or: [
          { name: id },
          { contractName: id }
        ]
      });
    }

    if (!contract) {
      return NextResponse.json(
        {
          success: false,
          message: 'Contract not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      contract,
    });

  } catch (error) {
    console.error('Error fetching contract:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to fetch contract',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
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
    const db = client.db('smartcontracts');
    const collection = db.collection('contracts');

    const { id } = await params;

    // Try to delete by ObjectId first
    let result;
    try {
      result = await collection.deleteOne({ _id: new ObjectId(id) });
    } catch (e) {
      // If ObjectId fails, try to delete by name or contractName
      result = await collection.deleteOne({
        $or: [
          { name: id },
          { contractName: id }
        ]
      });
    }

    if (result.deletedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          message: 'Contract not found',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Contract deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting contract:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to delete contract',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  } finally {
    await client.close();
  }
}
