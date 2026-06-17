
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAs8CT69dImMCYDeOtYx9kMQQwgLqqQN7g",
  authDomain: "ricemanager-a4cd4.firebaseapp.com",
  projectId: "ricemanager-a4cd4",
  storageBucket: "ricemanager-a4cd4.firebasestorage.app",
  messagingSenderId: "992728767702",
  appId: "1:992728767702:web:39526fa98602b8623c3d77",
  measurementId: "G-GHFL8NXR6Z"
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
