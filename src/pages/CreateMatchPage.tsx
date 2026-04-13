import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { sendCategorizedPushNotification } from '../services/PushService';
import { ArrowLeft, X, UserPlus } from 'lucide-react';
import './CreateMatch.css';

export default function CreateMatchPage() {
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { primaryColor } = useTheme();

  const [fecha, setFecha] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  });
  const [hora, setHora] = useState('17:00');
  const [users, setUsers] = useState<any[]>([]);

  const [inviteAll, setInviteAll] = useState(true);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [preParticipantes, setPreParticipantes] = useState<any[]>([null, null, null, null]);
  const [showUserPicker, setShowUserPicker] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      const uSnap = await getDocs(collection(db, 'users'));
      const fetchedUsers = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(fetchedUsers);

      if (editId) {
        const mSnap = await getDoc(doc(db, 'matches', editId));
        if (mSnap.exists()) {
          const m = mSnap.data();
          const [d, mo] = m.fecha.split('/');
          const now = new Date();
          setFecha(`${now.getFullYear()}-${mo}-${d}`);
          setHora(m.hora);
          if (m.listaInvitados?.length === fetchedUsers.length) setInviteAll(true);
          else { setInviteAll(false); setSelectedUserIds(new Set(m.listaInvitados)); }
          const newPre: any[] = [null, null, null, null];
          (m.listaParticipantes || []).forEach((uid: string, i: number) => {
            if (i < 4) newPre[i] = fetchedUsers.find(u => u.id === uid) || null;
          });
          setPreParticipantes(newPre);
        }
      }
    };
    init();
  }, [editId]);

  const formatDDMM = (dateStr: string) => {
    const [, mo, d] = dateStr.split('-');
    return `${d}/${mo}`;
  };

  const getMinutes = (hStr: string) => {
    const [h, m] = hStr.split(':');
    return parseInt(h) * 60 + parseInt(m);
  };

  const handleSave = async () => {
    const finalFecha = formatDDMM(fecha);
    const finalHora = hora;

    let finalInvitados = new Set<string>();
    if (inviteAll) users.forEach(u => finalInvitados.add(u.id));
    else selectedUserIds.forEach(id => finalInvitados.add(id));

    const fisicosParticipantes = preParticipantes.filter(p => p !== null).map(p => p.id);

    try {
      setLoading(true);

      // Check collisions with existing matches
      const qMatches = await getDocs(collection(db, 'matches'));
      let hasCollision = false;
      const newStartMin = getMinutes(finalHora);
      const newEndMin = newStartMin + 90;

      qMatches.docs.forEach(docSnap => {
        const m = { id: docSnap.id, ...docSnap.data() } as any;
        if (m.fecha === finalFecha) {
          if (editId && m.id === editId) return;
          const eStartMin = getMinutes(m.hora);
          const eEndMin = eStartMin + 90;
          if (newStartMin < eEndMin && newEndMin > eStartMin) hasCollision = true;
        }
      });

      // Check tournament collisions
      if (!hasCollision) {
        const tDoc = await getDoc(doc(db, 'tournament', 'currentTournament'));
        if (tDoc.exists()) {
          const tData = tDoc.data();
          const checkTMatch = (m: any) => {
            if ((m.status === 'scheduled' || m.status === 'confirmed') && m.date) {
              const [mStr, tStr] = m.date.split(' ');
              const mBase = mStr.substring(0, 5);
              if (mBase === finalFecha) {
                const eStartMin = getMinutes(tStr);
                const eEndMin = eStartMin + 90;
                if (newStartMin < eEndMin && newEndMin > eStartMin) hasCollision = true;
              }
            }
          };
          (tData.schedule || []).forEach(checkTMatch);
          if (tData.bracket) {
            (tData.bracket.quarterfinals || []).forEach(checkTMatch);
            (tData.bracket.semifinals || []).forEach(checkTMatch);
            if (tData.bracket.final) checkTMatch(tData.bracket.final);
          }
        }
      }

      if (hasCollision) {
        setLoading(false);
        return alert('Pista Ocupada ⏱️ — La pista dispone de bloques de 1h 30min y ya existe una reserva que se solapa.');
      }

      const payload = {
        titulo: 'PÁDEL',
        fecha: finalFecha,
        hora: finalHora,
        ubicacion: 'Sabardes',
        plazas: 4,
        creadorId: user?.uid,
        creadorNombre: user?.nombreApellidos,
        listaParticipantes: fisicosParticipantes,
        listaInvitados: Array.from(finalInvitados),
        estado: 'abierto',
      };

      if (editId) {
        await updateDoc(doc(db, 'matches', editId), payload);
      } else {
        await addDoc(collection(db, 'matches'), { ...payload, fechaCreacion: new Date().toISOString() });
      }

      const usersToNotify = new Set([...Array.from(finalInvitados), ...fisicosParticipantes]);
      usersToNotify.delete(user?.uid || '');

      if (editId) {
        await sendCategorizedPushNotification(Array.from(usersToNotify), 'Cambios en tu partido', `El partido del ${finalFecha} a las ${finalHora} ha sido editado.`, 'changes');
      } else {
        await sendCategorizedPushNotification(Array.from(usersToNotify), '🎾 ¡Nuevo Partido!', `Has sido invitado a jugar el ${finalFecha} a las ${finalHora}.`, 'invitations');
      }

      navigate(-1);
    } catch (e: any) { alert('Error: ' + e.message); setLoading(false); }
  };

  const openSlotPicker = (i: number) => {
    if (preParticipantes[i]) {
      const newPre = [...preParticipantes];
      newPre[i] = null;
      setPreParticipantes(newPre);
    } else {
      setActiveSlot(i);
      setShowUserPicker(true);
    }
  };

  const selectUser = (u: any) => {
    if (activeSlot === null) return;
    const newPre = [...preParticipantes];
    newPre[activeSlot] = u;
    setPreParticipantes(newPre);
    setShowUserPicker(false);
  };

  return (
    <div className="create-page">
      <div className="create-header" style={{ backgroundColor: primaryColor }}>
        <button className="hero-back" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} color="#fff" />
        </button>
        <h1>{editId ? 'Editar Partido' : 'Nuevo Partido'}</h1>
      </div>

      <div className="scroll-area" style={{ padding: 16, paddingBottom: 100 }}>
        <div className="form-group">
          <label>Fecha</label>
          <input className="input-field" type="date" value={fecha} onChange={e => setFecha(e.target.value)} />
        </div>
        <div className="form-group">
          <label>Hora</label>
          <input className="input-field" type="time" value={hora} onChange={e => setHora(e.target.value)} />
        </div>

        <div className="form-group">
          <label>Jugadores</label>
          <div className="players-grid">
            {preParticipantes.map((p, i) => (
              <div key={i} className="player-slot" onClick={() => openSlotPicker(i)}>
                {p ? (
                  <>
                    {p.fotoURL ? <img src={p.fotoURL} className="slot-img" alt="" /> : <div className="slot-placeholder">{p.nombreApellidos?.charAt(0)}</div>}
                    <span>{p.nombreApellidos?.split(' ')[0]}</span>
                    <button className="remove-btn"><X size={12} /></button>
                  </>
                ) : (
                  <>
                    <div className="slot-add"><UserPlus size={20} color={primaryColor} /></div>
                    <span style={{ color: 'var(--text-secondary)' }}>Vacante</span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Invitaciones</label>
          <div className="settings-row" onClick={() => setInviteAll(!inviteAll)}>
            <span>Invitar a todos</span>
            <label className="toggle"><input type="checkbox" checked={inviteAll} readOnly /><span className="toggle-slider"></span></label>
          </div>
          {!inviteAll && (
            <div className="user-checkboxes">
              {users.map(u => (
                <label key={u.id} className="user-check">
                  <input type="checkbox" checked={selectedUserIds.has(u.id)}
                    onChange={() => {
                      const s = new Set(selectedUserIds);
                      s.has(u.id) ? s.delete(u.id) : s.add(u.id);
                      setSelectedUserIds(s);
                    }} />
                  <span>{u.nombreApellidos}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <button className="btn btn-primary full" onClick={handleSave} disabled={loading}>
          {loading ? 'Guardando...' : editId ? 'Guardar Cambios' : 'Crear Partido'}
        </button>
      </div>

      {/* User Picker Modal */}
      {showUserPicker && (
        <div className="modal-overlay" onClick={() => setShowUserPicker(false)}>
          <div className="modal-body user-list-modal" onClick={e => e.stopPropagation()}>
            <h3>Seleccionar Jugador</h3>
            <div className="user-list">
              {users.filter(u => !preParticipantes.find(p => p?.id === u.id)).map(u => (
                <div key={u.id} className="user-item" onClick={() => selectUser(u)}>
                  {u.fotoURL ? <img src={u.fotoURL} className="user-avatar" alt="" /> : <div className="user-avatar placeholder-avatar">{u.nombreApellidos?.charAt(0)}</div>}
                  <span>{u.nombreApellidos}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
