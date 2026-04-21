import { useEffect, useState, type CSSProperties } from 'react';
import { arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, updateDoc } from 'firebase/firestore';
import { ArrowLeft, Pencil, Plus, Trash2, Trophy, UserPlus, X } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LanguageContext';
import AvatarPreviewModal from '../components/AvatarPreviewModal';
import { sendConfiguredPushNotification } from '../services/PushService';
import './MatchDetail.css';

const LONG_DAY_NAMES = {
  es: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  gl: ['Domingo', 'Luns', 'Martes', 'Mércores', 'Xoves', 'Venres', 'Sábado'],
} as const;

const LONG_MONTH_NAMES = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  gl: ['xaneiro', 'febreiro', 'marzo', 'abril', 'maio', 'xuño', 'xullo', 'agosto', 'setembro', 'outubro', 'novembro', 'decembro'],
} as const;

const parseMatchDateTime = (dateString?: string, timeString?: string) => {
  const [day, month] = (dateString || '01/01').split('/').map((entry) => parseInt(entry || '1', 10));
  const [hours, minutes] = (timeString || '00:00').split(':').map((entry) => parseInt(entry || '0', 10));
  const result = new Date();
  const matchMonth = (month || 1) - 1;

  result.setHours(hours || 0, minutes || 0, 0, 0);
  if (matchMonth < result.getMonth() - 2) {
    result.setFullYear(result.getFullYear() + 1);
  }
  result.setMonth(matchMonth);
  result.setDate(day || 1);
  return result;
};

const hexToRgbString = (value: string) => {
  const normalized = value.replace('#', '');
  const hex = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized;

  if (hex.length !== 6) return '14, 165, 233';

  const numeric = Number.parseInt(hex, 16);
  if (Number.isNaN(numeric)) return '14, 165, 233';

  return `${(numeric >> 16) & 255}, ${(numeric >> 8) & 255}, ${numeric & 255}`;
};

