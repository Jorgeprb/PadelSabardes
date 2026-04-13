import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, deleteDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { sendCategorizedPushNotification } from '../services/PushService';
import { ArrowLeft, Trash2, Pencil, Plus, X, Trophy } from 'lucide-react';
import './MatchDetail.css';

export default function MatchDetailPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { primaryColor } = useTheme();
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [participantsData, setParticipantsData] = useState<any[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [kickTarget, setKickTarget] = useState<any>(null);

  useEffect(() => {
    if (!matchId) return;
    const unsub = onSnapshot(doc(db, 'matches', matchId), (docSnap) => {
      if (docSnap.exists()) {
        const matchData: any = { id: docSnap.id, ...docSnap.data() };
        setMatch(matchData);
        fetchParticipants(matchData.listaParticipantes || []);
      }
    });
    return () => unsub();
  }, [matchId]);

  const fetchParticipants = async (uids: string[]) => {
    if (uids.length === 0) { setParticipantsData([]); setLoading(false); return; }
    const docs = await Promise.all(uids.map(uid => getDoc(doc(db, 'users', uid))));
    setParticipantsData(docs.map(d => ({ uid: d.id, ...d.data() })));
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!match || !user || !matchId) return;
    if (match.listaParticipantes?.length >= match.plazas) return alert('El partido ya está completo');
    await updateDoc(doc(db, 'matches', matchId), { listaParticipantes: arrayUnion(user.uid) });
    const others = (match.listaParticipantes || []).filter((id: string) => id !== user.uid);
    await sendCategorizedPushNotification(others, 'PÁDEL Sabardes', `${user.nombreApellidos} se ha unido al partido del ${match.fecha}.`, 'joins');
  };

  const handleLeave = async () => {
    if (!match || !user || !matchId) return;
    await updateDoc(doc(db, 'matches', matchId), { listaParticipantes: arrayRemove(user.uid) });
    const others = (match.listaParticipantes || []).filter((id: string) => id !== user.uid);
    await sendCategorizedPushNotification(others, 'PÁDEL Sabardes', `${user.nombreApellidos} se ha dado de baja del partido del ${match.fecha}.`, 'leaves');
  };

  const executeKick = async () => {
    if (!match || !kickTarget || !matchId) return;
    await updateDoc(doc(db, 'matches', matchId), { listaParticipantes: arrayRemove(kickTarget.uid) });
    await sendCategorizedPushNotification([kickTarget.uid], 'PÁDEL Sabardes', `El administrador te ha expulsado del partido del ${match.fecha}.`, 'leaves');
    setKickTarget(null);
  };

  const executeDelete = async () => {
    if (!matchId) return;
    const parts = match?.listaParticipantes || [];
    const others = parts.filter((id: string) => id !== user?.uid);
    await deleteDoc(doc(db, 'matches', matchId));
    await sendCategorizedPushNotification(others, 'Partido Cancelado', `El administrador ha cancelado el partido del ${match.fecha}.`, 'cancellations');
    setShowDeleteModal(false);
    navigate('/');
  };

  if (loading || !match) return <div className="detail-loading"><div className="spinner"></div></div>;

  const isParticipant = match.listaParticipantes?.includes(user?.uid);
  const isTournament = !!match.isTournament;
  const accent = isTournament ? '#D4A017' : primaryColor;
  const max = match.plazas || 4;
  const half = Math.ceil(max / 2);

  const renderSlot = (index: number) => {
    const p = participantsData[index];
    if (p) {
      const isMe = p.uid === user?.uid;
      return (
        <div className="slot-player" key={index}>
          <div className="slot-avatar-wrap">
            {p.fotoURL ? (
              <img src={p.fotoURL} className="slot-avatar" alt={p.nombreApellidos} />
            ) : (
              <div className="slot-avatar placeholder-avatar">
                {p.nombreApellidos?.charAt(0)?.toUpperCase()}
              </div>
            )}
            {(isMe || user?.role === 'admin') && (
              <button className="leave-badge" onClick={(e) => { e.stopPropagation(); isMe ? handleLeave() : setKickTarget(p); }}>
                <X size={12} color="#fff" />
              </button>
            )}
          </div>
          <span className="slot-name">{p.nombreApellidos?.split(' ')[0]}</span>
        </div>
      );
    }
    return (
      <div className="slot-player" key={index}>
        <button
          className="slot-empty"
          style={{ borderColor: accent }}
          onClick={!isParticipant ? handleJoin : undefined}
          disabled={isParticipant}
        >
          <Plus size={24} color={accent} />
        </button>
        {!isParticipant && <span className="slot-empty-text" style={{ color: accent }}>Unirse</span>}
      </div>
    );
  };

  return (
    <div className="detail-page">
      <div className="detail-hero" style={{ backgroundColor: accent }}>
        <div className="hero-line-1"></div>
        <div className="hero-line-2"></div>
        <div className="hero-nav">
          <button className="hero-back" onClick={() => navigate(-1)}>
            <ArrowLeft size={22} color="#fff" />
          </button>
          {user?.role === 'admin' && (
            <div className="hero-actions">
              <button className="hero-edit" onClick={() => navigate(`/create-match?edit=${matchId}`)}>
                <Pencil size={18} color={accent} />
              </button>
              <button className="hero-delete" onClick={() => setShowDeleteModal(true)}>
                <Trash2 size={18} color="#fff" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="detail-scroll">
        <div className="detail-card">
          <div className="detail-card-header">
            {isTournament ? <Trophy size={24} color="#D4A017" /> : <span className="detail-icon">🎾</span>}
            <div>
              <h2>{isTournament ? 'TORNEO' : 'PÁDEL'}</h2>
              <span className="detail-sub">{match.fecha} • {match.hora}</span>
            </div>
          </div>
          <div className="detail-info-grid">
            <div><span className="info-label">Ubicación</span><span className="info-val">{match.ubicacion}</span></div>
            <div><span className="info-label">Plazas</span><span className="info-val">{match.listaParticipantes?.length || 0}/{max}</span></div>
          </div>
        </div>

        <div className="players-section">
          <h3>Jugadores</h3>
          <div className="team-container">
            <span className="team-letter">A</span>
            <div className="team-slots">
              {Array.from({ length: half }).map((_, i) => renderSlot(i))}
            </div>
          </div>
          <div className="vs-divider"><div className="vs-line"></div><span>VS</span><div className="vs-line"></div></div>
          <div className="team-container">
            <span className="team-letter">B</span>
            <div className="team-slots">
              {Array.from({ length: max - half }).map((_, i) => renderSlot(half + i))}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-body" onClick={e => e.stopPropagation()}>
            <Trash2 size={40} color="var(--danger-color)" />
            <h3>¿Borrar Partido?</h3>
            <p>Esta acción no se puede deshacer.</p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowDeleteModal(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={executeDelete}>Borrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Kick Modal */}
      {kickTarget && (
        <div className="modal-overlay" onClick={() => setKickTarget(null)}>
          <div className="modal-body" onClick={e => e.stopPropagation()}>
            <h3>¿Expulsar a {kickTarget.nombreApellidos}?</h3>
            <p>Tendrá que volver a unirse manualmente.</p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setKickTarget(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={executeKick}>Expulsar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
