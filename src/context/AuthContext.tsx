import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, requestPushNotificationToken } from '../services/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';

export type UserRole = 'user' | 'admin';

export interface AppUser {
  uid: string;
  email: string | null;
  nombreApellidos: string;
  role: UserRole;
  fotoURL?: string;
  pushToken?: string;
  grupos: string[];
  notifPrefs?: {
    pushEnabled: boolean;
    invitations: boolean;
    joins: boolean;
    leaves: boolean;
    changes: boolean;
    cancellations: boolean;
  };
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);

        const unsubscribeSnapshot = onSnapshot(userDocRef, async (docSnapshot) => {
          if (docSnapshot.exists()) {
            const data = docSnapshot.data() as Omit<AppUser, 'uid'>;
            setUser({ uid: firebaseUser.uid, ...data });

            // Request Web Push token and persist to Firestore
            try {
              const webToken = await requestPushNotificationToken();
              if (webToken && data.pushToken !== webToken) {
                await setDoc(userDocRef, { pushToken: webToken }, { merge: true });
              }
            } catch (e) {
              console.log('[PushToken] Error getting web push token:', e);
            }

            setLoading(false);
          } else {
            // Self-healing: auto-create profile
            try {
              await setDoc(userDocRef, {
                email: firebaseUser.email || '',
                nombreApellidos: 'Usuario Externo',
                role: 'user',
                grupos: [],
                fechaCreacion: new Date().toISOString(),
              });
            } catch (e) {
              console.error('Error auto-creando perfil:', e);
              setUser(null);
              setLoading(false);
            }
          }
        });

        return () => unsubscribeSnapshot();
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const refreshUser = async () => {
    if (user?.uid) {
      const userDocRef = doc(db, 'users', user.uid);
      const docSnapshot = await getDoc(userDocRef);
      if (docSnapshot.exists()) {
        const data = docSnapshot.data() as Omit<AppUser, 'uid'>;
        setUser({ uid: user.uid, ...data });
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
