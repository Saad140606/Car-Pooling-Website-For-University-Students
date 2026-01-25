import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/firebase/firebaseAdmin';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const auth = adminAuth ?? getAuth();
    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const { university, fullName, gender, contactNumber } = await request.json();

    if (!university || !fullName || !gender || !contactNumber) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Get user email from auth
    const userRecord = await auth.getUser(uid);
    const email = userRecord.email;

    if (!email) {
      return NextResponse.json({ error: 'No email found for user' }, { status: 400 });
    }

    // Use Admin SDK to overwrite the document completely
    const db = adminDb ?? getFirestore();
    const userDocRef = db.collection('universities').doc(university).collection('users').doc(uid);

    // Set the document with all required fields
    await userDocRef.set({
      uid,
      email,
      fullName,
      gender,
      university,
      contactNumber,
      createdAt: FieldValue.serverTimestamp(),
      emailVerified: true,
      emailVerifiedAt: FieldValue.serverTimestamp(),
    }, { merge: false }); // Overwrite completely

    console.log(`Fixed profile for user ${uid} in ${university}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error fixing profile:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fix profile' },
      { status: 500 }
    );
  }
}
