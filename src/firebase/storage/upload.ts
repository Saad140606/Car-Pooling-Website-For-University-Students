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
    let lastProgress = 0;

    uploadTask.on('state_changed', 
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        lastProgress = progress;
        
        // Log progress every 10% for debugging
        if (progress % 10 < 1 || progress === 100) {
          console.debug('[Firebase Storage] Upload progress:', Math.round(progress) + '%', {
            transferred: snapshot.bytesTransferred,
            total: snapshot.totalBytes,
            state: snapshot.state
          });
        }
        
        onProgress?.(progress);
      },
      (error) => {
        console.error('[Firebase Storage] ❌ Upload error:', {
          code: error.code,
          message: error.message,
          name: error.name,
          stack: error.stack
        });

        // Provide more helpful error messages
        if (error.code === 'storage/retry-limit-exceeded') {
          reject(new Error('Upload timeout - please check your internet connection and try again. Connection was lost after ' + Math.round(lastProgress) + '% progress.'));
        } else if (error.code === 'storage/unknown') {
          reject(new Error('Upload failed: network error or server error. Please try again.'));
        } else if (error.code === 'storage/unauthorized') {
          reject(new Error('Permission denied: you do not have permission to upload to this location.'));
        } else if (error.code === 'storage/unauthenticated') {
          reject(new Error('Authentication required: please log in and try again.'));
        } else {
          reject(new Error(`Upload failed: ${error.message || error.code}`));
        }
      },
      async () => {
        try {
          console.log('[Firebase Storage] ✅ Upload complete, retrieving download URL...');
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          console.log('[Firebase Storage] ✅ Download URL retrieved');
          resolve(url);
        } catch (e) {
          console.error('[Firebase Storage] ❌ Failed to get download URL:', e);
          reject(e);
        }
      }
    );
  });
}
