import { useEffect, useMemo, useRef, useState } from 'react';
import { addDoc, collection, doc, getDoc, getDocs, updateDoc } from 'firebase/firestore';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Globe, User, Users, UserPlus, X } from 'lucide-react';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LanguageContext';
import WeatherIcon from '../components/WeatherIcon';
import { useCourtWeather } from '../hooks/useCourtWeather';
import { getHourlyFocusIndex, getWeatherForIsoDate } from '../services/weather';
import { sendConfiguredPushNotification } from '../services/PushService';
import { appendMatchHistory, createMatchHistoryEntry } from '../services/matchHistory';
import { getReservationAvailability, type AvailabilityState, type MatchReservation } from '../services/matchScheduling';
import './CreateMatch.css';

const dayNames = {
  es: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  gl: ['Domingo', 'Luns', 'Martes', 'Mércores', 'Xoves', 'Venres', 'Sábado'],
} as const;

const formatDDMM = (date: Date) => {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
};

const formatHHMM = (date: Date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildDateFromDDMM = (dateString?: string | null) => {
  const base = new Date();
  if (!dateString) return base;
  const [day, month] = dateString.split('/').map(Number);
  if (!day || !month) return base;
  const parsedDate = new Date();
  parsedDate.setDate(day);
  parsedDate.setMonth(month - 1);
  return parsedDate;
};

const getMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const normalizeTournamentReservations = (tournamentData: any) => {
  const reservations: MatchReservation[] = [];

  const pushTournamentReservation = (entry: any, prefix: string) => {
    if (!entry || (entry.status !== 'scheduled' && entry.status !== 'confirmed') || !entry.date) return;
    const [datePart, timePart] = entry.date.split(' ');
    if (!datePart || !timePart) return;
    reservations.push({
      id: `${prefix}-${entry.id || entry.matchId || entry.date}`,
      date: datePart.substring(0, 5),
      time: timePart,
      source: 'tournament',
    });
  };

  (tournamentData?.schedule || []).forEach((entry: any) => pushTournamentReservation(entry, 'schedule'));
  (tournamentData?.bracket?.quarterfinals || []).forEach((entry: any) => pushTournamentReservation(entry, 'quarter'));
  (tournamentData?.bracket?.semifinals || []).forEach((entry: any) => pushTournamentReservation(entry, 'semi'));

  if (Array.isArray(tournamentData?.bracket?.final)) {
    tournamentData.bracket.final.forEach((entry: any) => pushTournamentReservation(entry, 'final'));
  } else {
    pushTournamentReservation(tournamentData?.bracket?.final, 'final');
  }

  return reservations;
};

const trimTrailingEmptySlots = <T,>(entries: Array<T | null | undefined>) => {
  const next = [...entries];
  while (next.length > 0 && !next[next.length - 1]) {
    next.pop();
  }
  return next;
};

export default function CreateMatchPage() {
  const [searchParams] = useSearchParams();
  const matchId = searchParams.get('matchId') || searchParams.get('edit');
  const initialDateStr = searchParams.get('initialDateStr');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { primaryColor, colors } = useTheme();
  const { t, language } = useTranslation();
  const { forecast, loading: weatherLoading, error: weatherError } = useCourtWeather();

  const [dateValue, setDateValue] = useState(() => toDateInputValue(buildDateFromDDMM(initialDateStr)));
  const [timeValue, setTimeValue] = useState('17:00');
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<string>>(new Set());
  const [inviteAll, setInviteAll] = useState(true);
  const [preParticipants, setPreParticipants] = useState<any[]>([null, null, null, null]);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [existingMatchMeta, setExistingMatchMeta] = useState<{
    creadorId?: string;
    creadorNombre?: string;
    fechaCreacion?: string;
  } | null>(null);
  const [existingMatchData, setExistingMatchData] = useState<any | null>(null);
  const [reservations, setReservations] = useState<MatchReservation[]>([]);

  const hourlyItemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const initData = async () => {
      try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const fetchedUsers = usersSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
        setUsers(fetchedUsers);

        const matchesSnapshot = await getDocs(collection(db, 'matches'));
        const matchReservations = matchesSnapshot.docs.map((entry) => {
          const data = entry.data() as any;
          return {
            id: entry.id,
            date: data.fecha,
            time: data.hora,
            source: 'match' as const,
          };
        }).filter((entry) => entry.date && entry.time);

        const tournamentSnapshot = await getDoc(doc(db, 'tournament', 'currentTournament'));
        const tournamentReservations = tournamentSnapshot.exists()
          ? normalizeTournamentReservations(tournamentSnapshot.data())
          : [];
        setReservations([...matchReservations, ...tournamentReservations]);

        if (isAdmin) {
          const groupsSnapshot = await getDocs(collection(db, 'groups'));
          setGroups(groupsSnapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
        }

        if (matchId) {
          const matchSnapshot = await getDoc(doc(db, 'matches', matchId));
          if (matchSnapshot.exists()) {
            const matchData = matchSnapshot.data();
            setExistingMatchData(matchData);
            setExistingMatchMeta({
              creadorId: matchData.creadorId,
              creadorNombre: matchData.creadorNombre,
              fechaCreacion: matchData.fechaCreacion,
            });

            if (!isAdmin && matchData.creadorId !== user?.uid) {
              window.alert('Aviso\n\nSolo el creador del partido o un administrador pueden editarlo.');
              navigate(-1);
              return;
            }

            const [day, month] = (matchData.fecha || '01/01').split('/');
            const parsedDate = new Date();
            parsedDate.setDate(Number(day));
            parsedDate.setMonth(Number(month) - 1);
            setDateValue(toDateInputValue(parsedDate));
            setTimeValue(matchData.hora || '17:00');

            if ((matchData.listaInvitados || []).length === fetchedUsers.length) {
              setInviteAll(true);
            } else {
              setInviteAll(false);
              setSelectedUserIds(new Set(matchData.listaInvitados || []));
            }

            const newParticipants: Array<any | null> = [null, null, null, null];
            (matchData.listaParticipantes || []).forEach((uid: string | null, index: number) => {
              if (index < 4) {
                newParticipants[index] = uid ? fetchedUsers.find((entry) => entry.id === uid) || null : null;
              }
            });
            setPreParticipants(newParticipants);
          }
        }
      } finally {
        setLoadingData(false);
      }
    };

    initData();
  }, [isAdmin, matchId, navigate, user?.uid]);

  const dateObject = useMemo(() => new Date(`${dateValue}T${timeValue}`), [dateValue, timeValue]);
  const weatherForSelectedDay = useMemo(() => getWeatherForIsoDate(forecast, dateValue), [forecast, dateValue]);
  const selectedHourlyIndex = useMemo(
    () => getHourlyFocusIndex(weatherForSelectedDay.hourly, timeValue),
    [weatherForSelectedDay.hourly, timeValue],
  );
  const highlightedHour = weatherForSelectedDay.hourly[selectedHourlyIndex] || null;
  const selectedDateLabel = useMemo(() => formatDDMM(dateObject), [dateObject]);
  const availabilityByHour = useMemo(() => (
    Object.fromEntries(
      weatherForSelectedDay.hourly.map((entry) => [
        entry.isoTime,
        getReservationAvailability(selectedDateLabel, entry.hour, reservations, matchId),
      ]),
    ) as Record<string, AvailabilityState>
  ), [matchId, reservations, selectedDateLabel, weatherForSelectedDay.hourly]);
  const selectedAvailability = useMemo(
    () => getReservationAvailability(selectedDateLabel, timeValue, reservations, matchId),
    [matchId, reservations, selectedDateLabel, timeValue],
  );

  useEffect(() => {
    const focusedHourly = weatherForSelectedDay.hourly[selectedHourlyIndex];
    if (!focusedHourly) return;

    const frame = window.requestAnimationFrame(() => {
      hourlyItemRefs.current[focusedHourly.isoTime]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [selectedHourlyIndex, weatherForSelectedDay.hourly]);

  const saveMatch = async () => {
    if (!user) return;

    if (matchId && !isAdmin && existingMatchMeta?.creadorId !== user.uid) {
      window.alert('Aviso\n\nSolo el creador del partido o un administrador pueden editarlo.');
      navigate(-1);
      return;
    }

    const finalFecha = formatDDMM(dateObject);
    const finalHora = timeValue;
    const finalInvitados = new Set<string>();

    if (inviteAll) {
      users.forEach((entry) => finalInvitados.add(entry.id));
    } else {
      selectedUserIds.forEach((uid) => finalInvitados.add(uid));
      selectedGroupIds.forEach((groupId) => {
        const group = groups.find((entry) => entry.id === groupId);
        group?.userIds?.forEach((uid: string) => finalInvitados.add(uid));
      });
    }

    const physicalParticipants = trimTrailingEmptySlots(preParticipants.map((entry) => (entry ? entry.id : null)));

    setLoading(true);
    try {
      const matchesSnapshot = await getDocs(collection(db, 'matches'));
      let hasCollision = false;
      const newStartMin = getMinutes(finalHora);
      const newEndMin = newStartMin + 90;

      matchesSnapshot.docs.forEach((entry) => {
        const data = { id: entry.id, ...entry.data() } as any;
        if (data.fecha !== finalFecha) return;
        if (matchId && data.id === matchId) return;

        const existingStart = getMinutes(data.hora || '00:00');
        const existingEnd = existingStart + 90;
        if (newStartMin < existingEnd && newEndMin > existingStart) {
          hasCollision = true;
        }
      });

      if (!hasCollision) {
        const tournamentSnapshot = await getDoc(doc(db, 'tournament', 'currentTournament'));
        if (tournamentSnapshot.exists()) {
          const tournamentData = tournamentSnapshot.data();
          const checkTournamentMatch = (match: any) => {
            if ((match.status === 'scheduled' || match.status === 'confirmed') && match.date) {
              const [matchDate, matchTime] = match.date.split(' ');
              if (matchDate.substring(0, 5) !== finalFecha) return;
              const existingStart = getMinutes(matchTime);
              const existingEnd = existingStart + 90;
              if (newStartMin < existingEnd && newEndMin > existingStart) {
                hasCollision = true;
              }
            }
          };

          (tournamentData.schedule || []).forEach(checkTournamentMatch);
          if (tournamentData.bracket) {
            (tournamentData.bracket.quarterfinals || []).forEach(checkTournamentMatch);
            (tournamentData.bracket.semifinals || []).forEach(checkTournamentMatch);
            if (tournamentData.bracket.final) checkTournamentMatch(tournamentData.bracket.final);
          }
        }
      }

      if (hasCollision) {
        window.alert(`${t('court_busy')}\n\n${t('court_busy_msg')}`);
        return;
      }

      const payload = {
        titulo: 'PÁDEL',
        fecha: finalFecha,
        hora: finalHora,
        ubicacion: 'Sabardes',
        plazas: 4,
        creadorId: existingMatchMeta?.creadorId || user.uid,
        creadorNombre: existingMatchMeta?.creadorNombre || user.nombreApellidos,
        listaParticipantes: physicalParticipants,
        listaInvitados: Array.from(finalInvitados),
        estado: 'abierto',
      };

      let savedMatchId = matchId;
      if (matchId) {
        await updateDoc(doc(db, 'matches', matchId), {
          ...payload,
          ...(existingMatchMeta?.fechaCreacion ? { fechaCreacion: existingMatchMeta.fechaCreacion } : {}),
        });
      } else {
        const createdRef = await addDoc(collection(db, 'matches'), { ...payload, fechaCreacion: new Date().toISOString() });
        savedMatchId = createdRef.id;
      }

      if (savedMatchId) {
        const historyEntry = !matchId
          ? createMatchHistoryEntry('created', {
              actorName: user.nombreApellidos,
              actorUid: user.uid,
            })
          : (existingMatchData?.fecha !== finalFecha || existingMatchData?.hora !== finalHora || existingMatchData?.ubicacion !== payload.ubicacion)
            ? createMatchHistoryEntry('schedule_changed', {
                actorName: user.nombreApellidos,
                actorUid: user.uid,
                matchDate: finalFecha,
                matchTime: finalHora,
              })
            : createMatchHistoryEntry('updated', {
                actorName: user.nombreApellidos,
                actorUid: user.uid,
              });

        void appendMatchHistory(savedMatchId, historyEntry).catch((error) => {
          console.error('Error guardando historial del partido:', error);
        });
      }

      const usersToNotify = new Set([
        ...Array.from(finalInvitados),
        ...physicalParticipants.filter((uid): uid is string => typeof uid === 'string' && uid.length > 0),
      ]);
      if (user?.uid) usersToNotify.delete(user.uid);

      if (matchId) {
        const changeBody = `O partido do ${finalFecha} ás ${finalHora} actualizouse.`;
        await sendConfiguredPushNotification(
          Array.from(usersToNotify),
          'changes',
          'Cambios no teu partido',
          changeBody,
          {
            matchDate: finalFecha,
            matchTime: finalHora,
            location: 'Sabardes',
          },
        );
      } else {
        const inviteBody = `Podes xogar o ${finalFecha} ás ${finalHora}.`;
        await sendConfiguredPushNotification(
          Array.from(usersToNotify),
          'invitations',
          '🎾 ¡Nova Changa!',
          inviteBody,
          {
            matchDate: finalFecha,
            matchTime: finalHora,
            location: 'Sabardes',
          },
        );
      }

      window.alert(`${t('success')}\n\n${matchId ? t('match_updated') : t('match_created')}`);
      navigate(-1);
    } catch (error: any) {
      window.alert(`${t('error')}\n\n${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const openUserModal = (slotIndex: number) => {
    if (preParticipants[slotIndex]) {
      const next = [...preParticipants];
      next[slotIndex] = null;
      setPreParticipants(next);
      return;
    }

    setActiveSlot(slotIndex);
    setUserModalOpen(true);
  };

  const selectUserForSlot = (selectedUser: any) => {
    if (activeSlot === null) return;
    const next = [...preParticipants];
    next[activeSlot] = selectedUser;
    setPreParticipants(next);
    setUserModalOpen(false);
  };

  const toggleSelection = (id: string, isGroup: boolean) => {
    if (inviteAll) setInviteAll(false);
    if (isGroup) {
      setSelectedGroupIds((previous) => {
        const next = new Set(previous);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      return;
    }

    setSelectedUserIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setInviteAll((previous) => {
      const next = !previous;
      if (next) {
        setSelectedUserIds(new Set());
        setSelectedGroupIds(new Set());
      }
      return next;
    });
  };

  const renderSlot = (participant: any, absoluteIndex: number) => {
    if (participant) {
      return (
        <div className="create-match-slot-player" key={`slot-${absoluteIndex}`}>
          <button className="create-match-slot-avatar-wrap" onClick={() => openUserModal(absoluteIndex)}>
            {participant.fotoURL ? (
              <img src={participant.fotoURL} className="create-match-slot-avatar" alt={participant.nombreApellidos} />
            ) : (
              <div className="create-match-slot-avatar create-match-slot-avatar-placeholder">
                {participant.nombreApellidos?.charAt(0)?.toUpperCase()}
              </div>
            )}
          </button>
          <span className="create-match-slot-name">{participant.nombreApellidos?.split(' ')[0]}</span>
        </div>
      );
    }

    return (
      <div className="create-match-slot-player" key={`slot-${absoluteIndex}`}>
        <button className="create-match-slot-empty" style={{ borderColor: primaryColor }} onClick={() => openUserModal(absoluteIndex)}>
          <UserPlus size={28} color={primaryColor} />
        </button>
        <span className="create-match-slot-empty-text" style={{ color: primaryColor }}></span>
      </div>
    );
  };

  const renderSelectionItem = (entry: any, isGroup: boolean) => {
    const isSelected = isGroup ? selectedGroupIds.has(entry.id) : selectedUserIds.has(entry.id);
    return (
      <button
        key={entry.id}
        className={`create-match-selection-card ${isSelected && !inviteAll ? 'is-selected' : ''}`}
        onClick={() => toggleSelection(entry.id, isGroup)}
        type="button"
      >
        <div className="create-match-selection-info">
          <div className="create-match-selection-icon" style={{ backgroundColor: colors.background }}>
            {isGroup ? <Users size={20} color={colors.textDim} /> : <User size={20} color={colors.textDim} />}
          </div>
          <span className="create-match-selection-name">{isGroup ? entry.name : entry.nombreApellidos}</span>
        </div>
        <CheckCircle2 size={28} color={isSelected && !inviteAll ? primaryColor : colors.border} style={!isSelected || inviteAll ? { opacity: 0.4 } : undefined} />
      </button>
    );
  };

  const getAvailabilityColor = (availability: AvailabilityState) => {
    if (availability === 'busy') return colors.danger;
    if (availability === 'near') return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="create-match-page">
      <div className="create-match-header">
        <button className="create-match-round-button" onClick={() => navigate(-1)}>
          <X size={28} color={colors.text} />
        </button>
        <div className="create-match-header-spacer"></div>
        <button className="create-match-save-button" style={{ backgroundColor: primaryColor }} onClick={saveMatch} disabled={loading || loadingData}>
          {loading ? 'Guardando...' : matchId ? t('save_changes') : t('create_match')}
        </button>
      </div>

      <div className="scroll-area" style={{ padding: 16, paddingBottom: 56 }}>
        <div className="create-match-row">
          <div className="create-match-half-input">
            <label className="create-match-label">{t('date')}</label>
            <div className="create-match-picker-box">
              <input className="create-match-native-input" type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} />
            </div>
          </div>
          <div className="create-match-half-input">
            <label className="create-match-label">{t('time')}</label>
            <div className="create-match-picker-box">
              <input className="create-match-native-input" type="time" value={timeValue} onChange={(event) => setTimeValue(event.target.value)} />
            </div>
          </div>
        </div>

        <div className="create-match-section-card create-match-weather-card">
          <div className="create-match-weather-head">
            <div>
              <div className="create-match-section-title">{t('weather_forecast')}</div>
              <div className="create-match-weather-caption">{t('weather_match_hour')} · {timeValue}</div>
              <div className="create-match-weather-caption create-match-weather-caption-availability">
                {t('availability_legend')} · <span style={{ color: getAvailabilityColor(selectedAvailability) }}>{t(`availability_${selectedAvailability}` as any)}</span>
              </div>
            </div>
            {highlightedHour && (
              <div className="create-match-weather-summary" style={{ borderColor: `${primaryColor}33` }}>
                <WeatherIcon kind={highlightedHour.visualKind} isDay={highlightedHour.isDay} size={24} color={primaryColor} />
                <div className="create-match-weather-summary-copy">
                  <span className="create-match-weather-summary-temp">{highlightedHour.temperature ?? '--'}°C</span>
                  <span className="create-match-weather-summary-desc">{t(highlightedHour.labelKey)}</span>
                </div>
              </div>
            )}
          </div>

          {weatherLoading ? (
            <p className="create-match-weather-empty">{t('weather_loading')}</p>
          ) : weatherError ? (
            <p className="create-match-weather-empty">{t('weather_error')}</p>
          ) : weatherForSelectedDay.hourly.length === 0 ? (
            <p className="create-match-weather-empty">{t('weather_unavailable')}</p>
          ) : (
            <div className="create-match-hourly-scroll">
              {weatherForSelectedDay.hourly.map((entry, index) => {
                const isSelected = index === selectedHourlyIndex;
                const availability = availabilityByHour[entry.isoTime] || 'free';
                return (
                  <div
                    key={entry.isoTime}
                    ref={(node) => { hourlyItemRefs.current[entry.isoTime] = node; }}
                    className={`create-match-hourly-card ${isSelected ? 'is-selected' : ''}`}
                    style={{
                      borderColor: isSelected ? `${primaryColor}aa` : `${getAvailabilityColor(availability)}55`,
                      boxShadow: isSelected
                        ? `0 0 0 1px ${primaryColor}55 inset, 0 0 18px ${primaryColor}25`
                        : undefined,
                    }}
                  >
                    <span className="create-match-hourly-time">{entry.hour}</span>
                    <WeatherIcon kind={entry.visualKind} isDay={entry.isDay} size={28} color={isSelected ? primaryColor : colors.textDim} />
                    <span className="create-match-hourly-temp">{entry.temperature ?? '--'}°C</span>
                    <span className={`create-match-hourly-status availability-${availability}`} style={{ color: getAvailabilityColor(availability) }}>
                      {t(`availability_${availability}` as any)}
                    </span>
                    {isSelected && <span className="create-match-hourly-tag">{t('weather_selected_hour')}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="create-match-section-card">
          <div className="create-match-section-title">{t('players')}</div>
          <div className="create-match-team-row">
            <div className="create-match-team-letter">A</div>
            {preParticipants.slice(0, 2).map((participant, index) => renderSlot(participant, index))}
            <div className="create-match-vertical-divider"></div>
            {preParticipants.slice(2, 4).map((participant, index) => renderSlot(participant, index + 2))}
            <div className="create-match-team-letter create-match-team-letter-right">B</div>
          </div>
        </div>

        <div className="create-match-section-card">
          <div className="create-match-section-title">{t('invitations')}</div>

          <button
            className={`create-match-selection-card ${inviteAll ? 'is-selected' : ''}`}
            onClick={toggleAll}
            type="button"
          >
            <div className="create-match-selection-info">
              <div className="create-match-selection-icon" style={{ backgroundColor: colors.background }}>
                <Globe size={20} color={colors.textDim} />
              </div>
              <span className="create-match-selection-name">{t('everyone_global')}</span>
            </div>
            <CheckCircle2 size={28} color={inviteAll ? primaryColor : colors.border} style={!inviteAll ? { opacity: 0.4 } : undefined} />
          </button>

          {isAdmin && (
            <>
              <div className="create-match-sub-label">{t('fast_groups')}</div>
              {groups.length === 0 ? (
                <p className="create-match-empty-text">{t('no_groups')}</p>
              ) : (
                groups.map((entry) => renderSelectionItem(entry, true))
              )}
            </>
          )}

          <div className="create-match-sub-label">{t('individuals')}</div>
          {users.map((entry) => renderSelectionItem(entry, false))}
        </div>

        <div className="create-match-preview-note">
          {dayNames[language][dateObject.getDay()]} {formatDDMM(dateObject)} · {formatHHMM(dateObject)}
        </div>
      </div>

      {userModalOpen && (
        <div className="modal-overlay" onClick={() => setUserModalOpen(false)}>
          <div className="modal-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="modal-handle"></div>
            <h3 className="create-match-modal-title">{t('assign_player')}</h3>
            <div className="create-match-user-list">
              {users
                .filter((entry) => !preParticipants.some((participant) => participant?.id === entry.id))
                .map((entry) => (
                  <button key={entry.id} className="create-match-user-row" onClick={() => selectUserForSlot(entry)}>
                    {entry.fotoURL ? (
                      <img src={entry.fotoURL} className="create-match-user-avatar" alt={entry.nombreApellidos} />
                    ) : (
                      <div className="create-match-user-avatar create-match-user-avatar-placeholder">
                        {entry.nombreApellidos?.charAt(0) || '?'}
                      </div>
                    )}
                    <span>{entry.nombreApellidos}</span>
                  </button>
                ))}
            </div>
            <button className="btn btn-danger full" onClick={() => setUserModalOpen(false)}>{t('cancel')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
