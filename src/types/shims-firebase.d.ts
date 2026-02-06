declare module 'firebase/app' {
  export function initializeApp(...args: any[]): any;
  export function getApps(...args: any[]): any;
  export function getApp(...args: any[]): any;
  export type FirebaseOptions = any;
}

declare module 'firebase/auth' {
  export function getAuth(...args: any[]): any;
  export function onAuthStateChanged(...args: any[]): any;
  export function createUserWithEmailAndPassword(...args: any[]): any;
  export function signInWithEmailAndPassword(...args: any[]): any;
  export function sendEmailVerification(...args: any[]): any;
  export function signOut(...args: any[]): any;
  export function setPersistence(...args: any[]): any;
  export const browserLocalPersistence: any;
  export type User = any;
  export function sendPasswordResetEmail(...args: any[]): any;
  export function verifyPasswordResetCode(...args: any[]): any;
  export function confirmPasswordReset(...args: any[]): any;
  export function updateProfile(...args: any[]): any;
  export function reauthenticateWithCredential(...args: any[]): any;
  export const EmailAuthProvider: any;
  export function updatePassword(...args: any[]): any;
}

declare module 'firebase/firestore' {
  export function getFirestore(...args: any[]): any;
  export function doc(...args: any[]): any;
  export function collection(...args: any[]): any;
  export function collectionGroup(...args: any[]): any;
  export function addDoc(...args: any[]): any;
  export function setDoc(...args: any[]): any;
  export function getDoc(...args: any[]): any;
  export function getDocs(...args: any[]): any;
  export function query(...args: any[]): any;
  export function where(...args: any[]): any;
  export function orderBy(...args: any[]): any;
  export function limit(...args: any[]): any;
  export function onSnapshot(...args: any[]): any;
  export function runTransaction(...args: any[]): any;
  export function writeBatch(...args: any[]): any;
  export function updateDoc(...args: any[]): any;
  export function deleteDoc(...args: any[]): any;
  export function serverTimestamp(...args: any[]): any;
  export const Timestamp: any;
  export type Timestamp = any;
}

declare module 'firebase/messaging' {
  export function getMessaging(...args: any[]): any;
  export function getToken(...args: any[]): any;
  export function deleteToken(...args: any[]): any;
  export function onMessage(...args: any[]): any;
  export type MessagePayload = any;
}

declare module 'firebase/analytics' {
  export function getAnalytics(...args: any[]): any;
}
// Auto-generated shims to smooth TypeScript checks for Firebase types in the repo
declare module 'firebase/firestore' {
  export type Firestore = any;
  export type DocumentData = any;
  export type DocumentReference<T = any> = any;
  export type Query<T = any> = any;
  export type Timestamp = any;
}

declare module 'firebase/app' {
  export type FirebaseApp = any;
}

declare module 'firebase/auth' {
  export type Auth = any;
}
