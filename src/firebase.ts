import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDw-wj6Pmno0yEkzLaJICMfr4W2tuxxe0M',
  authDomain: 'prevanzia.firebaseapp.com',
  projectId: 'prevanzia',
  storageBucket: 'prevanzia.firebasestorage.app',
  messagingSenderId: '301341182418',
  appId: '1:301341182418:web:fcc3427721df073f08e00b',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
