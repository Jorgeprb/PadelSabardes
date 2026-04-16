import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { arrayRemove, collection, deleteDoc, doc, getDocs, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LanguageContext';
import './AdminPages.css';

export default function UsersListPage() {
  const { primaryColor, colors } = useTheme();
  const { t } = useTranslation();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        setUsers(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
        setLoading(false);
      },
      (error) => {
        window.alert(`Error de Firebase\n\n${error.message}`);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const executeDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const uid = deleteTarget.id;

      const matchesSnapshot = await getDocs(collection(db, 'matches'));
      await Promise.all(
        matchesSnapshot.docs.map(async (matchDoc) => {
          const data = matchDoc.data();
          const updates: Record<string, unknown> = {};

          if (data.listaParticipantes?.includes(uid)) {
            updates.listaParticipantes = arrayRemove(uid);
          }
          if (data.listaInvitados?.includes(uid)) {
            updates.listaInvitados = arrayRemove(uid);
          }

          if (Object.keys(updates).length > 0) {
            await updateDoc(doc(db, 'matches', matchDoc.id), updates);
          }
        }),
      );

      const teamsSnapshot = await getDocs(collection(db, 'tournamentTeams'));
      await Promise.all(
        teamsSnapshot.docs.map(async (teamDoc) => {
          const data = teamDoc.data();
          if (data.player1Id === uid || data.player2Id === uid) {
            await deleteDoc(doc(db, 'tournamentTeams', teamDoc.id));
          }
        }),
      );

      await deleteDoc(doc(db, 'users', uid));
      setDeleteTarget(null);
      window.alert(`Eliminado\n\n${deleteTarget.nombreApellidos} ha sido borrado del sistema completamente.`);
    } catch (error: any) {
      window.alert(`Error\n\nNo se pudo eliminar al usuario: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>{t('registered_users')}</h1>
      </div>

      <div className="admin-scroll">
        {loading ? (
          <div className="centered-loader">
            <div className="spinner" style={{ borderTopColor: primaryColor }}></div>
          </div>
        ) : users.length === 0 ? (
          <p className="admin-empty">No hay usuarios registrados.</p>
        ) : (
          users.map((entry) => (
            <div key={entry.id} className="admin-card">
              {entry.fotoURL ? (
                <img src={entry.fotoURL} alt={entry.nombreApellidos} className="admin-avatar" />
              ) : (
                <div className="admin-avatar-placeholder">{entry.nombreApellidos?.charAt(0)?.toUpperCase() || '?'}</div>
              )}

              <div className="admin-card-content">
                <p className="admin-card-title">{entry.nombreApellidos}</p>
                <p className="admin-card-text">{entry.email}</p>
              </div>

              <span className="admin-pill" style={entry.role === 'admin' ? { borderColor: primaryColor, color: primaryColor } : undefined}>
                {entry.role}
              </span>

              <button className="admin-card-action" onClick={() => setDeleteTarget(entry)} aria-label={`Eliminar ${entry.nombreApellidos}`}>
                <Trash2 size={20} color={colors.danger} />
              </button>
            </div>
          ))
        )}
      </div>

      {deleteTarget && (
        <div className="modal-overlay modal-center">
          <div className="modal-card">
            <AlertTriangle size={52} color={colors.danger} className="admin-modal-icon" />
            <h3 className="admin-modal-title">{t('delete_user_confirm')}</h3>
            <p className="admin-modal-text">
              {t('delete_user_msg')} <strong style={{ color: colors.text }}>{deleteTarget.nombreApellidos}</strong>.
            </p>
            <div className="admin-modal-actions">
              <button className="btn btn-outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</button>
              <button className="btn btn-danger" onClick={executeDelete} disabled={deleting}>
                {deleting ? 'Borrando...' : t('delete_all')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
