import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { CalendarDays, Trophy, Plus, ChevronRight } from 'lucide-react';
import './Dashboard.css';

const daysString = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const monthsShort = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const daysVerbose = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const monthsVerbose = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const formatDDMM = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

const parseDateStr = (fStr: string, hStr: string) => {
  const [d, mo] = (fStr || '01/01').split('/');
  const [h, mi] = (hStr || '00:00').split(':');
  const dt = new Date();
  dt.setHours(parseInt(h || '0'));
  dt.setMinutes(parseInt(mi || '0'));
  const matchMonth = parseInt(mo || '1') - 1;
  if (matchMonth < dt.getMonth() - 2) dt.setFullYear(dt.getFullYear() + 1);
  dt.setMonth(matchMonth);
  dt.setDate(parseInt(d || '1'));
  return dt.getTime();
};

const formatVerboseDate = (fStr: string, hStr: string) => {
  const ts = parseDateStr(fStr, hStr);
  const d = new Date(ts);
  return `${daysVerbose[d.getDay()]}, ${d.getDate()} de ${monthsVerbose[d.getMonth()]} · ${hStr}`;
};

export default function DashboardPage() {
  const [matches, setMatches] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { primaryColor, isCalendarView, openMatchCreation } = useTheme();
  const navigate = useNavigate();

  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(formatDDMM(today));
  const weekDays = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return {
      format: formatDDMM(d),
      dayName: daysString[d.getDay()],
      dayNum: d.getDate(),
      monthName: monthsShort[d.getMonth()],
    };
  });

  useEffect(() => {
    getDocs(collection(db, 'users')).then(snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const q = query(collection(db, 'matches'), orderBy('fecha', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const data: any[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const now = Date.now();
      const validData: any[] = [];
      data.forEach(m => {
        if (!m.fecha || !m.hora) return;
        if (now - parseDateStr(m.fecha, m.hora) > 3600000) {
          deleteDoc(doc(db, 'matches', m.id)).catch(() => {});
        } else validData.push(m);
      });

      let filtered = validData;
      if (user?.role !== 'admin') {
        filtered = validData.filter(m =>
          m.listaParticipantes?.includes(user?.uid) || m.listaInvitados?.includes(user?.uid)
        );
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

    return () => unsub();
  }, [user]);

  const displayMatches = isCalendarView
    ? matches.filter(m => (m.fecha || '').substring(0, 5) === selectedDate)
    : matches;

  const renderCard = (item: any) => {
    const isParticipant = item.listaParticipantes?.includes(user?.uid);
    const isTournament = !!item.isTournament;
    const participants = (item.listaParticipantes || [])
      .map((uid: string) => users.find(u => u.id === uid))
      .filter(Boolean);
    const isFull = participants.length >= 4;
    const freeSpots = 4 - participants.length;
    const teamA = participants.slice(0, 2);
    const teamB = participants.slice(2, 4);
    const accent = isTournament ? '#D4A017' : primaryColor;

    const AvatarCircle = ({ p }: { p: any }) => {
      const isMe = p?.id === user?.uid;
      const shortName = isMe ? 'Yo' : p?.nombreApellidos?.split(' ')[0] || '?';
      return (
        <div className="avatar-with-name">
          {p?.fotoURL ? (
            <img src={p.fotoURL}
              className="participant-avatar"
              style={isMe ? { borderColor: accent, borderWidth: 2.5 } : undefined}
              alt={shortName} />
          ) : (
            <div className="participant-avatar placeholder"
              style={isMe ? { borderColor: accent, borderWidth: 2.5 } : undefined}>
              {p?.nombreApellidos?.charAt(0)?.toUpperCase() || '?'}
            </div>
          )}
          <span className="player-name" style={isMe ? { color: accent, fontWeight: 900 } : undefined}>{shortName}</span>
        </div>
      );
    };

    const EmptySlot = () => (
      <div className="avatar-with-name">
        <div className="participant-avatar empty-slot">
          <Plus size={16} />
        </div>
        <span className="player-name">–</span>
      </div>
    );

    const renderTeam = (team: any[]) => (
      <div className="team-group">
        {[0, 1].map(i =>
          team[i] ? <AvatarCircle key={i} p={team[i]} /> : <EmptySlot key={i} />
        )}
      </div>
    );

    return (
      <div
        key={item.id}
        className={`match-card ${isParticipant ? 'mine' : ''} ${isTournament ? 'tournament' : ''}`}
        style={{
          borderColor: isParticipant || isTournament ? accent : undefined,
          borderWidth: isParticipant || isTournament ? 2 : undefined,
        }}
        onClick={() => navigate(`/match/${item.id}`)}
      >
        <div className="card-header">
          <div>
            <div className="card-title-row">
              {isTournament && <Trophy size={16} color="#D4A017" />}
              <span className="card-title" style={isTournament ? { color: '#D4A017' } : undefined}>
                {isTournament ? 'TORNEO · Sabardes' : 'PÁDEL · Sabardes'}
              </span>
            </div>
            <span className="card-date">{formatVerboseDate(item.fecha, item.hora)}</span>
          </div>
          {isParticipant && (
            <span className="badge" style={{ backgroundColor: accent + '22', color: accent, borderColor: accent }}>
              Apuntado
            </span>
          )}
        </div>

        <div className="vs-row">
          {renderTeam(teamA)}
          <div className="vs-wrap">
            <span className="vs-text" style={{ color: primaryColor }}>vs</span>
          </div>
          {renderTeam(teamB)}
        </div>

        <div className="card-footer">
          {isFull ? (
            <span className="confirmed-text" style={{ color: accent }}>¡PARTIDO CONFIRMADO!</span>
          ) : isParticipant ? (
            <span className="waiting-text">{freeSpots} plaza{freeSpots !== 1 ? 's' : ''} por cubrir</span>
          ) : (
            <span className="free-spots" style={{ color: accent }}>{freeSpots} plaza{freeSpots !== 1 ? 's' : ''} libre{freeSpots !== 1 ? 's' : ''}</span>
          )}
          <ChevronRight size={22} color={accent} />
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <h1>Tus Partidos</h1>
      </div>

      {isCalendarView && (
        <div className="calendar-bar">
          <CalendarDays size={24} />
          <div className="days-scroll">
            {weekDays.map((wd, i) => {
              const isSelected = selectedDate === wd.format;
              return (
                <button
                  key={i}
                  className={`day-col ${isSelected ? 'active' : ''}`}
                  onClick={() => setSelectedDate(wd.format)}
                  style={isSelected ? { '--accent': primaryColor } as any : undefined}
                >
                  <span className="day-name">{wd.dayName}</span>
                  <span className="day-num">{wd.dayNum}</span>
                  <span className="day-month">{wd.monthName}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="scroll-area" style={{ padding: 16 }}>
        {loading ? (
          <div className="loading-state">
            <div className="spinner" style={{ borderTopColor: primaryColor }}></div>
          </div>
        ) : displayMatches.length === 0 ? (
          <div className="empty-state">
            <CalendarDays size={48} strokeWidth={1.2} />
            <p>No hay partidos programados{isCalendarView ? ` para ${selectedDate}` : ''}.</p>
          </div>
        ) : (
          displayMatches.map(item => renderCard(item))
        )}
      </div>

      {(user?.role === 'admin' || openMatchCreation) && (
        <button
          className="fab"
          style={{ backgroundColor: primaryColor }}
          onClick={() => navigate('/create-match')}
        >
          <Plus size={28} color="#fff" />
        </button>
      )}
    </div>
  );
}
