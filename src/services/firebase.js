import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";
import { initializeAuth, browserLocalPersistence, browserPopupRedirectResolver } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyCj31yOYezP6JjFU9NHPW1toRCQuICTKZs",
    authDomain: "llevame-app-24edf.firebaseapp.com",
    projectId: "llevame-app-24edf",
    storageBucket: "llevame-app-24edf.firebasestorage.app",
    messagingSenderId: "634861898408",
    appId: "1:634861898408:web:d3bac0046d77df1719509d",
    measurementId: "G-BF6GQL3Q63",
    // Realtime Database URL
    databaseURL: "https://llevame-app-24edf-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Firestore (para datos persistentes)
export const db = getFirestore(app);

// Storage
export const storage = getStorage(app);

// Auth
export const auth = initializeAuth(app, {
    persistence: browserLocalPersistence,
    popupRedirectResolver: browserPopupRedirectResolver
});

// Analytics (side-effect only — initializes Firebase Analytics)
getAnalytics(app);
