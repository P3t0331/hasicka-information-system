import React, { useContext, useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";

const AuthContext = React.createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
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
          } catch (loginError) {
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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      // isSigningUp logic handled locally or ignored for now as we want strict checks always
      if (isSigningUp.current && user) {
        // Special case: Registration flow.
        // We know we just created it and approved=false, but we might want to allow 
        // the flow to finish nicely?
        // Actually, if we want "Do not login him", then even after registration 
        // we should probably NOT set currentUser? 
        // But usually registration succeeds and we redirect. 
        // Let's keep the user object for registration flow stability, 
        // OR better: handle the registration success without relying on auth state change to login.
        
        // However, standard Firebase flow triggers this. 
        // If we want strict "No login until approved", then after signup we should probably 
        // sign out immediately? 
        // But the user just registered. The requirement is "not yet confirmed users".
        // New registrations are "not yet confirmed".
        // So they should arguably NOT be logged in. 
        setCurrentUser(user); 
        setLoading(false);
        return;
      }

      if (user) {
        // setLoading(true); // REMOVED: Preventing app unmount on login to keep Error state
        // We handle loading states locally in components if needed, or rely on userData being null briefly.
        // For unapproved users, this is better because we don't want to flash the UI.
        
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            const isUnapproved = data.approved === false;
            const isDisabled = data.disabled === true;

            if (isUnapproved || isDisabled) {
               // DO NOT LOG IN
               console.log("User unapproved/disabled - denying login.");
               await signOut(auth);
               setCurrentUser(null);
               setUserData(null);
               // We don't use alert() here. 
               // The Login page handles explicit login errors.
               // If this is a page refresh, the user just gets logged out silently 
               // (or redirected to login by PrivateRoute).
            } else {
               // VALID LOGIN
               setUserData(data);
               setCurrentUser(user); // ONLY SET HERE AFTER VERIFICATION
            }
          } else {
            console.error("No user profile found!");
            await signOut(auth);
            setCurrentUser(null);
            setUserData(null);
          }
        } catch (error) {
          console.error("Error verifying user:", error);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userData,
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
