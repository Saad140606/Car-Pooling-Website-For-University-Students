import { getStorage, ref, uploadBytesResumable, getDownloadURL, connectStorageEmulator } from 'firebase/storage';
import { getApps } from 'firebase/app';

let emulatorConnected = false;

export function uploadFile(file: File, path: string, onProgress?: (p: number) => void) {
  const apps = getApps();
  if (!apps.length) {
    throw new Error('Firebase app not initialized');
  }
  const storage = getStorage(apps[0]);

  const emulatorHost = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_EMULATOR_HOST;
  const shouldUseLocalEmulator = typeof window !== 'undefined'
    && window.location.hostname === 'localhost'
    && process.env.NODE_ENV !== 'production';

  if (!emulatorConnected && (emulatorHost || shouldUseLocalEmulator)) {
    try {
      const hostPort = emulatorHost || 'localhost:9199';
      const [host, portRaw] = hostPort.split(':');
      const port = Number(portRaw) || 9199;
      connectStorageEmulator(storage, host, port);
      emulatorConnected = true;
    } catch (e) {
      console.warn('[Firebase Storage] Failed to connect to emulator:', e);
    }
  }
  
  // Increase max operational timeout to 120 seconds (default is 60)
  // This helps with slower connections or larger files
  storage.maxOperationRetryTime = 120000; // 120 seconds
  
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise<string>((resolve, reject) => {
    uploadTask.on('state_changed', (snapshot) => {
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      onProgress?.(progress);
    }, (error) => {
      console.error('Firebase Storage Error:', error);
      // Provide more helpful error message
      if (error.code === 'storage/retry-limit-exceeded') {
        reject(new Error('Upload timeout - please check your internet connection and try again'));
      } else {
        reject(error);
      }
    }, async () => {
      try {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(url);
      } catch (e) { 
        console.error('Download URL Error:', e);
        reject(e); 
      }
    });
  });
}
