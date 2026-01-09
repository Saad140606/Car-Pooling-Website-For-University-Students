import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { FirebaseApp } from 'firebase/app';

export async function uploadEvidence(firebaseApp: FirebaseApp | undefined, file: File, path = ''): Promise<string | null> {
  if (!firebaseApp) throw new Error('Firebase app not initialized');
  const storage = getStorage(firebaseApp);
  const filename = `${path || 'evidence'}/${Date.now()}_${file.name}`;
  const r = ref(storage, filename);
  const snap = await uploadBytes(r, file);
  const url = await getDownloadURL(snap.ref);
  return url;
}

export default { uploadEvidence };
