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

  async function signup(email, password, profileData) {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    const user = result.user;
    
    try {
      // Create user document
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: email,
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        roles: profileData.roles || ["Hasič"], // Default roles array
        phone: profileData.phone,
        address: profileData.address,
        approved: false, // Explicitly false
        createdAt: new Date().toISOString()
      });
    } catch (dbError) {
      console.error("Error writing to Firestore:", dbError);
      // Optional: Delete the auth user if database creation fails to maintain consistency
      // await deleteUser(user); 
      throw new Error("Chyba při vytváření profilu: " + dbError.message);
    }
    
    // Fetch the new user data to update state immediately if needed
    const docSnap = await getDoc(doc(db, "users", user.uid));
    if (docSnap.exists()) {
      setUserData(docSnap.data());
    }
    
    return result;
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
            console.error("No user profile found!");
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
