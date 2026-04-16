import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react';
import { addDoc, collection, getDocs } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import './AdminPages.css';

export default function CreateEditGroupPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { primaryColor, colors } = useTheme();

  const [name, setName] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'users'));
        setUsers(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
      } finally {
        setLoadingUsers(false);
      }
    };

    fetchUsers();
  }, []);

  const toggleUserSelection = (uid: string) => {
    setSelectedUserIds((previous) => {
      const next = new Set(previous);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      window.alert('Error\n\nIngresa el nombre del grupo');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'groups'), {
        name: name.trim(),
        userIds: Array.from(selectedUserIds),
        creatorId: user?.uid,
        fechaCreacion: new Date().toISOString(),
      });
      window.alert('Éxito\n\nGrupo creado');
      navigate(-1);
    } catch (error: any) {
      window.alert(`Error\n\n${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <button className="admin-round-button" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} color={colors.text} />
        </button>
        <div className="admin-topbar-title">Crear Grupo</div>
        <button className="btn btn-primary" style={{ padding: '12px 18px', borderRadius: 12 }} onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      <div className="admin-scroll" style={{ paddingBottom: 40 }}>
        <div className="admin-section-card">
          <label className="admin-label">Nombre del Grupo</label>
          <input
            className="input-field"
            placeholder="Ej: Jugadores Martes"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="admin-section-card">
          <label className="admin-label">Selecciona Miembros ({selectedUserIds.size})</label>
          {loadingUsers ? (
            <div className="centered-loader">
              <div className="spinner" style={{ borderTopColor: primaryColor }}></div>
            </div>
          ) : (
            users.map((entry) => {
              const selected = selectedUserIds.has(entry.id);
              return (
                <button
                  key={entry.id}
                  className={`admin-list-card ${selected ? 'is-selected' : ''}`}
                  onClick={() => toggleUserSelection(entry.id)}
                  type="button"
                >
                  <div>
                    <p className="admin-card-title">{entry.nombreApellidos}</p>
                    <p className="admin-card-text">{entry.email}</p>
                  </div>
                  {selected ? <CheckCircle2 size={28} color={primaryColor} /> : <Circle size={28} color={colors.border} style={{ opacity: 0.5 }} />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