export default function MatchDetailPage() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { primaryColor, colors } = useTheme();
  const { t, language } = useTranslation();

  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [participantsData, setParticipantsData] = useState<any[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [kickTarget, setKickTarget] = useState<any>(null);
  const [adminUserModalVisible, setAdminUserModalVisible] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [avatarPreview, setAvatarPreview] = useState<{ imageUrl: string; alt: string } | null>(null);

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

  const getAudienceForMatchUpdates = (excludedUid?: string) => {
    const recipients = new Set<string>(match?.listaParticipantes || []);

    if (match?.creadorId) {
      recipients.add(match.creadorId);
    }

    if (excludedUid) {
      recipients.delete(excludedUid);
    }

    return Array.from(recipients);
  };

  const handleJoin = async () => {
    if (!match || !user || !matchId) return;
    if (match.listaParticipantes?.length >= match.plazas) {
      window.alert('Aviso\n\nEl partido ya esta completo');
      return;
    }

    await updateDoc(doc(db, 'matches', matchId), { listaParticipantes: arrayUnion(user.uid) });
    const others = getAudienceForMatchUpdates(user.uid);
    const body = `${user.nombreApellidos} se ha unido al partido del ${match.fecha}.`;
    await sendConfiguredPushNotification(others, 'joins', 'PADEL Sabardes', body, {
      actorName: user.nombreApellidos,
      matchDate: match.fecha,
      matchTime: match.hora,
      location: match.ubicacion,
    });
  };

  const handleLeave = async () => {
    if (!match || !user || !matchId) return;
    await updateDoc(doc(db, 'matches', matchId), { listaParticipantes: arrayRemove(user.uid) });
    const others = getAudienceForMatchUpdates(user.uid);
    const body = `${user.nombreApellidos} se ha dado de baja del partido del ${match.fecha}.`;
    await sendConfiguredPushNotification(others, 'leaves', 'PADEL Sabardes', body, {
      actorName: user.nombreApellidos,
      matchDate: match.fecha,
      matchTime: match.hora,
      location: match.ubicacion,
    });
  };

  const executeKick = async () => {
    if (!match || !kickTarget || !matchId) return;
    await updateDoc(doc(db, 'matches', matchId), { listaParticipantes: arrayRemove(kickTarget.uid) });
    const body = `El administrador te ha expulsado del partido del ${match.fecha}.`;
    await sendConfiguredPushNotification([kickTarget.uid], 'leaves', 'PADEL Sabardes', body, {
      targetName: kickTarget.nombreApellidos,
      matchDate: match.fecha,
      matchTime: match.hora,
      location: match.ubicacion,
    });
    setKickTarget(null);
  };

  const executeDelete = async () => {
    if (!matchId || !(user?.role === 'admin' || match?.creadorId === user?.uid)) return;
    const others = (match?.listaParticipantes || []).filter((id: string) => id !== user?.uid);
    await deleteDoc(doc(db, 'matches', matchId));
    const body = `El partido del ${match?.fecha} ha sido cancelado.`;
    await sendConfiguredPushNotification(others, 'cancellations', 'Partido Cancelado', body, {
      matchDate: match?.fecha,
      matchTime: match?.hora,
      location: match?.ubicacion,
    });
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
    const others = getAudienceForMatchUpdates(entry.uid);
    const body = `El admin ha anadido a ${entry.nombreApellidos} al partido del ${match.fecha}.`;
    await sendConfiguredPushNotification(others, 'joins', 'PADEL Sabardes', body, {
      targetName: entry.nombreApellidos,
      matchDate: match.fecha,
      matchTime: match.hora,
      location: match.ubicacion,
    });
  };

  const isTournament = !!match?.isTournament;
  const accentColor = isTournament ? '#D4A017' : primaryColor;
  const accentRgb = hexToRgbString(accentColor);
  const detailPageStyle = {
    '--detail-accent': accentColor,
    '--detail-accent-rgb': accentRgb,
  } as CSSProperties;
  const max = match?.plazas || 4;
  const half = Math.ceil(max / 2);
  const occupiedSpots = match?.listaParticipantes?.length || 0;
  const availableSpots = Math.max(0, max - occupiedSpots);
  const verboseDate = match
    ? (() => {
        const date = parseMatchDateTime(match.fecha, match.hora);
        return `${LONG_DAY_NAMES[language][date.getDay()]}, ${date.getDate()} de ${LONG_MONTH_NAMES[language][date.getMonth()]} · ${match.hora}`;
      })()
    : '';
  const teamLabels = language === 'gl'
    ? { a: 'Parella A', b: 'Parella B', tap: 'Tocar', versus: 'contra', spots: 'Prazas' }
    : { a: 'Equipo A', b: 'Equipo B', tap: 'Tocar', versus: 'contra', spots: 'Plazas' };
  const matchKindLabel = isTournament ? 'TORNEO · SABARDES' : 'PÁDEL · SABARDES';
  const occupancyLabel = availableSpots === 0
    ? (language === 'gl' ? 'Sen prazas libres' : 'Sin plazas libres')
    : `${availableSpots} ${t('free_spots').toLowerCase()}`;

  if (loading || !match) {
    return <div className="centered-loader"><div className="spinner" style={{ borderTopColor: primaryColor }}></div></div>;
  }

  const isParticipant = match.listaParticipantes?.includes(user?.uid);
  const canManageMatch = user?.role === 'admin' || match.creadorId === user?.uid;

  const renderSlot = (index: number) => {
    const participant = participantsData[index];

    if (participant) {
      const isMe = participant.uid === user?.uid;
      return (
        <div className="detail-slot-player" key={`slot-${index}`}>
          <div className="detail-slot-avatar-wrap">
            {participant.fotoURL ? (
              <button
                type="button"
                className="detail-slot-avatar-button"
                onClick={() => setAvatarPreview({ imageUrl: participant.fotoURL, alt: participant.nombreApellidos })}
              >
                <img src={participant.fotoURL} className="detail-slot-avatar" alt={participant.nombreApellidos} />
              </button>
            ) : (
              <div className="detail-slot-avatar detail-slot-avatar-placeholder">{participant.nombreApellidos?.charAt(0)?.toUpperCase()}</div>
            )}
            {(isMe || user?.role === 'admin') && (
              <button className="detail-leave-badge" onClick={(event) => {
                event.stopPropagation();
                if (isMe) handleLeave();
                else setKickTarget(participant);
              }}>
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
        {(!isParticipant || user?.role === 'admin') && <span className="detail-slot-empty-text" style={{ color: accentColor }}>{teamLabels.tap}</span>}
      </div>
    );
  };

  return (
    <div className="detail-page" style={detailPageStyle}>
      <div className="detail-hero">
        <div className="detail-top-nav">
          <button className="detail-round-button translucent" onClick={() => navigate(-1)}>
            <ArrowLeft size={24} color="#fff" />
          </button>
          {canManageMatch && (
            <div className="detail-top-actions">
              <button className="detail-round-button solid" onClick={() => navigate(`/create-match?matchId=${matchId}`)} aria-label={t('edit_match')}>
                <Pencil size={20} color={accentColor} />
              </button>
              <button className="detail-round-button danger" onClick={() => setShowDeleteModal(true)} aria-label={t('delete_match')}>
                <Trash2 size={20} color="#fff" />
              </button>
            </div>
          )}
        </div>

        <div className="detail-hero-card">
          <div className="detail-scene-shadow"></div>
          <div className="detail-scene-platform"></div>
          <div className="detail-scene-court">
            <span className="detail-scene-corner detail-scene-corner-a"></span>
            <span className="detail-scene-corner detail-scene-corner-b"></span>
            <span className="detail-scene-corner detail-scene-corner-c"></span>
            <span className="detail-scene-corner detail-scene-corner-d"></span>
            <span className="detail-scene-line detail-scene-line-h"></span>
            <span className="detail-scene-line detail-scene-line-v"></span>
            <span className="detail-scene-line detail-scene-line-mid"></span>
            <span className="detail-scene-net"></span>
            <span className="detail-scene-player detail-scene-player-1"></span>
            <span className="detail-scene-player detail-scene-player-2"></span>
            <span className="detail-scene-player detail-scene-player-3"></span>
            <span className="detail-scene-player detail-scene-player-4"></span>
            <span className="detail-scene-ball"></span>
          </div>
        </div>
      </div>

      <div className="detail-scroll scroll-area">
        <div className="detail-main-card card">
          <div className="detail-main-card-header">
            <div className="detail-main-card-copy">
              <span className="detail-info-label">{t('location')}</span>
              <div className="detail-main-title-row">
                {isTournament ? <Trophy size={22} color="#D4A017" /> : <span className="detail-ball-icon">●</span>}
                <div className="detail-main-title">{matchKindLabel}</div>
              </div>
              <div className="detail-main-subtitle">{verboseDate}</div>
            </div>
            <div className="detail-summary-side">
              <div className="detail-summary-chip">
                <span className="detail-summary-chip-value">{occupiedSpots}/{max}</span>
                <span className="detail-summary-chip-label">{teamLabels.spots}</span>
              </div>
              <div className="detail-summary-caption">{occupancyLabel}</div>
            </div>
          </div>
          <div className="detail-info-grid">
            <div className="detail-info-block">
              <span className="detail-info-value">{match.ubicacion}</span>
            </div>
            <div className="detail-info-block detail-info-block-end">
              <span className="detail-info-label">{t('date')} · {t('time')}</span>
              <span className="detail-info-value">{match.fecha} · {match.hora}</span>
            </div>
          </div>
        </div>

        <div className="detail-players-card card">
          <div className="detail-section-title">{t('players')}</div>
          <div className="detail-board-shell">
            <div className="detail-board-team-tag detail-board-team-tag-a">{teamLabels.a}</div>
            <div className="detail-board-team-tag detail-board-team-tag-b">{teamLabels.b}</div>

            <div className="detail-board-grid">
              <div className="detail-board-cell detail-board-cell-1">{renderSlot(0)}</div>
              <div className="detail-board-cell detail-board-cell-2">{renderSlot(1)}</div>
              <div className="detail-board-cell detail-board-cell-3">{renderSlot(half)}</div>
              <div className="detail-board-cell detail-board-cell-4">{renderSlot(half + 1)}</div>
            </div>

            <div className="detail-board-versus" aria-hidden="true">
              <div className="detail-board-versus-ring">
                <span>{teamLabels.versus}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {avatarPreview && (
        <AvatarPreviewModal
          imageUrl={avatarPreview.imageUrl}
          alt={avatarPreview.alt}
          onClose={() => setAvatarPreview(null)}
        />
      )}

      {showDeleteModal && (
        <div className="modal-overlay modal-center">
          <div className="modal-card detail-confirm-card">
            <Trash2 size={48} color={colors.danger} />
            <h3>{t('delete_match_confirm')}</h3>
            <p>{t('delete_match_msg')}</p>
            <div className="detail-modal-actions">
              <button className="btn btn-outline" onClick={() => setShowDeleteModal(false)}>{t('cancel')}</button>
              <button className="btn btn-danger" onClick={executeDelete}>{t('delete')}</button>
            </div>
          </div>
        </div>
      )}

      {kickTarget && (
        <div className="modal-overlay modal-center">
          <div className="modal-card detail-confirm-card">
            <h3>{t('kick_player')} {kickTarget.nombreApellidos}?</h3>
            <p>{t('kick_msg')}</p>
            <div className="detail-modal-actions">
              <button className="btn btn-outline" onClick={() => setKickTarget(null)}>{t('cancel')}</button>
              <button className="btn btn-primary" onClick={executeKick}>{t('kick')}</button>
            </div>
          </div>
        </div>
      )}

      {adminUserModalVisible && (
        <div className="modal-overlay">
          <div className="modal-sheet detail-admin-picker">
            <div className="detail-admin-picker-header">
              <h3>{t('assign_player')}</h3>
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
