import { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Trash2, UserPlus, X } from 'lucide-react';
import { collection, deleteDoc, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LanguageContext';
import './AdminPages.css';

export default function GroupDetailPage() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { primaryColor, colors } = useTheme();
  const { t } = useTranslation();

  const [group, setGroup] = useState<any>(null);
  const [groupName, setGroupName] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);

  useEffect(() => {
    if (!groupId) return;

    const loadData = async () => {
      const [groupSnapshot, usersSnapshot] = await Promise.all([
        getDoc(doc(db, 'groups', groupId)),
        getDocs(collection(db, 'users')),
      ]);

      if (groupSnapshot.exists()) {
        const data = groupSnapshot.data();
        setGroup({ id: groupSnapshot.id, ...data });
        setGroupName(data.name || '');
        setMemberIds(data.userIds || []);
      }

      setAllUsers(usersSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
      setLoading(false);
    };

    loadData();
  }, [groupId]);

  const handleSave = async () => {
    if (!groupId) return;
    if (!groupName.trim()) {
      window.alert('Error\n\nEl nombre no puede estar vacío.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'groups', groupId), {
        name: groupName.trim(),
        userIds: memberIds,
      });
      window.alert(`Éxito\n\n${t('save_group')}`);
      navigate(-1);
    } catch (error: any) {
      window.alert(`Error\n\n${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!groupId) return;
    setDeleting(true);

    try {
      await deleteDoc(doc(db, 'groups', groupId));
      setDeleteModalOpen(false);
      navigate('/groups');
    } catch (error: any) {
      window.alert(`Error\n\n${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const removeMember = (uid: string) => {
    setMemberIds((previous) => previous.filter((entry) => entry !== uid));
  };

  const addMember = (uid: string) => {
    if (!memberIds.includes(uid)) {
      setMemberIds((previous) => [...previous, uid]);
    }
    setAddMemberModalOpen(false);
  };

  const memberUsers = memberIds.map((uid) => allUsers.find((entry) => entry.id === uid)).filter(Boolean) as any[];
  const availableUsers = allUsers.filter((entry) => !memberIds.includes(entry.id));

  if (loading) {
    return (
      <div className="centered-loader">
        <div className="spinner" style={{ borderTopColor: primaryColor }}></div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <button className="admin-round-button" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} color={colors.text} />
        </button>
        <div className="admin-topbar-title">{group?.name || 'Grupo'}</div>
        <button className="admin-card-action" onClick={() => setDeleteModalOpen(true)}>
          <Trash2 size={20} color={colors.danger} />
        </button>
      </div>

      <div className="admin-scroll" style={{ paddingBottom: 40 }}>
        <div className="admin-section-card">
          <label className="admin-label">{t('group_name')}</label>
          <input
            className="input-field"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder={t('group_name')}
          />
        </div>

        <div className="admin-section-card">
          <div className="admin-inline-header">
            <span className="admin-label">{t('group_participants')} ({memberIds.length})</span>
            <button className="admin-add-pill" style={{ backgroundColor: primaryColor }} onClick={() => setAddMemberModalOpen(true)}>
              <UserPlus size={16} color="#fff" />
            </button>
          </div>

          {memberUsers.length === 0 ? (
            <p className="admin-member-empty">Sin participantes</p>
          ) : (
            memberUsers.map((entry) => (
              <div key={entry.id} className="admin-member-row">
                {entry.fotoURL ? (
                  <img src={entry.fotoURL} alt={entry.nombreApellidos} className="admin-avatar" style={{ width: 40, height: 40 }} />
                ) : (
                  <div className="admin-avatar-placeholder" style={{ width: 40, height: 40, fontSize: 16 }}>
                    {entry.nombreApellidos?.charAt(0) || '?'}
                  </div>
                )}
                <span className="admin-member-name">{entry.nombreApellidos}</span>
                <button className="admin-card-action" onClick={() => removeMember(entry.id)}>
                  <X size={20} color={colors.danger} />
                </button>
              </div>
            ))
          )}
        </div>

        <button className="btn btn-primary full" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : t('save_group')}
        </button>
      </div>

      {deleteModalOpen && (
        <div className="modal-overlay modal-center">
          <div className="modal-card">
            <Trash2 size={48} color={colors.danger} className="admin-modal-icon" />
            <h3 className="admin-modal-title">{t('delete_group_confirm')}</h3>
            <p className="admin-modal-text">{t('delete_group_msg')}</p>
            <div className="admin-modal-actions">
              <button className="btn btn-outline" onClick={() => setDeleteModalOpen(false)} disabled={deleting}>{t('cancel')}</button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'Borrando...' : t('delete')}</button>
            </div>
          </div>
        </div>
      )}

      {addMemberModalOpen && (
        <div className="modal-overlay">
          <div className="modal-sheet">
            <div className="modal-handle"></div>
            <h3 className="admin-modal-title" style={{ textAlign: 'left', marginBottom: 16 }}>Añadir Participante</h3>
            <div className="admin-sheet-list">
              {availableUsers.map((entry) => (
                <button key={entry.id} className="admin-card" style={{ marginBottom: 0 }} onClick={() => addMember(entry.id)}>
                  {entry.fotoURL ? (
                    <img src={entry.fotoURL} alt={entry.nombreApellidos} className="admin-avatar" style={{ width: 40, height: 40 }} />
                  ) : (
                    <div className="admin-avatar-placeholder" style={{ width: 40, height: 40, fontSize: 16 }}>
                      {entry.nombreApellidos?.charAt(0) || '?'}
                    </div>
                  )}
                  <div className="admin-card-content">
                    <p className="admin-card-title" style={{ marginBottom: 0 }}>{entry.nombreApellidos}</p>
                  </div>
                  <Plus size={24} color={primaryColor} />
                </button>
              ))}
              {availableUsers.length === 0 && <p className="admin-empty" style={{ margin: '12px 0 0' }}>Todos los usuarios ya están en el grupo.</p>}
            </div>
            <div style={{ marginTop: 16 }}>
              <button className="btn btn-outline full" onClick={() => setAddMemberModalOpen(false)}>{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
