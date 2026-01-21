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
      
      return { user };
    } finally {
      isSigningUp.current = false;
    }
  }

  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  }

  function logout() {
    return signOut(auth);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      // Skip profile check if we are in the middle of a registration flow
      if (isSigningUp.current) {
        return; 
      }

      if (user) {
        // Fetch extra user data (role, approval)
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            
            // SECURITY CHECK: Disabled users cannot login
            if (data.disabled === true) {
              await signOut(auth);
              setCurrentUser(null);
              setUserData(null);
              alert("Byli jste odhlášeni.\nVáš účet byl deaktivován správcem systému.");
              setLoading(false);
              return;
            }
            
            setUserData(data);
          } else {
            console.error("No user profile found! Logging out...");
            await signOut(auth);
            setCurrentUser(null);
            setUserData(null);
            alert("Váš uživatelský profil nebyl nalezen (mohl být smazán nebo zamítnut).\nByli jste odhlášeni.");
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
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
