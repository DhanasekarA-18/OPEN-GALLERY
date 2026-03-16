import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';

export async function GET() {
  try {
    await connectDB();
    return NextResponse.json({ status: 'connected' }, { status: 200 });
  } catch (error) {
    console.error('Database connection failed:', error);
    return NextResponse.json({ status: 'error', message: 'Database connection failed' }, { status: 500 });
  }
}
