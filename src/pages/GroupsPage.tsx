import { useEffect, useState } from 'react';
import { ChevronRight, Plus } from 'lucide-react';
import { collection, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LanguageContext';
import './AdminPages.css';

export default function GroupsPage() {
  const navigate = useNavigate();
  const { primaryColor } = useTheme();
  const { t } = useTranslation();

  const [groups, setGroups] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      setGroups(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
      setLoading(false);
    });

    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    });

    return () => {
      unsubscribeGroups();
      unsubscribeUsers();
    };
  }, []);

  const getGroupMembers = (userIds: string[] = []) => users.filter((entry) => userIds.includes(entry.id));

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>{t('groups')}</h1>
      </div>

      <div className="admin-scroll">
        {loading ? (
          <div className="centered-loader">
            <div className="spinner" style={{ borderTopColor: primaryColor }}></div>
          </div>
        ) : groups.length === 0 ? (
          <p className="admin-empty">{t('no_groups_yet')}</p>
        ) : (
          groups.map((group) => {
            const members = getGroupMembers(group.userIds || []);
            const visibleMembers = members.slice(0, 4);
            const extraCount = members.length - visibleMembers.length;

            return (
              <button key={group.id} className="admin-card" onClick={() => navigate(`/groups/${group.id}`)}>
                <div className="admin-card-content">
                  <p className="admin-card-title">{group.name}</p>
                  <p className="admin-card-text">
                    {members.length > 0
                      ? members.map((entry) => entry.nombreApellidos?.split(' ')[0]).join(', ')
                      : 'Sin miembros'}
                  </p>

                  <div className="admin-member-strip">
                    {visibleMembers.map((entry) => (
                      entry.fotoURL ? (
                        <img key={entry.id} src={entry.fotoURL} alt={entry.nombreApellidos} className="admin-mini-avatar" />
                      ) : (
                        <div key={entry.id} className="admin-mini-avatar-placeholder">{entry.nombreApellidos?.charAt(0) || '?'}</div>
                      )
                    ))}
                    {extraCount > 0 && <div className="admin-mini-extra">+{extraCount}</div>}
                    <span className="admin-member-count">{members.length} {t('members')}</span>
                  </div>
                </div>

                <ChevronRight size={20} className="admin-card-chevron" />
              </button>
            );
          })
        )}
      </div>

      <button className="admin-fab" style={{ backgroundColor: primaryColor }} onClick={() => navigate('/groups/new')}>
        <Plus size={32} color="#fff" />
      </button>
    </div>
  );
}
