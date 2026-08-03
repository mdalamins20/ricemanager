
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase (v8 style)
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
  
  // Enable Offline Persistence for Instant Data Access (Zero Latency)
  firebase.firestore().enablePersistence({ synchronizeTabs: true }).catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Persistence failed: Multiple tabs open.");
    } else if (err.code === 'unimplemented') {
      console.warn("Persistence not supported by browser.");
    }
  });
}

export const auth = firebase.auth();
export const db = firebase.firestore();

// Configuration is now valid
export const isConfigured = true;
