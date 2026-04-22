import { useEffect, useState } from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { deleteUserAsAdmin } from '../services/adminService';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LanguageContext';
import AvatarPreviewModal from '../components/AvatarPreviewModal';
import './AdminPages.css';

export default function UsersListPage() {
  const { primaryColor, colors } = useTheme();
  const { t } = useTranslation();

  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<{ imageUrl: string; alt: string } | null>(null);

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
      await deleteUserAsAdmin(deleteTarget.id);
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
                <button
                  type="button"
                  className="admin-avatar-button"
                  onClick={() => setAvatarPreview({ imageUrl: entry.fotoURL, alt: entry.nombreApellidos })}
                >
                  <img src={entry.fotoURL} alt={entry.nombreApellidos} className="admin-avatar" />
                </button>
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

      {avatarPreview && (
        <AvatarPreviewModal
          imageUrl={avatarPreview.imageUrl}
          alt={avatarPreview.alt}
          onClose={() => setAvatarPreview(null)}
        />
      )}
    </div>
  );
}
