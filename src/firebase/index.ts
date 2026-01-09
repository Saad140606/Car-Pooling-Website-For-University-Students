// src/firebase/index.ts
import { initializeFirebase } from './init';
import { FirebaseProvider, useFirebase, useFirebaseApp, useFirestore, useAuth } from './provider';
import { FirebaseClientProvider } from './client-provider';
import { useCollection } from './firestore/use-collection';
import { useDoc } from './firestore/use-doc';
import { useUser } from './auth/use-user';
import { useIsAdmin } from './auth/use-is-admin';

export {
  initializeFirebase,
  FirebaseProvider,
  FirebaseClientProvider,
  useCollection,
  useDoc,
  useUser,
  useIsAdmin,
  useFirebase,
  useFirebaseApp,
  useFirestore,
  useAuth,
};
