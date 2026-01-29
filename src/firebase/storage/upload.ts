import { getStorage, ref, uploadBytesResumable, getDownloadURL, connectStorageEmulator } from 'firebase/storage';
import { getApp } from 'firebase/app';

export function uploadFile(file: File, path: string, onProgress?: (p: number) => void) {
  const storage = getStorage(getApp());
  
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
