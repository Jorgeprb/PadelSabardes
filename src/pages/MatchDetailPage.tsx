import { useEffect, useState } from 'react';
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Pencil, Plus, Trash2, Trophy, UserPlus, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { sendCategorizedPushNotification } from '../services/PushService';
import './MatchDetail.css';

export default function MatchDetailPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { primaryColor, colors } = useTheme();

  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [participantsData, setParticipantsData] = useState<any[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [kickTarget, setKickTarget] = useState<any>(null);
  const [adminUserModalVisible, setAdminUserModalVisible] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  useEffect(() => {
    if (!matchId) return undefined;
    setLoading(true);
    const unsubscribe = onSnapshot(doc(db, 'matches', matchId), (snapshot) => {
      if (!snapshot.exists()) return;
      const matchData = { id: snapshot.id, ...snapshot.data() } as any;
      setMatch(matchData);
      fetchParticipants(matchData.listaParticipantes || []);
    });
    return () => unsubscribe();
  }, [matchId]);

  const fetchParticipants = async (userIds: string[]) => {
    if (userIds.length === 0) {
      setParticipantsData([]);
      setLoading(false);
      return;
    }

    const docs = await Promise.all(userIds.map((uid) => getDoc(doc(db, 'users', uid))));
    setParticipantsData(docs.map((entry) => ({ uid: entry.id, ...entry.data() })));
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!match || !user || !matchId) return;
    if (match.listaParticipantes?.length >= match.plazas) {
      window.alert('Aviso\n\nEl partido ya esta completo');
      return;
    }

    await updateDoc(doc(db, 'matches', matchId), { listaParticipantes: arrayUnion(user.uid) });
    const others = (match.listaParticipantes || []).filter((id: string) => id !== user.uid);
    await sendCategorizedPushNotification(others, 'PADEL Sabardes', `${user.nombreApellidos} se ha unido al partido del ${match.fecha}.`, 'joins');
  };

  const handleLeave = async () => {
    if (!match || !user || !matchId) return;
    await updateDoc(doc(db, 'matches', matchId), { listaParticipantes: arrayRemove(user.uid) });
    const others = (match.listaParticipantes || []).filter((id: string) => id !== user.uid);
    await sendCategorizedPushNotification(others, 'PADEL Sabardes', `${user.nombreApellidos} se ha dado de baja del partido del ${match.fecha}.`, 'leaves');
  };

  const executeKick = async () => {
    if (!match || !kickTarget || !matchId) return;
    await updateDoc(doc(db, 'matches', matchId), { listaParticipantes: arrayRemove(kickTarget.uid) });
    await sendCategorizedPushNotification([kickTarget.uid], 'PADEL Sabardes', `El administrador te ha expulsado del partido del ${match.fecha}.`, 'leaves');
    setKickTarget(null);
  };

  const executeDelete = async () => {
    if (!matchId || !(user?.role === 'admin' || match?.creadorId === user?.uid)) return;
    const others = (match?.listaParticipantes || []).filter((id: string) => id !== user?.uid);
    await deleteDoc(doc(db, 'matches', matchId));
    await sendCategorizedPushNotification(others, 'Partido Cancelado', `El partido del ${match?.fecha} ha sido cancelado.`, 'cancellations');
    setShowDeleteModal(false);
    navigate(-1);
  };

  const openAdminPicker = async () => {
    if (allUsers.length === 0) {
      const snapshot = await getDocs(collection(db, 'users'));
      setAllUsers(snapshot.docs.map((entry) => ({ uid: entry.id, ...entry.data() })));
    }
    setAdminUserModalVisible(true);
  };

  const addPlayerAsAdmin = async (entry: any) => {
    if (!matchId || !match) return;
    setAdminUserModalVisible(false);
    await updateDoc(doc(db, 'matches', matchId), { listaParticipantes: arrayUnion(entry.uid) });
    const others = (match.listaParticipantes || []).filter((id: string) => id !== entry.uid);
    await sendCategorizedPushNotification(others, 'PADEL Sabardes', `El admin ha anadido a ${entry.nombreApellidos} al partido del ${match.fecha}.`, 'joins');
  };

  if (loading || !match) {
    return <div className="centered-loader"><div className="spinner" style={{ borderTopColor: primaryColor }}></div></div>;
  }

  const isParticipant = match.listaParticipantes?.includes(user?.uid);
  const isTournament = !!match.isTournament;
  const canManageMatch = user?.role === 'admin' || match.creadorId === user?.uid;
  const accentColor = isTournament ? '#D4A017' : primaryColor;
  const max = match.plazas || 4;
  const half = Math.ceil(max / 2);

  const renderSlot = (index: number) => {
    const participant = participantsData[index];

    if (participant) {
      const isMe = participant.uid === user?.uid;
      return (
        <div className="detail-slot-player" key={`slot-${index}`}>
          <div className="detail-slot-avatar-wrap">
            {participant.fotoURL ? (
              <img src={participant.fotoURL} className="detail-slot-avatar" alt={participant.nombreApellidos} />
            ) : (
              <div className="detail-slot-avatar detail-slot-avatar-placeholder">{participant.nombreApellidos?.charAt(0)?.toUpperCase()}</div>
            )}
            {(isMe || user?.role === 'admin') && (
              <button className="detail-leave-badge" onClick={() => (isMe ? handleLeave() : setKickTarget(participant))}>
                <X size={14} color="#fff" />
              </button>
            )}
          </div>
          <span className="detail-slot-name">{participant.nombreApellidos?.split(' ')[0]}</span>
        </div>
      );
    }

    return (
      <div className="detail-slot-player" key={`slot-${index}`}>
        <button
          className="detail-slot-empty"
          style={{ borderColor: accentColor }}
          onClick={() => {
            if (user?.role === 'admin') openAdminPicker();
            else if (!isParticipant) handleJoin();
          }}
          disabled={isParticipant && user?.role !== 'admin'}
        >
          {user?.role === 'admin' ? <UserPlus size={26} color={accentColor} /> : <Plus size={26} color={accentColor} />}
        </button>
        {(!isParticipant || user?.role === 'admin') && <span className="detail-slot-empty-text" style={{ color: accentColor }}>Pulsar</span>}
      </div>
    );
  };

  return (
    <div className="detail-page">
      <div className="detail-hero" style={{ backgroundColor: accentColor }}>
        <div className="detail-court-line detail-court-line-1"></div>
        <div className="detail-court-line detail-court-line-2"></div>
        <div className="detail-top-nav">
          <button className="detail-round-button translucent" onClick={() => navigate(-1)}>
            <ArrowLeft size={24} color="#fff" />
          </button>
          {canManageMatch && (
            <div className="detail-top-actions">
              <button className="detail-round-button solid" onClick={() => navigate(`/create-match?matchId=${matchId}`)}>
                <Pencil size={20} color={accentColor} />
              </button>
              <button className="detail-round-button danger" onClick={() => setShowDeleteModal(true)}>
                <Trash2 size={20} color="#fff" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="detail-scroll scroll-area">
        <div className="detail-main-card card">
          <div className="detail-main-card-header">
            {isTournament ? <Trophy size={28} color="#D4A017" /> : <span className="detail-ball-icon">PADEL</span>}
            <div>
              <div className="detail-main-title">{isTournament ? 'TORNEO' : 'PADEL'}</div>
              <div className="detail-main-subtitle">{match.fecha} • {match.hora}</div>
            </div>
          </div>
          <div className="detail-info-grid">
            <div>
              <span className="detail-info-label">Ubicacion</span>
              <span className="detail-info-value">{match.ubicacion}</span>
            </div>
            <div>
              <span className="detail-info-label">Plazas</span>
              <span className="detail-info-value">{match.listaParticipantes?.length || 0}/{match.plazas}</span>
            </div>
          </div>
        </div>

        <div className="detail-players-card card">
          <div className="detail-section-title">Jugadores</div>
          <div className="detail-team-container">
            {Array.from({ length: half }).map((_, index) => renderSlot(index))}
            <div className="detail-team-letter">A</div>
          </div>
          <div className="detail-vs-divider">
            <div className="detail-vs-line"></div>
            <span>VS</span>
            <div className="detail-vs-line"></div>
          </div>
          <div className="detail-team-container">
            {Array.from({ length: max - half }).map((_, index) => renderSlot(half + index))}
            <div className="detail-team-letter">B</div>
          </div>
        </div>
      </div>

      {showDeleteModal && (
        <div className="modal-overlay modal-center">
          <div className="modal-card detail-confirm-card">
            <Trash2 size={48} color={colors.danger} />
            <h3>Borrar Partido?</h3>
            <p>Esta accion no se puede deshacer y las plazas volaran.</p>
            <div className="detail-modal-actions">
              <button className="btn btn-outline" onClick={() => setShowDeleteModal(false)}>Cancelar</button>
              <button className="btn btn-danger" onClick={executeDelete}>Borrar</button>
            </div>
          </div>
        </div>
      )}

      {kickTarget && (
        <div className="modal-overlay modal-center">
          <div className="modal-card detail-confirm-card">
            <h3>Expulsar a {kickTarget.nombreApellidos}?</h3>
            <p>Tendra que volver a unirse manualmente si asi lo deseas o si la plaza queda abierta.</p>
            <div className="detail-modal-actions">
              <button className="btn btn-outline" onClick={() => setKickTarget(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={executeKick}>Expulsar</button>
            </div>
          </div>
        </div>
      )}

      {adminUserModalVisible && (
        <div className="modal-overlay">
          <div className="modal-sheet detail-admin-picker">
            <div className="detail-admin-picker-header">
              <h3>Anadir Jugador</h3>
              <button onClick={() => setAdminUserModalVisible(false)}><X size={28} color={colors.textDim} /></button>
            </div>
            <div className="scroll-area detail-admin-picker-list">
              {allUsers.filter((entry) => !(match.listaParticipantes || []).includes(entry.uid)).map((entry) => (
                <button key={entry.uid} className="detail-admin-user-row" onClick={() => addPlayerAsAdmin(entry)}>
                  {entry.fotoURL ? (
                    <img src={entry.fotoURL} className="detail-admin-user-avatar" alt={entry.nombreApellidos} />
                  ) : (
                    <div className="detail-admin-user-avatar detail-admin-user-avatar-placeholder">{entry.nombreApellidos?.charAt(0)}</div>
                  )}
                  <span>{entry.nombreApellidos}</span>
                </button>
              ))}
              {allUsers.length === 0 && <div className="centered-loader"><div className="spinner" style={{ borderTopColor: primaryColor }}></div></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
