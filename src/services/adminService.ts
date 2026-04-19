import { httpsCallable } from 'firebase/functions';
import { functions } from './firebaseConfig';

const deleteUserAsAdminCallable = httpsCallable<{ targetUid: string }, { deleted: boolean }>(
  functions,
  'deleteUserAsAdmin',
);

export const deleteUserAsAdmin = async (targetUid: string) => {
  await deleteUserAsAdminCallable({ targetUid });
};
