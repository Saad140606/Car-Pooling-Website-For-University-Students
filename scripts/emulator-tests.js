/* eslint-disable no-console */
const { initializeApp } = require('firebase/app');
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } = require('firebase/auth');
const { getFirestore, connectFirestoreEmulator, collection, addDoc, doc, setDoc, getDocs, query, orderBy, deleteDoc } = require('firebase/firestore');

async function run() {
  // Minimal client config for emulator usage
  const app = initializeApp({
    apiKey: 'fake',
    authDomain: 'localhost',
    projectId: 'demo-project'
  });

  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });

  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);

  console.log('Emulator test: creating two users');

  // Helper to create user accounts in emulator
  async function createAccount(email, password) {
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      console.log('Created', email, 'uid=', userCred.user.uid);
      return userCred.user;
    } catch (err) {
      // If user exists, sign in instead
      console.log('createAccount err (maybe exists) signing in:', err.message || err);
      const signedIn = await signInWithEmailAndPassword(auth, email, password);
      return signedIn.user;
    }
  }

  const user1Email = 'user1@example.test';
  const user2Email = 'user2@example.test';
  const pwd = 'pass123';

  const u1 = await createAccount(user1Email, pwd);
  await signOut(auth);
  const u2 = await createAccount(user2Email, pwd);
  await signOut(auth);

  // Sign in as user1 and create users/{uid} doc and a ride
  console.log('Signing in as user1 and creating users/{uid} & ride doc');
  await signInWithEmailAndPassword(auth, user1Email, pwd);
  await setDoc(doc(db, 'users', auth.currentUser.uid), { uid: auth.currentUser.uid, email: user1Email, university: 'fast' });

  // Create a ride under universities/fast/rides
  const ridesCol = collection(db, 'universities', 'fast', 'rides');
  const { serverTimestamp } = require('firebase/firestore');
  const rideRef = await addDoc(ridesCol, {
    createdBy: auth.currentUser.uid,
    driverId: auth.currentUser.uid,
    from: 'A',
    to: 'B',
    time: serverTimestamp(),
    createdAt: serverTimestamp(),
    seats: 3,
    availableSeats: 3,
    totalSeats: 3,
    status: 'active',
  });
  console.log('Created ride', rideRef.id);

  console.log('Now attempting list rides as user1');
  const q = query(collection(db, 'universities', 'fast', 'rides'), orderBy('createdAt', 'desc'));
  const snap1 = await getDocs(q);
  console.log('User1 sees rides:', snap1.docs.map(d => ({ id: d.id, ...d.data() })));

  // Sign out and sign in as user2
  await signOut(auth);
  console.log('Signing in as user2 (no users/{uid} doc) and attempting to delete the ride');
  await signInWithEmailAndPassword(auth, user2Email, pwd);

  try {
    await deleteDoc(doc(db, 'universities', 'fast', 'rides', rideRef.id));
    console.log('User2 was able to delete ride (unexpected with rules)');
  } catch (err) {
    console.log('User2 delete error (expected):', err.message || err);
  }

  console.log('Attempting list rides as user2');
  try {
    const snap2 = await getDocs(q);
    console.log('User2 sees rides:', snap2.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (err) {
    console.log('User2 list rides error (expected if rules deny):', err.message || err);
  }

  console.log('Test finished');
  process.exit(0);
}

run().catch((err) => { console.error('Script error', err); process.exit(1); });
