import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, getDoc, getDocs, addDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { sendCategorizedPushNotification } from '../services/PushService';
import { Trophy, Users, Plus, X, Check, CalendarDays, Lock, ArrowLeft, RotateCcw } from 'lucide-react';
import './Tournament.css';

const TOURNAMENT_DOC = 'currentTournament';

const getNextDayDate = (dayName: string) => {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const target = days.indexOf(dayName);
  const now = new Date();
  let diff = target - now.getDay();
  if (diff <= 0) diff += 7;
  const next = new Date(now.getTime() + diff * 86400000);
  return `${String(next.getDate()).padStart(2, '0')}/${String(next.getMonth() + 1).padStart(2, '0')}/${next.getFullYear()}`;
};

export default function TournamentPage() {
  const { user } = useAuth();
  const { autoApproveTournament } = useTheme();

  const [tournament, setTournament] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myTeam, setMyTeam] = useState<any>(null);
  const [pendingInvite, setPendingInvite] = useState<any>(null);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [matchesPerWeek, setMatchesPerWeek] = useState(1);
  const [globalMatches, setGlobalMatches] = useState<any[]>([]);

  // Modals
  const [partnerModal, setPartnerModal] = useState(false);
  const [adminPairingModal, setAdminPairingModal] = useState(false);
  const [p1, setP1] = useState<any>(null);
  const [p2, setP2] = useState<any>(null);
  const [selectingPlayer, setSelectingPlayer] = useState<'p1' | 'p2'>('p1');
  const [overrideModal, setOverrideModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [matchSets, setMatchSets] = useState([{ t1: '', t2: '' }, { t1: '', t2: '' }, { t1: '', t2: '' }]);
  const [calendarModal, setCalendarModal] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ show: boolean, title: string, msg: string, onOk: () => void }>({ show: false, title: '', msg: '', onOk: () => {} });

  // Calendar state
  const [myProposedSlots, setMyProposedSlots] = useState<string[]>([]);
  const [myVetoedSlots, setMyVetoedSlots] = useState<string[]>([]);
  const [includePartner, setIncludePartner] = useState(false);
  const [submittingProposals, setSubmittingProposals] = useState(false);

  useEffect(() => {
    const unsub1 = onSnapshot(doc(db, 'tournament', TOURNAMENT_DOC), snap => {
      setTournament(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      setLoading(false);
    });
    const unsub2 = onSnapshot(collection(db, 'tournamentTeams'), snap => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setTeams(data);
      setMyTeam(data.find((t: any) => t.player1Id === user?.uid || t.player2Id === user?.uid) || null);
      setPendingInvite(data.find((t: any) => t.player2Id === user?.uid && t.status === 'pending') || null);
    });
    const unsub3 = onSnapshot(doc(db, 'config', 'tournamentSlots'), snap => {
      if (snap.exists()) {
        setAvailableSlots(snap.data().slots || []);
        if (snap.data().matchesPerWeek) setMatchesPerWeek(snap.data().matchesPerWeek);
      }
    });
    const unsub4 = onSnapshot(collection(db, 'matches'), snap => {
      setGlobalMatches(snap.docs.map(d => d.data()));
    });
    getDocs(collection(db, 'users')).then(snap => {
      setAllUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); };
  }, [user?.uid]);

  // ========= ADMIN LOGIC =========
  const setPhase = async (phase: string) => {
    await setDoc(doc(db, 'tournament', TOURNAMENT_DOC), { phase, startedAt: new Date().toISOString() }, { merge: true });
    if (phase === 'phase2') await generateRoundRobinSchedule();
    if (phase === 'phase3') await generateBracket();
  };

  const goBackPhase = () => {
    const phases = ['pending', 'phase1', 'phase2', 'phase3'];
    const idx = phases.indexOf(tournament?.phase);
    if (idx < 1) return;
    setConfirmModal({
      show: true, title: 'Retroceder Fase',
      msg: `¿Seguro que quieres volver a "${phases[idx - 1]}"?`,
      onOk: async () => { await updateDoc(doc(db, 'tournament', TOURNAMENT_DOC), { phase: phases[idx - 1] }); }
    });
  };

  const resetTournament = () => {
    setConfirmModal({
      show: true, title: 'Resetear Torneo',
      msg: '¿Borrar TODOS los datos del torneo? ¡Irreversible!',
      onOk: async () => {
        const teamsSnap = await getDocs(collection(db, 'tournamentTeams'));
        await Promise.all(teamsSnap.docs.map(d => deleteDoc(doc(db, 'tournamentTeams', d.id))));
        const matchesSnap = await getDocs(collection(db, 'matches'));
        const tMatches = matchesSnap.docs.filter(d => d.data().isTournament || d.data().tournamentMatchId);
        await Promise.all(tMatches.map(d => deleteDoc(doc(db, 'matches', d.id))));
        await setDoc(doc(db, 'tournament', TOURNAMENT_DOC), { phase: 'pending', startedAt: null, schedule: [], bracket: {} });
      }
    });
  };

  // ========= ROUND-ROBIN =========
  const generateRoundRobinSchedule = async () => {
    const confirmed = teams.filter(t => t.status === 'confirmed');
    if (confirmed.length < 2) return;
    let mpw = matchesPerWeek;
    try { const c = await getDoc(doc(db, 'config', 'tournamentSlots')); if (c.exists() && c.data().matchesPerWeek) mpw = c.data().matchesPerWeek; } catch {}

    const existing = tournament?.schedule || [];
    if (existing.length > 0) {
      const inSchedule = new Set<string>();
      existing.forEach((m: any) => { inSchedule.add(m.team1Id); inSchedule.add(m.team2Id); });
      inSchedule.delete('dummy');
      if (confirmed.every(t => inSchedule.has(t.id)) && confirmed.length === inSchedule.size) return;
    }

    const refs = [...confirmed];
    if (refs.length % 2 !== 0) refs.push({ id: 'dummy', name: 'Descanso', status: 'dummy' } as any);
    const n = refs.length;
    const roundGroups: any[][] = [];
    for (let r = 0; r < n - 1; r++) {
      const rm: any[] = [];
      for (let i = 0; i < n / 2; i++) {
        const tA = refs[i], tB = refs[n - 1 - i];
        if (tA.id !== 'dummy' && tB.id !== 'dummy') rm.push({ tA, tB });
      }
      roundGroups.push(rm);
      const last = refs.pop(); if (last) refs.splice(1, 0, last);
    }
    const schedule: any[] = [];
    roundGroups.forEach((rm, ri) => {
      const week = Math.floor(ri / mpw) + 1;
      rm.forEach(({ tA, tB }) => {
        schedule.push({ id: `${tA.id}_${tB.id}`, team1Id: tA.id, team1Name: tA.name, team2Id: tB.id, team2Name: tB.name, status: 'pending', result: null, week });
      });
    });
    await setDoc(doc(db, 'tournament', TOURNAMENT_DOC), { schedule }, { merge: true });
  };

  // ========= BRACKET =========
  const generateBracket = async () => {
    if (tournament?.bracket?.quarterfinals?.length > 0) return;
    const standings = getStandings();
    const top8 = standings.slice(0, 8);
    const bracket = {
      quarterfinals: [
        { id: 'qf1', teamA: top8[0], teamB: top8[7] }, { id: 'qf2', teamA: top8[1], teamB: top8[6] },
        { id: 'qf3', teamA: top8[2], teamB: top8[5] }, { id: 'qf4', teamA: top8[3], teamB: top8[4] },
      ],
      semifinals: [], final: []
    };
    await setDoc(doc(db, 'tournament', TOURNAMENT_DOC), { bracket }, { merge: true });
  };

  const getStandings = () => {
    const confirmed = teams.filter(t => t.status === 'confirmed');
    const schedule = tournament?.schedule || [];
    return confirmed.map(team => {
      const ms = schedule.filter((m: any) => m.status === 'confirmed' && (m.team1Id === team.id || m.team2Id === team.id));
      const wins = ms.filter((m: any) => m.winnerId === team.id).length;
      return { ...team, pts: wins, wins, played: ms.length };
    }).sort((a, b) => b.pts - a.pts || b.wins - a.wins);
  };

  // ========= TEAM MANAGEMENT =========
  const requestPartner = async (partnerId: string) => {
    const partner = allUsers.find(u => u.id === partnerId);
    await addDoc(collection(db, 'tournamentTeams'), {
      player1Id: user?.uid, player1Name: user?.nombreApellidos, player1Photo: user?.fotoURL || null,
      player2Id: partnerId, player2Name: partner?.nombreApellidos, player2Photo: partner?.fotoURL || null,
      name: `${user?.nombreApellidos?.split(' ')[0]} / ${partner?.nombreApellidos?.split(' ')[0]}`,
      status: 'pending', createdAt: new Date().toISOString()
    });
    setPartnerModal(false);
    if (partner?.id) await sendCategorizedPushNotification([partner.id], '¡Invitación al Torneo!', `${user?.nombreApellidos?.split(' ')[0]} te ha invitado como pareja.`, 'invitations');
  };

  const acceptInvite = async () => { if (pendingInvite) await updateDoc(doc(db, 'tournamentTeams', pendingInvite.id), { status: 'confirmed' }); };
  const declineInvite = async () => { if (pendingInvite) await deleteDoc(doc(db, 'tournamentTeams', pendingInvite.id)); };

  const adminCreatePair = async () => {
    if (!p1 || !p2) return;
    await addDoc(collection(db, 'tournamentTeams'), {
      player1Id: p1.id, player1Name: p1.nombreApellidos, player1Photo: p1.fotoURL || null,
      player2Id: p2.id, player2Name: p2.nombreApellidos, player2Photo: p2.fotoURL || null,
      name: `${p1.nombreApellidos?.split(' ')[0]} / ${p2.nombreApellidos?.split(' ')[0]}`,
      status: 'confirmed', createdAt: new Date().toISOString()
    });
    setAdminPairingModal(false); setP1(null); setP2(null);
  };

  const deleteTeam = (teamId: string, teamName: string) => {
    setConfirmModal({
      show: true, title: 'Eliminar Pareja',
      msg: `¿Borrar "${teamName}" del torneo?`,
      onOk: async () => { await deleteDoc(doc(db, 'tournamentTeams', teamId)); }
    });
  };

  // ========= RESULT OVERRIDE =========
  const overrideResult = async () => {
    if (user?.role !== 'admin' || !selectedMatch) return;
    const validSets = matchSets.filter(s => s.t1 !== '' && s.t2 !== '');
    if (validSets.length === 0) return alert('Introduce al menos un set.');
    let t1W = 0, t2W = 0;
    validSets.forEach(s => { parseInt(s.t1) > parseInt(s.t2) ? t1W++ : t2W++; });
    const id1 = selectedMatch.team1Id || selectedMatch.teamA?.id;
    const id2 = selectedMatch.team2Id || selectedMatch.teamB?.id;
    const winnerId = t1W > t2W ? id1 : t2W > t1W ? id2 : null;

    if (selectedMatch.phase === 'bracket') {
      const bracketObj = { ...tournament.bracket };
      const [rStr, idx] = selectedMatch.bracketPath;
      let m = rStr === 'final' ? { ...bracketObj.final } : { ...bracketObj[rStr][idx] };
      m.status = 'confirmed';
      m.sets = validSets.map(s => ({ team1: parseInt(s.t1), team2: parseInt(s.t2) }));
      m.winnerId = winnerId;
      if (rStr === 'final') bracketObj.final = m; else bracketObj[rStr][idx] = m;

      const t1A = m.teamA || teams.find(t => t.id === m.team1Id);
      const t2B = m.teamB || teams.find(t => t.id === m.team2Id);
      const winnerTeam = winnerId === (t1A?.id || m.team1Id) ? t1A : t2B;
      if (rStr === 'quarterfinals' && winnerTeam) {
        const si = Math.floor(idx / 2);
        if (!bracketObj.semifinals) bracketObj.semifinals = [];
        if (!bracketObj.semifinals[si]) bracketObj.semifinals[si] = { id: `sf${si + 1}` };
        idx % 2 === 0 ? bracketObj.semifinals[si].teamA = winnerTeam : bracketObj.semifinals[si].teamB = winnerTeam;
      } else if (rStr === 'semifinals' && winnerTeam) {
        if (!bracketObj.final) bracketObj.final = { id: 'final' };
        idx === 0 ? bracketObj.final.teamA = winnerTeam : bracketObj.final.teamB = winnerTeam;
      }
      await updateDoc(doc(db, 'tournament', TOURNAMENT_DOC), { bracket: bracketObj });
    } else {
      const updated = tournament.schedule.map((m: any) =>
        m.id === selectedMatch.id ? { ...m, status: 'confirmed', sets: validSets.map(s => ({ team1: parseInt(s.t1), team2: parseInt(s.t2) })), winnerId } : m
      );
      await updateDoc(doc(db, 'tournament', TOURNAMENT_DOC), { schedule: updated });
    }
    setOverrideModal(false); setSelectedMatch(null); setMatchSets([{ t1: '', t2: '' }, { t1: '', t2: '' }, { t1: '', t2: '' }]);
  };

  // ========= CALENDAR / PROPOSALS =========
  const openCalendar = (match: any) => {
    setSelectedMatch(match);
    const pa = match.playerAvailability || {};
    const myAvail = pa[user?.uid || ''];
    setMyProposedSlots(myAvail?.proposed || []);
    setMyVetoedSlots(myAvail?.vetoed || []);
    setCalendarModal(true);
  };

  const isSlotBlocked = (dateStr: string) => {

    const checkOverlap = (d1: string, t1: string, d2: string, t2: string) => {
      const d1b = d1.substring(0, 5), d2b = d2.length > 5 ? d2.substring(0, 5) : d2;
      if (d1b !== d2b) return false;
      const pm = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
      return Math.max(pm(t1), pm(t2)) < Math.min(pm(t1) + 90, pm(t2) + 90);
    };
    const [datePart, timePart] = dateStr.split(' ');
    for (const gm of globalMatches) {
      if (gm.fecha && gm.hora && checkOverlap(datePart, timePart, gm.fecha, gm.hora)) return true;
    }
    return false;
  };

  const cycleSlot = (dateStr: string) => {
    if (isSlotBlocked(dateStr)) return;
    if (myProposedSlots.includes(dateStr)) {
      setMyProposedSlots(p => p.filter(s => s !== dateStr));
      setMyVetoedSlots(p => [...p, dateStr]);
    } else if (myVetoedSlots.includes(dateStr)) {
      setMyVetoedSlots(p => p.filter(s => s !== dateStr));
    } else {
      setMyProposedSlots(p => [...p, dateStr]);
    }
  };

  const submitProposals = async () => {
    if (!myTeam || !selectedMatch || !user?.uid) return;
    setSubmittingProposals(true);
    try {
      const isBracket = selectedMatch.phase === 'bracket';
      const schedule = [...(tournament.schedule || [])];
      let match: any;
      let matchIdx = -1;

      if (!isBracket) {
        matchIdx = schedule.findIndex((m: any) => m.id === selectedMatch.id);
        if (matchIdx === -1) return;
        match = { ...schedule[matchIdx] };
      } else {
        const [rStr, iIdx] = selectedMatch.bracketPath;
        match = rStr === 'final' ? { ...(tournament.bracket?.final || {}) } : { ...tournament.bracket[rStr][iIdx] };
      }

      const pa = { ...(match.playerAvailability || {}) };
      pa[user.uid] = { proposed: myProposedSlots, vetoed: myVetoedSlots };
      if (includePartner) {
        const pid = myTeam.player1Id === user.uid ? myTeam.player2Id : myTeam.player1Id;
        if (pid) pa[pid] = { proposed: myProposedSlots, vetoed: myVetoedSlots };
      }
      match.playerAvailability = pa;

      // Check for 4-player overlap
      const pIds: string[] = [];
      const t1: any = teams.find(t => t.id === (match.team1Id || match.teamA?.id));
      const t2: any = teams.find(t => t.id === (match.team2Id || match.teamB?.id));
      if (t1) { pIds.push(t1.player1Id); pIds.push(t1.player2Id); }
      if (t2) { pIds.push(t2.player1Id); pIds.push(t2.player2Id); }

      const allAnswered = pIds.every(pid => pa[pid]?.proposed?.length > 0 || pa[pid]?.vetoed?.length > 0);
      if (allAnswered) {
        const allProposed: Set<string>[] = pIds.map(pid => new Set<string>(pa[pid]?.proposed || []));
        const overlap = [...allProposed[0]].filter((slot: string) => allProposed.every(s => s.has(slot)));
        if (overlap.length > 0) {
          match.status = autoApproveTournament ? 'scheduled' : 'pending_approval';
          match.date = overlap[0];
          const desc = `${match.team1Name || t1?.name} vs ${match.team2Name || t2?.name}`;
          await notifyAdminOnOverlap(desc, overlap[0]);
        }
      }

      if (!isBracket) { schedule[matchIdx] = match; await updateDoc(doc(db, 'tournament', TOURNAMENT_DOC), { schedule }); }
      else {
        const bo = { ...tournament.bracket };
        const [rStr, iIdx] = selectedMatch.bracketPath;
        if (rStr === 'final') bo.final = match; else bo[rStr][iIdx] = match;
        await updateDoc(doc(db, 'tournament', TOURNAMENT_DOC), { bracket: bo });
      }
      setCalendarModal(false);
    } catch (e: any) { alert('Error: ' + e.message); }
    finally { setSubmittingProposals(false); }
  };

  const notifyAdminOnOverlap = async (matchDesc: string, overlapStr: string) => {
    const adminDocs = await getDocs(collection(db, 'users'));
    const adminUids = adminDocs.docs.map(d => ({ uid: d.id, ...d.data() })).filter((u: any) => u.role === 'admin' && u.pushToken).map((u: any) => u.uid);
    if (adminUids.length > 0) await sendCategorizedPushNotification(adminUids, '⚡ Coincidencia de torneo', `${matchDesc} puede jugar el ${overlapStr}.`, 'always');
  };

  // ========= RENDER LOGIC =========
  const phase = tournament?.phase || 'pending';
  const schedule = tournament?.schedule || [];
  const standings = getStandings();
  const pendingMatches = schedule.filter((m: any) => m.status !== 'confirmed');
  const confirmedMatches = schedule.filter((m: any) => m.status === 'confirmed');

  // Sort: user's matches first
  pendingMatches.sort((a: any, b: any) => {
    const aMe = myTeam && (a.team1Id === myTeam.id || a.team2Id === myTeam.id) ? 0 : 1;
    const bMe = myTeam && (b.team1Id === myTeam.id || b.team2Id === myTeam.id) ? 0 : 1;
    return aMe - bMe;
  });

  if (loading) return <div className="loading-state"><div className="spinner"></div></div>;

  return (
    <div className="tournament-page">
      <div className="page-header">
        <h1><Trophy size={24} color="#D4A017" /> Torneo</h1>
        <span className="phase-badge">{phase === 'pending' ? 'Sin iniciar' : phase === 'phase1' ? 'Fase 1 – Inscripción' : phase === 'phase2' ? 'Fase 2 – Liga' : 'Fase 3 – Eliminatorias'}</span>
      </div>

      <div className="scroll-area" style={{ padding: '0 16px 100px' }}>

        {/* ADMIN CONTROLS */}
        {user?.role === 'admin' && (
          <div className="admin-controls card">
            <h3>🛡️ Control Admin</h3>
            <div className="admin-btns">
              {phase === 'pending' && <button className="btn btn-primary" onClick={() => setPhase('phase1')}>Iniciar Fase 1</button>}
              {phase === 'phase1' && <button className="btn btn-primary" onClick={() => setPhase('phase2')}>Iniciar Fase 2</button>}
              {phase === 'phase2' && <button className="btn btn-primary" onClick={() => setPhase('phase3')}>Iniciar Fase 3</button>}
              <button className="btn btn-outline" onClick={goBackPhase}><ArrowLeft size={16} /> Retroceder</button>
              <button className="btn btn-danger" onClick={resetTournament}><RotateCcw size={16} /> Resetear</button>
            </div>
            {(phase === 'phase1') && (
              <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={() => setAdminPairingModal(true)}>
                <Users size={16} /> Crear Pareja Manual
              </button>
            )}
          </div>
        )}

        {/* PENDING INVITE */}
        {pendingInvite && (
          <div className="card invite-card">
            <h3>📩 Invitación Recibida</h3>
            <p>{pendingInvite.player1Name} te ha invitado como pareja.</p>
            <div className="invite-actions">
              <button className="btn btn-primary" onClick={acceptInvite}><Check size={16} /> Aceptar</button>
              <button className="btn btn-danger" onClick={declineInvite}><X size={16} /> Rechazar</button>
            </div>
          </div>
        )}

        {/* PHASE 1: TEAMS */}
        {(phase === 'phase1' || phase === 'phase2' || phase === 'phase3') && (
          <div className="section">
            <h3 className="section-title"><Users size={18} /> Parejas Inscritas ({teams.filter(t => t.status === 'confirmed').length})</h3>
            {teams.map(t => (
              <div key={t.id} className={`team-row ${t.status === 'pending' ? 'pending' : ''}`}>
                <div className="team-info">
                  <span className="team-name">{t.name}</span>
                  <span className="team-status">{t.status === 'pending' ? '⏳ Pendiente' : '✅ Confirmado'}</span>
                </div>
                {user?.role === 'admin' && <button className="slot-delete" onClick={() => deleteTeam(t.id, t.name)}>×</button>}
              </div>
            ))}
            {!myTeam && phase === 'phase1' && (
              <button className="btn btn-primary full" style={{ marginTop: 12 }} onClick={() => setPartnerModal(true)}>
                <Plus size={16} /> Buscar Pareja
              </button>
            )}
          </div>
        )}

        {/* PHASE 2: STANDINGS */}
        {(phase === 'phase2' || phase === 'phase3') && standings.length > 0 && (
          <div className="section">
            <h3 className="section-title"><Trophy size={18} /> Clasificación</h3>
            <div className="standings-table">
              <div className="st-header">
                <span className="st-pos">#</span>
                <span className="st-name">Equipo</span>
                <span className="st-stat">PJ</span>
                <span className="st-stat">V</span>
                <span className="st-stat">Pts</span>
              </div>
              {standings.map((s, i) => (
                <div key={s.id} className={`st-row ${myTeam?.id === s.id ? 'mine' : ''}`}>
                  <span className="st-pos">{i + 1}</span>
                  <span className="st-name">{s.name}</span>
                  <span className="st-stat">{s.played}</span>
                  <span className="st-stat">{s.wins}</span>
                  <span className="st-stat st-pts">{s.pts}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PHASE 2: PENDING MATCHES */}
        {phase === 'phase2' && pendingMatches.length > 0 && (
          <div className="section">
            <h3 className="section-title"><CalendarDays size={18} /> Partidos por Disputar</h3>
            {pendingMatches.map((m: any) => {
              const isMine = myTeam && (m.team1Id === myTeam.id || m.team2Id === myTeam.id);
              return (
                <div key={m.id} className={`match-row ${isMine ? 'mine' : ''}`} onClick={() => isMine ? openCalendar(m) : undefined}>
                  <div className="match-teams">
                    <span>{m.team1Name}</span>
                    <span className="match-vs">vs</span>
                    <span>{m.team2Name}</span>
                  </div>
                  <div className="match-meta">
                    <span className="match-week">Semana {m.week}</span>
                    {m.date && <span className="match-date">📅 {m.date}</span>}
                    {m.status === 'pending' && isMine && <span className="propose-btn">Proponer ▸</span>}
                    {m.status === 'scheduled' && <span className="scheduled-badge">✅ Programado</span>}
                  </div>
                  {user?.role === 'admin' && (
                    <button className="admin-result-btn" onClick={(e) => { e.stopPropagation(); setSelectedMatch({ ...m, phase: 'schedule' }); setOverrideModal(true); }}>
                      Resultado
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* PHASE 2: CONFIRMED MATCHES */}
        {phase === 'phase2' && confirmedMatches.length > 0 && (
          <div className="section">
            <h3 className="section-title"><Check size={18} /> Resultados</h3>
            {confirmedMatches.map((m: any) => (
              <div key={m.id} className="result-row">
                <span className={m.winnerId === m.team1Id ? 'winner' : ''}>{m.team1Name}</span>
                <span className="result-sets">
                  {(m.sets || []).map((s: any, i: number) => <span key={i}>{s.team1}-{s.team2}</span>)}
                </span>
                <span className={m.winnerId === m.team2Id ? 'winner' : ''}>{m.team2Name}</span>
              </div>
            ))}
          </div>
        )}

        {/* PHASE 3: BRACKET */}
        {phase === 'phase3' && tournament?.bracket && (
          <div className="section">
            <h3 className="section-title"><Trophy size={18} /> Cuadro Eliminatorio</h3>
            {['quarterfinals', 'semifinals'].map(round => (
              (tournament.bracket[round] || []).length > 0 && (
                <div key={round} className="bracket-round">
                  <h4>{round === 'quarterfinals' ? 'Cuartos de Final' : 'Semifinales'}</h4>
                  {tournament.bracket[round].map((m: any, i: number) => (
                    <div key={m.id || i} className="bracket-match">
                      <span className={m.winnerId === m.teamA?.id ? 'winner' : ''}>{m.teamA?.name || 'TBD'}</span>
                      <span className="match-vs">vs</span>
                      <span className={m.winnerId === m.teamB?.id ? 'winner' : ''}>{m.teamB?.name || 'TBD'}</span>
                      {m.status === 'confirmed' && m.sets && (
                        <span className="result-sets">{m.sets.map((s: any, j: number) => <span key={j}>{s.team1}-{s.team2}</span>)}</span>
                      )}
                      {user?.role === 'admin' && m.teamA && m.teamB && m.status !== 'confirmed' && (
                        <button className="admin-result-btn" onClick={() => { setSelectedMatch({ ...m, phase: 'bracket', bracketPath: [round, i] }); setOverrideModal(true); }}>
                          Resultado
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )
            ))}
            {tournament.bracket.final && (
              <div className="bracket-round final">
                <h4>🏆 Final</h4>
                <div className="bracket-match">
                  <span className={tournament.bracket.final.winnerId === tournament.bracket.final.teamA?.id ? 'winner' : ''}>{tournament.bracket.final.teamA?.name || 'TBD'}</span>
                  <span className="match-vs">vs</span>
                  <span className={tournament.bracket.final.winnerId === tournament.bracket.final.teamB?.id ? 'winner' : ''}>{tournament.bracket.final.teamB?.name || 'TBD'}</span>
                  {tournament.bracket.final.winnerId && <p className="champion">🏆 ¡Campeón: {tournament.bracket.final.winnerId === tournament.bracket.final.teamA?.id ? tournament.bracket.final.teamA?.name : tournament.bracket.final.teamB?.name}!</p>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ======= MODALS ======= */}

      {/* Partner Modal */}
      {partnerModal && (
        <div className="modal-overlay" onClick={() => setPartnerModal(false)}>
          <div className="modal-body" onClick={e => e.stopPropagation()}>
            <h3>Elegir Pareja</h3>
            <div className="user-list">
              {allUsers.filter(u => u.id !== user?.uid && !teams.find(t => t.player1Id === u.id || t.player2Id === u.id)).map(u => (
                <div key={u.id} className="user-item" onClick={() => requestPartner(u.id)}>
                  {u.fotoURL ? <img src={u.fotoURL} className="user-avatar" alt="" /> : <div className="user-avatar placeholder-avatar">{u.nombreApellidos?.charAt(0)}</div>}
                  <span>{u.nombreApellidos}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Admin Pairing Modal */}
      {adminPairingModal && (
        <div className="modal-overlay" onClick={() => setAdminPairingModal(false)}>
          <div className="modal-body" onClick={e => e.stopPropagation()}>
            <h3>Crear Pareja Manual</h3>
            <div className="pair-select">
              <div className="pair-slot" onClick={() => setSelectingPlayer('p1')}>
                {p1 ? <span>{p1.nombreApellidos}</span> : <span className="empty">Jugador 1</span>}
              </div>
              <span>&</span>
              <div className="pair-slot" onClick={() => setSelectingPlayer('p2')}>
                {p2 ? <span>{p2.nombreApellidos}</span> : <span className="empty">Jugador 2</span>}
              </div>
            </div>
            <div className="user-list">
              {allUsers.filter(u => !teams.find(t => t.player1Id === u.id || t.player2Id === u.id) && u.id !== p1?.id && u.id !== p2?.id).map(u => (
                <div key={u.id} className="user-item" onClick={() => selectingPlayer === 'p1' ? setP1(u) : setP2(u)}>
                  <span>{u.nombreApellidos}</span>
                </div>
              ))}
            </div>
            <button className="btn btn-primary full" onClick={adminCreatePair} disabled={!p1 || !p2}>Crear Pareja</button>
          </div>
        </div>
      )}

      {/* Override Result Modal */}
      {overrideModal && (
        <div className="modal-overlay" onClick={() => setOverrideModal(false)}>
          <div className="modal-body" onClick={e => e.stopPropagation()}>
            <h3>Introducir Resultado</h3>
            <p className="result-match-name">{selectedMatch?.team1Name || selectedMatch?.teamA?.name} vs {selectedMatch?.team2Name || selectedMatch?.teamB?.name}</p>
            {matchSets.map((s, i) => (
              <div key={i} className="set-row">
                <span>Set {i + 1}</span>
                <input className="set-input" type="number" value={s.t1} onChange={e => { const ns = [...matchSets]; ns[i].t1 = e.target.value; setMatchSets(ns); }} />
                <span>-</span>
                <input className="set-input" type="number" value={s.t2} onChange={e => { const ns = [...matchSets]; ns[i].t2 = e.target.value; setMatchSets(ns); }} />
              </div>
            ))}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setOverrideModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={overrideResult}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Modal */}
      {calendarModal && selectedMatch && (
        <div className="modal-overlay" onClick={() => setCalendarModal(false)}>
          <div className="modal-body calendar-modal" onClick={e => e.stopPropagation()}>
            <h3>📅 Proponer Horario</h3>
            <p className="cal-match">{selectedMatch.team1Name} vs {selectedMatch.team2Name}</p>

            <div className="cal-legend">
              <span className="legend-item"><span className="dot proposed"></span> Propuesto</span>
              <span className="legend-item"><span className="dot vetoed"></span> Vetado</span>
              <span className="legend-item"><span className="dot blocked"></span> Ocupado</span>
            </div>

            <div className="cal-include-partner">
              <span>Incluir a mi pareja</span>
              <label className="toggle"><input type="checkbox" checked={includePartner} onChange={() => setIncludePartner(!includePartner)} /><span className="toggle-slider"></span></label>
            </div>

            <div className="cal-slots">
              {availableSlots.map(slot => {
                const dateStr = `${getNextDayDate(slot.day)} ${slot.start}`;
                const blocked = isSlotBlocked(dateStr);
                const proposed = myProposedSlots.includes(dateStr);
                const vetoed = myVetoedSlots.includes(dateStr);
                return (
                  <button
                    key={slot.id}
                    className={`cal-slot ${blocked ? 'blocked' : ''} ${proposed ? 'proposed' : ''} ${vetoed ? 'vetoed' : ''}`}
                    onClick={() => cycleSlot(dateStr)}
                    disabled={blocked}
                  >
                    {blocked && <Lock size={14} />}
                    <span className="slot-day">{slot.day}</span>
                    <span className="slot-time">{slot.start}</span>
                    {proposed && <Check size={14} className="slot-check" />}
                    {vetoed && <X size={14} className="slot-x" />}
                  </button>
                );
              })}
            </div>

            <button className="btn btn-primary full" onClick={submitProposals} disabled={submittingProposals}>
              {submittingProposals ? 'Guardando...' : 'Guardar Propuestas'}
            </button>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal.show && (
        <div className="modal-overlay" onClick={() => setConfirmModal({ ...confirmModal, show: false })}>
          <div className="modal-body" onClick={e => e.stopPropagation()}>
            <h3>{confirmModal.title}</h3>
            <p>{confirmModal.msg}</p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setConfirmModal({ ...confirmModal, show: false })}>Cancelar</button>
              <button className="btn btn-danger" onClick={() => { confirmModal.onOk(); setConfirmModal({ ...confirmModal, show: false }); }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
