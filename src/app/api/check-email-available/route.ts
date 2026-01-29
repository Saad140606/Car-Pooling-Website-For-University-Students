import { NextRequest, NextResponse } from 'next/server';
import { getFirestore } from 'firebase-admin/firestore';
import { adminDb } from '@/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const { email, university } = await request.json();

    if (!email || !university) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const db = adminDb ?? getFirestore();
    const normalizedEmail = email.toLowerCase().trim();

    // Check BOTH universities to see if email is already registered
    const universities = ['fast', 'ned'];
    
    for (const uni of universities) {
      const usersRef = db.collection('universities').doc(uni).collection('users');
      const existingQuery = await usersRef.where('email', '==', normalizedEmail).limit(1).get();
      
      if (!existingQuery.empty) {
        const existingUser = existingQuery.docs[0].data();
        return NextResponse.json({
          available: false,
          existsIn: uni,
          message: `This email is already registered with ${uni === 'fast' ? 'FAST' : 'NED'} University.`
        });
      }
    }

    // Email is available
    return NextResponse.json({ available: true });
  } catch (error: any) {
    console.error('Error checking email availability:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check email availability' },
      { status: 500 }
    );
  }
}
