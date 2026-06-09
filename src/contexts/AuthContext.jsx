/* eslint-disable react-refresh/only-export-components */
import React, { useContext, useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";
import { doc, setDoc, getDoc, getDocFromCache, onSnapshot, updateDoc } from "firebase/firestore";
import { logAction } from "../utils/logger";

const AuthContext = React.createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [sessionLastAppVisit, setSessionLastAppVisit] = useState(null);
  const [loading, setLoading] = useState(true);

  // Flag to prevent auto-logout during registration/reclamation
  const isSigningUp = React.useRef(false);

  async function signup(email, password, profileData) {
    isSigningUp.current = true;
    let user;

    try {
      try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        user = result.user;
      } catch (error) {
        if (error.code === 'auth/email-already-in-use') {
          // Attempt Account Reclamation for rejected/deleted profiles
          try {
            const credential = await signInWithEmailAndPassword(auth, email, password);
            user = credential.user;

            // Verify profile truly doesn't exist
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
              // Account exists and has profile -> Real conflict
              throw error;
            }
            // If we are here, Auth exists but Profile is missing -> PROCEED to overwrite/recreate
          } catch {
            // If login fails (wrong password) or profile exists, throw original error
            throw error;
          }
        } else {
          throw error;
        }
      }

      // Create/Overwrite user document
      try {
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: email,
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          roles: profileData.roles || ["Hasič"],
          phone: profileData.phone,
          address: profileData.address,
          approved: false,
          createdAt: new Date().toISOString()
        });
        logAction(db, user.uid, `${profileData.firstName} ${profileData.lastName}`,
          'USER_REGISTERED', 'profile',
          `Zaregistroval se do systému (${email})`);
      } catch (dbError) {
        console.error("Error writing to Firestore:", dbError);
        throw new Error("Chyba při vytváření profilu: " + dbError.message);
      }

      // Fetch the new user data to update state immediately
      const docSnap = await getDoc(doc(db, "users", user.uid));
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      }

      // STRICT LOGOUT: New users are not approved, so we must sign them out immediately
      await signOut(auth);
      setCurrentUser(null);
      setUserData(null);

      return { user, success: true };
    } finally {
      isSigningUp.current = false;
    }
  }

  async function login(email, password) {
    // 1. Sign in with Firebase (checks password)
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;

    // 2. Check Firestore Profile IMMEDIATELY
    const docRef = doc(db, "users", user.uid);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      await signOut(auth);
      throw new Error("Uživatel nenalezen (profil neexistuje).");
    }

    const data = docSnap.data();

    if (data.disabled) {
      await signOut(auth);
      throw new Error("Váš účet byl deaktivován.");
    }

    if (data.approved === false) {
      await signOut(auth);
      throw new Error("Účet není schválen. Vyčkejte na potvrzení administrátorem.");
    }

    return result;
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    let unsubscribeUserDoc = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      // Clean up previous user doc listener
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
        unsubscribeUserDoc = null;
      }

      if (isSigningUp.current && user) {
        setCurrentUser(user);
        setLoading(false);
        return;
      }

      if (user) {
        try {
          const docRef = doc(db, "users", user.uid);

          // Initial check for approval/disabled status
          let docSnap;
          try {
            docSnap = await getDocFromCache(docRef);
          } catch {
            docSnap = await getDoc(docRef);
          }

          if (!docSnap.exists()) {
            console.error("No user profile found!");
            await signOut(auth);
            setCurrentUser(null);
            setUserData(null);
            setLoading(false);
            return;
          }

          const initialData = docSnap.data();
          if (initialData.approved === false || initialData.disabled === true) {
            console.log("User unapproved/disabled - denying login.");
            await signOut(auth);
            setCurrentUser(null);
            setUserData(null);
            setLoading(false);
            return;
          }

          // Save the last visit for notifications before we overwrite it
          setSessionLastAppVisit(initialData.lastAppVisit || new Date(0).toISOString());
          
          // Update lastAppVisit in DB for the NEXT time they visit
          updateDoc(docRef, { lastAppVisit: new Date().toISOString() }).catch(console.error);

          // Valid user - set up real-time listener for profile updates
          setCurrentUser(user);
          setUserData(initialData);
          setLoading(false);

          // Subscribe to real-time updates for user profile
          unsubscribeUserDoc = onSnapshot(docRef, (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              // Check if user got disabled
              if (data.disabled === true) {
                signOut(auth);
                return;
              }
              setUserData(data);
            }
          });

        } catch (error) {
          console.error("Error verifying user:", error);
          setCurrentUser(null);
          setLoading(false);
        }
      } else {
        setCurrentUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeUserDoc) {
        unsubscribeUserDoc();
      }
    };
  }, []);

  const updateSessionVisitTime = () => {
    setSessionLastAppVisit(new Date().toISOString());
  };

  const value = {
    currentUser,
    userData,
    sessionLastAppVisit,
    updateSessionVisitTime,
    signup,
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
