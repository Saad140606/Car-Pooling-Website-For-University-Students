import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { FirebaseApp } from 'firebase/app';

export async function uploadEvidence(firebaseApp: FirebaseApp | undefined, file: File, path = ''): Promise<string | null> {
  if (!firebaseApp) throw new Error('Firebase app not initialized');
  const storage = getStorage(firebaseApp);
  
  // Increase max operational timeout to 120 seconds
  storage.maxOperationRetryTime = 120000; // 120 seconds
  
  const filename = `${path || 'evidence'}/${Date.now()}_${file.name}`;
  const r = ref(storage, filename);
  
  try {
    const snap = await uploadBytes(r, file);
    const url = await getDownloadURL(snap.ref);
    return url;
  } catch (error: any) {
    console.error('Firebase Storage Upload Error:', error);
    if (error.code === 'storage/retry-limit-exceeded') {
      throw new Error('Upload timeout - please check your internet connection and try again');
    }
    throw error;
  }
}

export default { uploadEvidence };
