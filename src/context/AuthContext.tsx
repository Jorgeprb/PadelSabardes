import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db, requestPushNotificationToken } from '../services/firebaseConfig';

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
    reminders: boolean;
    changes: boolean;
    cancellations: boolean;
  };
}

type AuthContextType = {
  user: AppUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refreshUser: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        unsubscribeProfile?.();
        unsubscribeProfile = undefined;
        setUser(null);
        setLoading(false);
        return;
      }

      const userDocRef = doc(db, 'users', firebaseUser.uid);

      unsubscribeProfile?.();
      unsubscribeProfile = onSnapshot(userDocRef, async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const data = docSnapshot.data() as Omit<AppUser, 'uid'>;
          setUser({ uid: firebaseUser.uid, ...data });

          try {
            const token = await requestPushNotificationToken();
            if (token && data.pushToken !== token) {
              await setDoc(userDocRef, { pushToken: token }, { merge: true });
            }
          } catch (error) {
            console.log('[PushToken] Error getting web push token:', error);
          }

          setLoading(false);
          return;
        }

        try {
          const deletedSnapshot = await getDoc(doc(db, 'deletedUsers', firebaseUser.uid));
          if (deletedSnapshot.exists()) {
            await signOut(auth).catch(() => {});
            setUser(null);
            setLoading(false);
            return;
          }

          await setDoc(userDocRef, {
            email: firebaseUser.email || '',
            nombreApellidos: 'Usuario Externo',
            role: 'user',
            grupos: [],
            fechaCreacion: new Date().toISOString(),
          });
        } catch (error) {
          console.error('Error auto-creando perfil:', error);
          setUser(null);
          setLoading(false);
        }
      });
    });

    return () => {
      unsubscribeProfile?.();
      unsubscribeAuth();
    };
  }, []);

  const refreshUser = async () => {
    if (!user?.uid) return;
    const snapshot = await getDoc(doc(db, 'users', user.uid));
    if (!snapshot.exists()) return;
    const data = snapshot.data() as Omit<AppUser, 'uid'>;
    setUser({ uid: user.uid, ...data });
  };

  return <AuthContext.Provider value={{ user, loading, refreshUser }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
