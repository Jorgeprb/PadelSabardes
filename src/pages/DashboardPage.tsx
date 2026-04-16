import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query } from 'firebase/firestore';
import { CalendarDays, ChevronRight, Plus, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LanguageContext';
import './Dashboard.css';

const daysString = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
const daysVerbose = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
const monthsString = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const monthsVerbose = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const parseDateStr = (fStr: string, hStr: string) => {
  const [d, mo] = (fStr || '01/01').split('/');
  const [h, mi] = (hStr || '00:00').split(':');
  const dt = new Date();
  dt.setHours(parseInt(h || '0', 10));
  dt.setMinutes(parseInt(mi || '0', 10));
  const matchMonth = parseInt(mo || '1', 10) - 1;
  if (matchMonth < dt.getMonth() - 2) dt.setFullYear(dt.getFullYear() + 1);
  dt.setMonth(matchMonth);
  dt.setDate(parseInt(d || '1', 10));
  return dt.getTime();
};

const formatDDMM = (date: Date) => `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;

const formatVerboseDate = (fStr: string, hStr: string) => {
  const ts = parseDateStr(fStr, hStr);
  const date = new Date(ts);
  return `${daysVerbose[date.getDay()]}, ${date.getDate()} de ${monthsVerbose[date.getMonth()]} · ${hStr}`;
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { primaryColor, colors, isCalendarView, openMatchCreation } = useTheme();
  const { t } = useTranslation();

  const [matches, setMatches] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDateFilter, setSelectedDateFilter] = useState(formatDDMM(new Date()));

  const weekDays = Array.from({ length: 14 }).map((_, index) => {
    const day = new Date();
    day.setDate(day.getDate() + index);
    return {
      format: formatDDMM(day),
      dayName: daysString[day.getDay()],
      dayNum: day.getDate(),
      monthName: monthsString[day.getMonth()],
    };
  });

  useEffect(() => {
    getDocs(collection(db, 'users')).then((snapshot) => {
      setUsers(snapshot.docs.map((userDoc) => ({ id: userDoc.id, ...userDoc.data() })));
    });

    const matchesQuery = query(collection(db, 'matches'), orderBy('fecha', 'desc'));
    const unsubscribe = onSnapshot(matchesQuery, (snapshot) => {
      const data = snapshot.docs.map((matchDoc) => ({ id: matchDoc.id, ...matchDoc.data() } as any));
      const now = Date.now();
      const validData: any[] = [];

      data.forEach((match) => {
        if (!match.fecha || !match.hora) return;
        if (now - parseDateStr(match.fecha, match.hora) > 3600000) {
          if (match.isTournament) {
            validData.push({ ...match, isPast: true });
          } else {
            deleteDoc(doc(db, 'matches', match.id)).catch(() => {});
          }
          return;
        }

        validData.push(match);
      });

      let filtered = validData;
      if (user?.role !== 'admin') {
        filtered = validData.filter((match) => (
          match.listaParticipantes?.includes(user?.uid)
          || match.listaInvitados?.includes(user?.uid)
          || match.creadorId === user?.uid
        ));
      }

      filtered.sort((a, b) => {
        const aIn = a.listaParticipantes?.includes(user?.uid) ? 0 : 1;
        const bIn = b.listaParticipantes?.includes(user?.uid) ? 0 : 1;
        if (aIn !== bIn) return aIn - bIn;
        return parseDateStr(a.fecha, a.hora) - parseDateStr(b.fecha, b.hora);
      });

      setMatches(filtered);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const renderCard = (item: any) => {
    const isParticipant = item.listaParticipantes?.includes(user?.uid);
    const isTournament = !!item.isTournament;
    const accentColor = isTournament ? '#D4A017' : primaryColor;
    const participants = (item.listaParticipantes || [])
      .map((uid: string) => users.find((entry) => entry.id === uid))
      .filter(Boolean);
    const isFull = participants.length >= 4;
    const freeSpots = 4 - participants.length;
    const teamA = participants.slice(0, 2);
    const teamB = participants.slice(2, 4);

    const AvatarCircle = ({ participant }: { participant: any }) => {
      const isMe = participant?.id === user?.uid;
      const shortName = isMe ? 'Yo' : participant?.nombreApellidos?.split(' ')[0] || '?';
      return (
        <div className="matches-avatar-stack">
          {participant?.fotoURL ? (
            <img
              src={participant.fotoURL}
              className="matches-avatar"
              style={isMe ? { borderColor: accentColor, borderWidth: 2.5 } : undefined}
              alt={shortName}
            />
          ) : (
            <div className="matches-avatar matches-avatar-placeholder" style={isMe ? { borderColor: accentColor, borderWidth: 2.5 } : undefined}>
              {participant?.nombreApellidos?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
          <span className="matches-avatar-name" style={isMe ? { color: accentColor, fontWeight: 900 } : undefined}>{shortName}</span>
        </div>
      );
    };

    const EmptySlot = () => (
      <div className="matches-avatar-stack">
        <div className="matches-avatar matches-avatar-empty">
          <Plus size={18} color={colors.textDim} />
        </div>
        <span className="matches-avatar-name">-</span>
      </div>
    );

    const renderTeam = (team: any[]) => (
      <div className="matches-team-group">
        {Array.from({ length: 2 }).map((_, index) => (
          team[index] ? <AvatarCircle key={index} participant={team[index]} /> : <EmptySlot key={index} />
        ))}
      </div>
    );

    return (
      <button
        key={item.id}
        className="matches-card"
        style={{
          borderColor: isParticipant || isTournament ? accentColor : colors.border,
          borderWidth: isParticipant || isTournament ? 2 : 1,
          backgroundColor: isTournament ? '#D4A01708' : colors.surface,
        }}
        onClick={() => navigate(`/match/${item.id}`)}
      >
        <div className="matches-card-header">
          <div>
            <div className="matches-card-title-row">
              {isTournament && <Trophy size={16} color="#D4A017" />}
              <span className="matches-card-title" style={isTournament ? { color: '#D4A017' } : undefined}>
                {isTournament ? 'TORNEO · Sabardes' : 'PADEL · Sabardes'}
              </span>
            </div>
            <span className="matches-card-date">{formatVerboseDate(item.fecha, item.hora)}</span>
          </div>
          {isParticipant && (
            <span className="matches-pill" style={{ backgroundColor: `${accentColor}22`, borderColor: accentColor, color: accentColor }}>
              {t('joined')}
            </span>
          )}
        </div>

        <div className="matches-versus-row">
          {renderTeam(teamA)}
          <div className="matches-versus-label" style={{ color: primaryColor }}>vs</div>
          {renderTeam(teamB)}
        </div>

        <div className="matches-card-footer">
          {item.isPast ? (
            <span className="matches-footer-text muted">Partido finalizado sin resultado</span>
          ) : isFull ? (
            <span className="matches-footer-text" style={{ color: accentColor }}>PARTIDO CONFIRMADO!</span>
          ) : isParticipant ? (
            <span className="matches-footer-text muted">{freeSpots} plaza{freeSpots !== 1 ? 's' : ''} por cubrir</span>
          ) : (
            <span className="matches-footer-text" style={{ color: accentColor }}>{freeSpots} plaza{freeSpots !== 1 ? 's' : ''} libre{freeSpots !== 1 ? 's' : ''}</span>
          )}
          <ChevronRight size={26} color={item.isPast ? colors.textDim : accentColor} />
        </div>
      </button>
    );
  };

  const displayMatches = isCalendarView
    ? matches.filter((match) => (match.fecha || '').substring(0, 5) === selectedDateFilter)
    : matches;

  return (
    <div className="matches-page">
      <div className="page-header">
        <h1>{t('your_matches')}</h1>
      </div>

      {isCalendarView && (
        <div className="matches-calendar-bar">
          <div className="matches-calendar-icon-wrap">
            <CalendarDays size={28} color={colors.text} />
          </div>
          <div className="matches-calendar-days">
            {weekDays.map((day) => {
              const isSelected = selectedDateFilter === day.format;
              const hasMatch = matches.some((match) => (match.fecha || '').substring(0, 5) === day.format);
              return (
                <button key={day.format} className="matches-calendar-day" onClick={() => setSelectedDateFilter(day.format)}>
                  <span className="matches-calendar-day-name" style={isSelected ? { color: primaryColor, fontWeight: 900 } : undefined}>{day.dayName}</span>
                  <span className="matches-calendar-circle" style={isSelected ? { backgroundColor: '#111827' } : undefined}>
                    <span style={isSelected ? { color: '#fff' } : undefined}>{day.dayNum}</span>
                    {hasMatch && <span className="matches-calendar-badge" style={{ backgroundColor: primaryColor }}></span>}
                  </span>
                  <span className="matches-calendar-month" style={isSelected ? { color: primaryColor } : undefined}>{day.monthName}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="scroll-area matches-scroll">
        {loading ? (
          <div className="matches-loading"><div className="spinner" style={{ borderTopColor: primaryColor }}></div></div>
        ) : displayMatches.length === 0 ? (
          <p className="empty-text">{isCalendarView ? `Dia despejado. No hay partidos programados para ${selectedDateFilter}.` : t('no_matches')}</p>
        ) : (
          <div className="matches-list">
            {displayMatches.map((match) => renderCard(match))}
          </div>
        )}
      </div>

      {(user?.role === 'admin' || openMatchCreation) && (
        <button
          className="matches-fab"
          style={{ backgroundColor: primaryColor }}
          onClick={() => navigate(`/create-match${isCalendarView ? `?initialDateStr=${selectedDateFilter}` : ''}`)}
        >
          <Plus size={32} color="#fff" />
        </button>
      )}
    </div>
  );
}
