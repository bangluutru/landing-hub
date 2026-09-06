import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAbhQU6DHVT5NeagxLl6AMH8ybJerVSnso',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'landing-hub-4ac12.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'landing-hub-4ac12',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'landing-hub-4ac12.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '768978633689',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:768978633689:web:79d2f54fd87c9322bc8fc8',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-XJPER22RNN'
};

let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  firestore = getFirestore(app);
} catch (e) {
  console.warn('[Firebase] Initialized in fallback mode:', e);
}

export { app, auth, firestore };
