import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import OTP from '@/models/OTP';
import jwt from 'jsonwebtoken';
import CryptoJS from 'crypto-js';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret';

export async function POST(request: Request) {
  try {
    const { email, otp } = await request.json();

    if (!email || !otp) {
      return NextResponse.json({ message: 'Email and OTP are required' }, { status: 400 });
    }

    await connectDB();

    const record = await OTP.findOne({ email, otp });

    if (!record) {
      return NextResponse.json({ message: 'Invalid or expired OTP' }, { status: 400 });
    }

    // Delete OTP after verification
    await OTP.deleteOne({ _id: record._id });

    // Generate JWT
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1d' });

    // Encrypt email for the cookie
    const encryptedEmail = CryptoJS.AES.encrypt(email, JWT_SECRET).toString();

    // Set cookies
    const response = NextResponse.json({ 
      message: 'Authentication successful', 
      token,
      user: { email } 
    }, { status: 200 });

    // Auth Token Cookie
    response.cookies.set({
      name: 'auth_token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24, // 1 day
      path: '/',
    });

    // Encrypted User Email Cookie (Client readable if needed, but safe)
    response.cookies.set({
      name: 'user_session',
      value: encryptedEmail,
      httpOnly: false, // Accessible by client for display if decrypted
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 60 * 60 * 24,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    return NextResponse.json({ message: 'Failed to verify OTP' }, { status: 500 });
  }
}
