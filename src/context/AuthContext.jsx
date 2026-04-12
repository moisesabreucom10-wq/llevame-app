import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../services/firebase';
import {
    onAuthStateChanged,
    signInWithPopup,
    signInWithRedirect, // Added
    getRedirectResult,  // Added
    GoogleAuthProvider,
    signInWithCredential, // Added

    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { Browser } from '@capacitor/browser';
import { App } from '@capacitor/app';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { pushNotificationService } from '../services/PushNotificationService';
// Importaciones del plugin nativo removidas, solo usamos Firebase Auth


const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Safety timeout: force loading false after 5 seconds if firebase hangs
        const timeoutId = setTimeout(() => {
            if (loading) {
                console.warn("AuthContext: Firebase init timed out, forcing loading=false");
                setLoading(false);
            }
        }, 5000);

        let unsubscribeProfile = null;

        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);

            // Clean up previous profile listener if exists
            if (unsubscribeProfile) {
                unsubscribeProfile();
                unsubscribeProfile = null;
            }

            if (user) {
                if (!db) {
                    console.error("Firestore 'db' not initialized in AuthContext effect");
                    setLoading(false);
                    return;
                }

                try {
                    // Listen to user profile changes in Firestore
                    const userRef = doc(db, 'llevame_users', user.uid);

                    unsubscribeProfile = onSnapshot(userRef, (docSnap) => {
                        if (docSnap.exists()) {
                            setUserProfile(docSnap.data());
                        } else {
                            setUserProfile(null);
                        }
                        setLoading(false);
                    }, (error) => {
                        console.error("Error listening to profile:", error);
                        setLoading(false);
                    });

                    // Inicializar Push Notifications
                    pushNotificationService.init(user.uid);

                } catch (e) {
                    console.error("Error setting up profile listener:", e);
                    setLoading(false);
                }
            } else {
                setUserProfile(null);
                setLoading(false);
            }
        });

        return () => {
            clearTimeout(timeoutId);
            unsubscribeAuth();
            if (unsubscribeProfile) {
                unsubscribeProfile();
            }
        };
    }, []);


    // Check for redirect result on mount
    // Listener for auth state is handled by onAuthStateChanged in the first useEffect
    // Native plugin handles the redirect flow internally, so no extra listeners needed here.

    const checkAndCreateProfile = async (user) => {
        if (!db) {
            console.error("CRITICAL: Firestore 'db' instance is undefined!");
            return;
        }

        try {
            const userRef = doc(db, 'llevame_users', user.uid);
            const userSnap = await getDoc(userRef);

            if (!userSnap.exists()) {
                await setDoc(userRef, {
                    id: user.uid,
                    email: user.email,
                    name: user.displayName,
                    photoURL: user.photoURL,
                    createdAt: new Date().toISOString(),
                    userType: null
                });
            }
        } catch (firestoreError) {
            console.error("Firestore operation failed:", firestoreError);
        }
    };

    const loginWithGoogle = async () => {
        try {
            // 1. Perform native sign-in
            const result = await FirebaseAuthentication.signInWithGoogle();

            // 2. Extract the ID token
            const { credential } = result;
            const idToken = credential?.idToken;

            if (!idToken) {
                throw new Error('No ID token found in native sign-in result');
            }

            // 3. Create a Firebase credential from the native token
            const googleCredential = GoogleAuthProvider.credential(idToken);

            // 4. Sign in to Firebase Web SDK with the credential
            const userCredential = await signInWithCredential(auth, googleCredential);

            // 5. Create profile if needed
            await checkAndCreateProfile(userCredential.user);

        } catch (error) {
            console.error("Google login error:", error);
            throw error;
        }
    };

    const signupEmail = async (email, password) => {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        // Create basic profile doc
        const userRef = doc(db, 'llevame_users', result.user.uid);
        await setDoc(userRef, {
            id: result.user.uid,
            email: result.user.email,
            createdAt: new Date().toISOString(),
            userType: null
        });
        return result;
    };

    const loginEmail = (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    const logout = () => signOut(auth);

    const resetPassword = (email) => {
        return sendPasswordResetEmail(auth, email);
    };

    // Helper to manually update profile (for optimistic UI updates)
    const updateUserProfile = (newProfileData) => {
        setUserProfile(prev => {
            const merged = { ...prev, ...newProfileData };
            // Persistir en localStorage usando el valor actualizado, no el closure stale
            try {
                localStorage.setItem('userProfile', JSON.stringify(merged));
            } catch { }
            return merged;
        });
    };

    // Attempt to load from localStorage on mount (to avoid flicker)
    useEffect(() => {
        try {
            const stored = localStorage.getItem('userProfile');
            if (stored) {
                setUserProfile(JSON.parse(stored));
            }
        } catch (e) { }
    }, []);

    const value = {
        currentUser,
        userProfile,
        loading,
        loginWithGoogle,
        signupEmail,
        loginEmail,
        logout,
        resetPassword, // Exported
        updateUserProfile // Export this!
    };

    return (
        <AuthContext.Provider value={value}>
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8fafc' }}>
                    <div style={{ width: '40px', height: '40px', border: '4px solid #e2e8f0', borderTop: '4px solid #3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};
