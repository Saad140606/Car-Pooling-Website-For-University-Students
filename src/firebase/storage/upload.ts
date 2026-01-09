import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export function uploadFile(file: File, path: string, onProgress?: (p: number) => void) {
  const storage = getStorage();
  const storageRef = ref(storage, path);
  const uploadTask = uploadBytesResumable(storageRef, file);

  return new Promise<string>((resolve, reject) => {
    uploadTask.on('state_changed', (snapshot) => {
      const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
      onProgress?.(progress);
    }, (error) => reject(error), async () => {
      try {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(url);
      } catch (e) { reject(e); }
    });
  });
}
