import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB0OQBRerNi7PEosgUsSYvNXizV1Kwgh9M",
  authDomain: "ricemanager-82d8f.firebaseapp.com",
  projectId: "ricemanager-82d8f",
  storageBucket: "ricemanager-82d8f.firebasestorage.app",
  messagingSenderId: "1032688188052",
  appId: "1:1032688188052:web:78e0a261b2220a34611281",
  measurementId: "G-PVWCD5Q56E"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Configuration is now valid
export const isConfigured = true;