import { useEffect, useMemo, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, onSnapshot, orderBy, query } from 'firebase/firestore';
import { CalendarDays, ChevronDown, ChevronRight, ChevronUp, Plus, Trophy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LanguageContext';
import AvatarPreviewModal from '../components/AvatarPreviewModal';
import WeatherIcon from '../components/WeatherIcon';
import { useCourtWeather } from '../hooks/useCourtWeather';
import { formatIsoDate, getHourlyFocusIndex, getHourlySliceAround, getWeatherForIsoDate, resolveMatchDateToIso } from '../services/weather';
import './Dashboard.css';

const shortDayNames = {
  es: ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'],
  gl: ['DOM', 'LUN', 'MAR', 'MER', 'XOV', 'VEN', 'SAB'],
} as const;

const longDayNames = {
  es: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  gl: ['Domingo', 'Luns', 'Martes', 'Mércores', 'Xoves', 'Venres', 'Sábado'],
} as const;

const shortMonthNames = {
  es: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'],
  gl: ['Xan', 'Feb', 'Mar', 'Abr', 'Mai', 'Xuñ', 'Xul', 'Ago', 'Set', 'Out', 'Nov', 'Dec'],
} as const;

const longMonthNames = {
  es: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  gl: ['xaneiro', 'febreiro', 'marzo', 'abril', 'maio', 'xuño', 'xullo', 'agosto', 'setembro', 'outubro', 'novembro', 'decembro'],
} as const;

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

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { primaryColor, colors, isCalendarView, openMatchCreation } = useTheme();
  const { t, language } = useTranslation();
  const { forecast, loading: weatherLoading, error: weatherError } = useCourtWeather();

  const [matches, setMatches] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDateFilter, setSelectedDateFilter] = useState(formatDDMM(new Date()));
  const [expandedWeather, setExpandedWeather] = useState<Record<string, boolean>>({});
  const [avatarPreview, setAvatarPreview] = useState<{ imageUrl: string; alt: string } | null>(null);

  const weekDays = useMemo(() => Array.from({ length: 14 }).map((_, index) => {
    const day = new Date();
    day.setDate(day.getDate() + index);
    return {
      format: formatDDMM(day),
      iso: formatIsoDate(day),
      dayName: shortDayNames[language][day.getDay()],
      dayNum: day.getDate(),
      monthName: shortMonthNames[language][day.getMonth()],
    };
  }), [language]);

  const formatVerboseDate = (fStr: string, hStr: string) => {
    const ts = parseDateStr(fStr, hStr);
    const date = new Date(ts);
    return `${longDayNames[language][date.getDay()]}, ${date.getDate()} de ${longMonthNames[language][date.getMonth()]} · ${hStr}`;
  };

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

  const toggleWeatherSection = (matchId: string) => {
    setExpandedWeather((previous) => ({
      ...previous,
      [matchId]: !previous[matchId],
    }));
  };

  const renderCard = (item: any) => {
    const isParticipant = item.listaParticipantes?.includes(user?.uid);
    const isTournament = !!item.isTournament;
    const accentColor = isTournament ? '#D4A017' : primaryColor;
    const cardBorderColor = isParticipant ? primaryColor : (isTournament ? '#D4A017' : colors.border);
    const participantSlots = Array.from({ length: 4 }, (_, index) => {
      const uid = item.listaParticipantes?.[index];
      if (!uid) return null;
      return users.find((entry) => entry.id === uid) || null;
    });
    const participantsCount = participantSlots.filter(Boolean).length;
    const isFull = participantsCount >= 4;
    const freeSpots = 4 - participantsCount;
    const teamA = participantSlots.slice(0, 2);
    const teamB = participantSlots.slice(2, 4);
    const weatherForMatch = getWeatherForIsoDate(forecast, resolveMatchDateToIso(item.fecha));
    const focusIndex = getHourlyFocusIndex(weatherForMatch.hourly, item.hora);
    const highlightedWeather = weatherForMatch.hourly[focusIndex] || weatherForMatch.daily;
    const highlightedTemperature = weatherForMatch.hourly[focusIndex]?.temperature ?? weatherForMatch.daily?.tempMax ?? null;
    const hourlySlice = getHourlySliceAround(weatherForMatch.hourly, item.hora, 3);
    const isWeatherExpanded = !!expandedWeather[item.id];

    const handleOpenMatch = () => navigate(`/match/${item.id}`);

    const AvatarCircle = ({ participant }: { participant: any }) => {
      const isMe = participant?.id === user?.uid;
      const shortName = isMe ? 'Yo' : participant?.nombreApellidos?.split(' ')[0] || '?';
      return (
        <div className="matches-avatar-stack">
          {participant?.fotoURL ? (
            <button
              type="button"
              className="matches-avatar-button"
              onClick={(event) => {
                event.stopPropagation();
                setAvatarPreview({ imageUrl: participant.fotoURL, alt: participant.nombreApellidos || shortName });
              }}
            >
              <img
                src={participant.fotoURL}
                className="matches-avatar"
                style={isMe ? { borderColor: accentColor, borderWidth: 2.5 } : undefined}
                alt={shortName}
              />
            </button>
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
      <article
        key={item.id}
        className="matches-card"
        style={{
          borderColor: cardBorderColor,
          borderWidth: isParticipant || isTournament ? 2 : 1,
          backgroundColor: isTournament ? '#D4A01708' : colors.surface,
          boxShadow: isParticipant
            ? `0 0 0 1px ${primaryColor}20, 0 10px 24px rgba(0, 0, 0, 0.08)`
            : undefined,
        }}
        onClick={handleOpenMatch}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleOpenMatch();
          }
        }}
        role="button"
        tabIndex={0}
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

          <div className="matches-card-meta">
            {highlightedWeather && (
              <div className="matches-weather-summary" style={{ borderColor: `${accentColor}33` }}>
                  <WeatherIcon kind={highlightedWeather.visualKind} isDay={'isDay' in highlightedWeather ? highlightedWeather.isDay : true} size={20} color={accentColor} />
                <div className="matches-weather-summary-copy">
                  <span className="matches-weather-temp">{highlightedTemperature ?? '--'}°C</span>
                  <span className="matches-weather-desc">{t(highlightedWeather.labelKey)}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="matches-versus-row">
          {renderTeam(teamA)}
          <div className="matches-versus-label" style={{ color: primaryColor }}>vs</div>
          {renderTeam(teamB)}
        </div>

        <div className="matches-weather-shell">
          <button
            type="button"
            className="matches-weather-toggle"
            onClick={(event) => {
              event.stopPropagation();
              toggleWeatherSection(item.id);
            }}
          >
            {isWeatherExpanded ? <ChevronUp size={18} color={accentColor} /> : <ChevronDown size={18} color={accentColor} />}
            <span>{t('weather_hourly')}</span>
            <span className="matches-weather-match-hour">{t('weather_match_hour')} · {item.hora}</span>
          </button>

          {isWeatherExpanded && (
            <div className="matches-hourly-panel" onClick={(event) => event.stopPropagation()}>
              {weatherLoading ? (
                <p className="matches-weather-empty">{t('weather_loading')}</p>
              ) : weatherError ? (
                <p className="matches-weather-empty">{t('weather_error')}</p>
              ) : hourlySlice.entries.length === 0 ? (
                <p className="matches-weather-empty">{t('weather_unavailable')}</p>
              ) : (
                <div className="matches-hourly-strip">
                  {hourlySlice.entries.map((entry, index) => {
                    const isFocused = index === hourlySlice.selectedIndex;
                    return (
                      <div
                        key={entry.isoTime}
                        className={`matches-hourly-item ${isFocused ? 'is-focused' : ''}`}
                        style={isFocused ? { borderColor: `${accentColor}88`, boxShadow: `0 0 0 1px ${accentColor}55 inset` } : undefined}
                      >
                        <span className="matches-hourly-time">{entry.hour}</span>
                        <WeatherIcon kind={entry.visualKind} isDay={entry.isDay} size={22} color={isFocused ? accentColor : colors.textDim} />
                        <span className="matches-hourly-temp">{entry.temperature ?? '--'}°C</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
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
      </article>
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
              const dayWeather = getWeatherForIsoDate(forecast, day.iso).daily;
              return (
                <button key={day.format} className={`matches-calendar-day ${isSelected ? 'is-selected' : ''}`} onClick={() => setSelectedDateFilter(day.format)}>
                  <span className="matches-calendar-day-name" style={isSelected ? { color: primaryColor } : undefined}>{day.dayName}</span>
                  <div className={`matches-calendar-day-card ${isSelected ? 'is-selected' : ''}`} style={isSelected ? { borderColor: `${primaryColor}aa`, boxShadow: `0 0 0 1px ${primaryColor}55 inset` } : undefined}>
                    {hasMatch && <span className="matches-calendar-badge" style={{ backgroundColor: primaryColor, borderColor: colors.background }}></span>}
                    <span className="matches-calendar-weather-icon">
                      {dayWeather ? (
                        <WeatherIcon kind={dayWeather.visualKind} size={18} color={isSelected ? primaryColor : colors.textDim} />
                      ) : (
                        <span className="matches-calendar-weather-fallback">{weatherLoading ? '…' : '—'}</span>
                      )}
                    </span>
                    <span className="matches-calendar-day-number">{day.dayNum}</span>
                    <span className="matches-calendar-month">{day.monthName}</span>
                    <span className="matches-calendar-temps">
                      {dayWeather ? `${dayWeather.tempMax ?? '--'}°/${dayWeather.tempMin ?? '--'}°` : weatherLoading ? '...' : '--'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <div className="matches-loading"><div className="spinner" style={{ borderTopColor: primaryColor }}></div></div>
      ) : (
        <div className="scroll-area matches-scroll">
          <div className="matches-list">
            {displayMatches.length === 0 ? (
              <p className="empty-text">{t('no_matches')}</p>
            ) : (
              displayMatches.map((item) => renderCard(item))
            )}
          </div>
        </div>
      )}

      {(user?.role === 'admin' || openMatchCreation) && (
        <button className="matches-fab" style={{ backgroundColor: primaryColor }} onClick={() => navigate(`/create-match?initialDateStr=${selectedDateFilter}`)}>
          <Plus size={30} color="#fff" />
        </button>
      )}

      {avatarPreview && (
        <AvatarPreviewModal
          imageUrl={avatarPreview.imageUrl}
          alt={avatarPreview.alt}
          onClose={() => setAvatarPreview(null)}
        />
      )}
    </div>
  );
}
