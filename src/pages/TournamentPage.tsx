import { useEffect, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Info,
  Link2,
  Pencil,
  RotateCcw,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { db } from '../services/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LanguageContext';
import AvatarPreviewModal from '../components/AvatarPreviewModal';
import { sendCategorizedPushNotification, sendConfiguredPushNotification } from '../services/PushService';
import './Tournament.css';

const TOURNAMENT_DOC = 'currentTournament';
const DAYS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const checkTimeOverlap = (dateA: string, timeA: string, dateB: string, timeB: string) => {
  const shortA = dateA.substring(0, 5);
  const shortB = dateB.length > 5 ? dateB.substring(0, 5) : dateB;
  if (shortA !== shortB) return false;

  const toMinutes = (value: string) => {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  };

  const startA = toMinutes(timeA);
  const startB = toMinutes(timeB);
  return Math.max(startA, startB) < Math.min(startA + 90, startB + 90);
};

const initialSetState = () => [{ t1: '', t2: '' }, { t1: '', t2: '' }, { t1: '', t2: '' }];

export default function TournamentPage() {
  const { user } = useAuth();
  const { primaryColor, colors, autoApproveTournament } = useTheme();
  const { t } = useTranslation();

  const RULES = [
    { icon: '1️⃣', title: t('rule_1_title'), text: t('rule_1_text') },
    { icon: '2️⃣', title: t('rule_2_title'), text: t('rule_2_text') },
    { icon: '3️⃣', title: t('rule_3_title'), text: t('rule_3_text') },
    { icon: '⚡', title: t('rule_4_title'), text: t('rule_4_text') },
    { icon: '🏆', title: t('rule_5_title'), text: t('rule_5_text') },
  ];

  const [tournament, setTournament] = useState<any>(null);
  const [teams, setTeams] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rulesVisible, setRulesVisible] = useState(false);
  const [partnerModalVisible, setPartnerModalVisible] = useState(false);
  const [myTeam, setMyTeam] = useState<any>(null);
  const [pendingInvite, setPendingInvite] = useState<any>(null);

  const [adminPairingVisible, setAdminPairingVisible] = useState(false);
  const [p1, setP1] = useState<any>(null);
  const [p2, setP2] = useState<any>(null);
  const [selectingPlayer, setSelectingPlayer] = useState<'p1' | 'p2'>('p1');

  const [overrideModalVisible, setOverrideModalVisible] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [matchSets, setMatchSets] = useState(initialSetState());

  const [editTeamModalVisible, setEditTeamModalVisible] = useState(false);
  const [editingTeam, setEditingTeam] = useState<any>(null);
  const [editTeamName, setEditTeamName] = useState('');
  const [savingTeam, setSavingTeam] = useState(false);

  const [renameMyTeamVisible, setRenameMyTeamVisible] = useState(false);
  const [myTeamNewName, setMyTeamNewName] = useState('');

  const [calendarModalVisible, setCalendarModalVisible] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<any[]>([]);
  const [matchesPerWeek, setMatchesPerWeek] = useState(1);
  const [submittingProposals, setSubmittingProposals] = useState(false);
  const [includePartner, setIncludePartner] = useState(false);
  const [myProposedSlots, setMyProposedSlots] = useState<string[]>([]);
  const [myVetoedSlots, setMyVetoedSlots] = useState<string[]>([]);
  const [slotActionVisible, setSlotActionVisible] = useState<{ visible: boolean; dateStr: string }>({ visible: false, dateStr: '' });
  const [globalMatches, setGlobalMatches] = useState<any[]>([]);

  const [confirmModalConfig, setConfirmModalConfig] = useState({
    visible: false,
    title: '',
    message: '',
    confirmText: '',
    confirmColor: colors.danger,
    onConfirm: () => {},
  });

  const [startPhaseModalVisible, setStartPhaseModalVisible] = useState(false);
  const [startPhaseDate, setStartPhaseDate] = useState(() => new Date());
  const [adminMatchOptionsVisible, setAdminMatchOptionsVisible] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<{ imageUrl: string; alt: string } | null>(null);

  useEffect(() => {
    const unsubscribeTournament = onSnapshot(doc(db, 'tournament', TOURNAMENT_DOC), (snapshot) => {
      setTournament(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
      setLoading(false);
    });

    const unsubscribeTeams = onSnapshot(collection(db, 'tournamentTeams'), (snapshot) => {
      const data: any[] = snapshot.docs.map((entry) => ({ id: entry.id, ...(entry.data() as any) }));
      setTeams(data);
      const mine = data.find((entry) => entry.player1Id === user?.uid || entry.player2Id === user?.uid);
      setMyTeam(mine || null);
      const invite = data.find((entry) => entry.player2Id === user?.uid && entry.status === 'pending');
      setPendingInvite(invite || null);
    });

    const unsubscribeSlots = onSnapshot(doc(db, 'config', 'tournamentSlots'), (snapshot) => {
      if (snapshot.exists()) {
        setAvailableSlots(snapshot.data().slots || []);
        if (snapshot.data().matchesPerWeek) setMatchesPerWeek(snapshot.data().matchesPerWeek);
      }
    });

    const unsubscribeMatches = onSnapshot(collection(db, 'matches'), (snapshot) => {
      setGlobalMatches(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    });

    getDocs(collection(db, 'users')).then((snapshot) => {
      setAllUsers(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    });

    return () => {
      unsubscribeTournament();
      unsubscribeTeams();
      unsubscribeSlots();
      unsubscribeMatches();
    };
  }, [user?.uid]);

  const startPhase2 = async () => {
    setStartPhaseModalVisible(false);
    await setDoc(doc(db, 'tournament', TOURNAMENT_DOC), { phase: 'phase2', startedAt: startPhaseDate.toISOString() }, { merge: true });
    await generateRoundRobinSchedule();
  };

  const setPhase = async (phase: string) => {
    if (phase === 'phase2') {
      setStartPhaseModalVisible(true);
      return;
    }

    await setDoc(doc(db, 'tournament', TOURNAMENT_DOC), { phase, startedAt: new Date().toISOString() }, { merge: true });
    if (phase === 'phase3') await generateBracket();
  };

  const goBackPhase = () => {
    const phases = ['pending', 'phase1', 'phase2', 'phase3'];
    const currentPhase = tournament?.phase;
    const currentIndex = phases.indexOf(currentPhase);
    if (!currentPhase || currentIndex < 1) {
      window.alert(`Sin cambios\n\nFase: "${currentPhase || 'desconocida'}". No se puede retroceder.`);
      return;
    }

    const previousPhase = phases[currentIndex - 1];
    setConfirmModalConfig({
      visible: true,
      title: 'Retroceder Fase',
      message: `¿Seguro que quieres volver de "${currentPhase}" a "${previousPhase}"?`,
      confirmText: 'Retroceder',
      confirmColor: colors.danger,
      onConfirm: async () => {
        try {
          await updateDoc(doc(db, 'tournament', TOURNAMENT_DOC), { phase: previousPhase });
        } catch (error: any) {
          window.alert(`Error\n\n${error.message}`);
        }
      },
    });
  };

  const resetTournament = () => {
    setConfirmModalConfig({
      visible: true,
      title: 'Resetear Torneo',
      message: '¿Seguro que quieres borrar TODOS los datos del torneo, incluyendo equipos inscritos, calendario y resultados? ¡Esta acción es irreversible!',
      confirmText: 'Sí, Resetear',
      confirmColor: colors.danger,
      onConfirm: async () => {
        try {
          const teamsSnapshot = await getDocs(collection(db, 'tournamentTeams'));
          await Promise.all(teamsSnapshot.docs.map((entry) => deleteDoc(doc(db, 'tournamentTeams', entry.id))));

          const matchesSnapshot = await getDocs(collection(db, 'matches'));
          const tournamentMatches = matchesSnapshot.docs.filter((entry) => Boolean(entry.data().isTournament) || Boolean(entry.data().tournamentMatchId));
          await Promise.all(tournamentMatches.map((entry) => deleteDoc(doc(db, 'matches', entry.id))));

          await setDoc(doc(db, 'tournament', TOURNAMENT_DOC), { phase: 'pending', startedAt: null, schedule: [], bracket: {} });
          window.alert('Torneo Reseteado\n\nSe ha vaciado el torneo por completo y cancelado todos los cruces abiertos.');
        } catch (error: any) {
          window.alert(`Error\n\n${error.message}`);
        }
      },
    });
  };

  const generateRoundRobinSchedule = async () => {
    const confirmedTeams = teams.filter((entry) => entry.status === 'confirmed');
    if (confirmedTeams.length < 2) return;

    let matchesPerWeekConfig = matchesPerWeek;
    try {
      const configSnapshot = await getDoc(doc(db, 'config', 'tournamentSlots'));
      if (configSnapshot.exists() && configSnapshot.data().matchesPerWeek) {
        matchesPerWeekConfig = configSnapshot.data().matchesPerWeek;
      }
    } catch {
      // noop
    }

    const existingSchedule = tournament?.schedule || [];
    if (existingSchedule.length > 0) {
      const teamsInSchedule = new Set<string>();
      existingSchedule.forEach((match: any) => {
        teamsInSchedule.add(match.team1Id);
        teamsInSchedule.add(match.team2Id);
      });
      teamsInSchedule.delete('dummy');

      const sameComposition = confirmedTeams.every((entry) => teamsInSchedule.has(entry.id)) && confirmedTeams.length === teamsInSchedule.size;
      if (sameComposition) return;
    }

    const teamRefs = [...confirmedTeams];
    if (teamRefs.length % 2 !== 0) {
      teamRefs.push({ id: 'dummy', name: 'Descanso', status: 'dummy' });
    }

    const totalTeams = teamRefs.length;
    const roundGroups: any[] = [];

    for (let round = 0; round < totalTeams - 1; round += 1) {
      const roundMatches: any[] = [];
      for (let index = 0; index < totalTeams / 2; index += 1) {
        const teamA = teamRefs[index];
        const teamB = teamRefs[totalTeams - 1 - index];
        if (teamA.id !== 'dummy' && teamB.id !== 'dummy') {
          roundMatches.push({ teamA, teamB });
        }
      }
      roundGroups.push(roundMatches);

      const lastTeam = teamRefs.pop();
      if (lastTeam) teamRefs.splice(1, 0, lastTeam);
    }

    const newMatchups: any[] = [];
    roundGroups.forEach((roundMatches, roundIndex) => {
      const week = Math.floor(roundIndex / matchesPerWeekConfig) + 1;
      roundMatches.forEach(({ teamA, teamB }: any) => {
        newMatchups.push({
          id: `${teamA.id}_${teamB.id}`,
          team1Id: teamA.id,
          team1Name: teamA.name,
          team2Id: teamB.id,
          team2Name: teamB.name,
          status: 'pending',
          result: null,
          week,
        });
      });
    });

    await setDoc(doc(db, 'tournament', TOURNAMENT_DOC), { schedule: newMatchups }, { merge: true });
  };

  const getStandings = () => {
    const confirmedTeams = teams.filter((entry) => entry.status === 'confirmed');
    const schedule = tournament?.schedule || [];

    return confirmedTeams
      .map((team) => {
        const matches = schedule.filter(
          (entry: any) => entry.status === 'confirmed' && (entry.team1Id === team.id || entry.team2Id === team.id),
        );
        const wins = matches.filter((entry: any) => entry.winnerId === team.id).length;
        return { ...team, pts: wins, wins, played: matches.length };
      })
      .sort((left, right) => right.pts - left.pts || right.wins - left.wins);
  };

  const generateBracket = async () => {
    if (tournament?.bracket?.quarterfinals?.length > 0) return;
    const standings = getStandings();
    const top8 = standings.slice(0, 8);
    const seed = (index: number) => top8[index] ?? null;

    const bracket = {
      quarterfinals: [
        { id: 'qf1', teamA: seed(0), teamB: seed(7) },
        { id: 'qf2', teamA: seed(1), teamB: seed(6) },
        { id: 'qf3', teamA: seed(2), teamB: seed(5) },
        { id: 'qf4', teamA: seed(3), teamB: seed(4) },
      ],
      semifinals: [],
      final: {},
    };
    await setDoc(doc(db, 'tournament', TOURNAMENT_DOC), { bracket }, { merge: true });
  };

  const requestPartner = async (partnerId: string) => {
    try {
      const partner = allUsers.find((entry) => entry.id === partnerId);
      await addDoc(collection(db, 'tournamentTeams'), {
        player1Id: user?.uid,
        player1Name: user?.nombreApellidos,
        player1Photo: user?.fotoURL || null,
        player2Id: partnerId,
        player2Name: partner?.nombreApellidos,
        player2Photo: partner?.fotoURL || null,
        name: `${user?.nombreApellidos?.split(' ')[0]} / ${partner?.nombreApellidos?.split(' ')[0]}`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      });
      setPartnerModalVisible(false);
      window.alert(`Solicitud Enviada\n\nSe ha notificado a ${partner?.nombreApellidos} para que acepte la pareja.`);

      if (partner?.id) {
        const inviteBody = `${user?.nombreApellidos?.split(' ')[0]} te ha invitado a jugar el torneo como su pareja.`;
        await sendConfiguredPushNotification(
          [partner.id],
          'invitations',
          '¡Nueva Invitación al Torneo!',
          inviteBody,
          {
            actorName: user?.nombreApellidos?.split(' ')[0],
            targetName: partner?.nombreApellidos,
          },
        );
      }
    } catch (error: any) {
      window.alert(`Error\n\n${error.message}`);
    }
  };

  const acceptInvite = async () => {
    if (!pendingInvite) return;
    await updateDoc(doc(db, 'tournamentTeams', pendingInvite.id), { status: 'confirmed' });
    setPendingInvite(null);
  };

  const declineInvite = async () => {
    if (!pendingInvite) return;
    await deleteDoc(doc(db, 'tournamentTeams', pendingInvite.id));
    setPendingInvite(null);
  };

  const adminCreatePair = async () => {
    if (!p1 || !p2) return;
    try {
      await addDoc(collection(db, 'tournamentTeams'), {
        player1Id: p1.id,
        player1Name: p1.nombreApellidos,
        player1Photo: p1.fotoURL || null,
        player2Id: p2.id,
        player2Name: p2.nombreApellidos,
        player2Photo: p2.fotoURL || null,
        name: `${p1.nombreApellidos?.split(' ')[0]} / ${p2.nombreApellidos?.split(' ')[0]}`,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
      });
      setAdminPairingVisible(false);
      setP1(null);
      setP2(null);
    } catch (error: any) {
      window.alert(`Error\n\n${error.message}`);
    }
  };

  const deleteTeam = (teamId: string, teamName: string) => {
    setConfirmModalConfig({
      visible: true,
      title: 'Eliminar Pareja',
      message: `¿Quieres borrar la pareja "${teamName}" del torneo?`,
      confirmText: 'Eliminar',
      confirmColor: colors.danger,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'tournamentTeams', teamId));
        } catch (error: any) {
          window.alert(`Error al eliminar\n\n${error.message}`);
        }
      },
    });
  };

  const renameMyTeam = async () => {
    if (!myTeam || !myTeamNewName.trim()) return;
    try {
      await updateDoc(doc(db, 'tournamentTeams', myTeam.id), { name: myTeamNewName.trim() });
      setRenameMyTeamVisible(false);
    } catch (error: any) {
      window.alert(`Error\n\n${error.message}`);
    }
  };

  const updateTeam = async () => {
    if (!editingTeam) return;
    setSavingTeam(true);
    try {
      await updateDoc(doc(db, 'tournamentTeams', editingTeam.id), {
        name: editTeamName.trim() || editingTeam.name,
        player1Id: p1?.id || editingTeam.player1Id,
        player1Name: p1?.nombreApellidos || editingTeam.player1Name,
        player1Photo: p1?.fotoURL || editingTeam.player1Photo || null,
        player2Id: p2?.id || editingTeam.player2Id,
        player2Name: p2?.nombreApellidos || editingTeam.player2Name,
        player2Photo: p2?.fotoURL || editingTeam.player2Photo || null,
      });
      setEditTeamModalVisible(false);
      setEditingTeam(null);
      setP1(null);
      setP2(null);
    } catch (error: any) {
      window.alert(`Error\n\n${error.message}`);
    } finally {
      setSavingTeam(false);
    }
  };

  const resetScheduledMatch = async (match: any) => {
    if (!myTeam && user?.role !== 'admin') return;
    setConfirmModalConfig({
      visible: true,
      title: 'Cambiar Horario',
      message: '¿Seguro que quieres cancelar la fecha acordada? Se abrirá de nuevo la negociación con el rival.',
      confirmText: 'Sí, cambiar',
      confirmColor: colors.danger,
      onConfirm: async () => {
        try {
          const isBracket = match.phase === 'bracket';
          if (!isBracket) {
            const schedule = [...(tournament.schedule || [])];
            const index = schedule.findIndex((entry: any) => entry.id === match.id);
            if (index === -1) return;
            schedule[index] = { ...schedule[index], status: 'pending', date: null };
            await updateDoc(doc(db, 'tournament', TOURNAMENT_DOC), { schedule });
          } else {
            const bracket = { ...tournament.bracket };
            const [roundName, roundIndex] = match.bracketPath;
            const currentMatch = roundName === 'final' ? { ...bracket.final } : { ...bracket[roundName][roundIndex] };
            currentMatch.status = 'pending';
            currentMatch.date = null;
            if (roundName === 'final') bracket.final = currentMatch;
            else bracket[roundName][roundIndex] = currentMatch;
            await updateDoc(doc(db, 'tournament', TOURNAMENT_DOC), { bracket });
          }

          const tournamentMatches = await getDocs(query(collection(db, 'matches'), where('tournamentMatchId', '==', match.id)));
          tournamentMatches.forEach((entry) => {
            deleteDoc(doc(db, 'matches', entry.id)).catch(() => {});
          });
        } catch (error: any) {
          window.alert(`Error\n\n${error.message}`);
        }
      },
    });
  };

  const resetPlayedMatch = async (match: any) => {
    if (user?.role !== 'admin') return;
    setConfirmModalConfig({
      visible: true,
      title: 'Resetear Partido',
      message: '¿Seguro que quieres anular el resultado de este partido? Volverá a estado "por disputar". Si tiene consecuencias en fases posteriores, se limpiarán.',
      confirmText: 'Sí, resetear',
      confirmColor: colors.danger,
      onConfirm: async () => {
        try {
          const isBracket = match.phase === 'bracket';
          if (!isBracket) {
            const schedule = [...(tournament.schedule || [])];
            const index = schedule.findIndex((entry: any) => entry.id === match.id);
            if (index === -1) return;
            const resetMatch = { ...schedule[index] };
            delete resetMatch.sets;
            delete resetMatch.winnerId;
            resetMatch.status = 'pending';
            schedule[index] = resetMatch;
            await updateDoc(doc(db, 'tournament', TOURNAMENT_DOC), { schedule });
          } else {
            const bracket = { ...tournament.bracket };
            const [roundName, roundIndex] = match.bracketPath;
            const resetMatch = roundName === 'final' ? { ...bracket.final } : { ...bracket[roundName][roundIndex] };
            delete resetMatch.sets;
            delete resetMatch.winnerId;
            resetMatch.status = 'pending';

            if (roundName === 'final') {
              bracket.final = resetMatch;
            } else {
              bracket[roundName][roundIndex] = resetMatch;
            }

            if (roundName === 'quarterfinals') {
              bracket.semifinals = [];
              bracket.final = {};
            } else if (roundName === 'semifinals') {
              if (bracket.final && bracket.final.id) {
                const oldWinnerId = match.winnerId;
                if (oldWinnerId) {
                  if (bracket.final.teamA?.id === oldWinnerId) delete bracket.final.teamA;
                  if (bracket.final.teamB?.id === oldWinnerId) delete bracket.final.teamB;
                }
                if (!bracket.final.teamA && !bracket.final.teamB) bracket.final = {};
              }
            }

            await updateDoc(doc(db, 'tournament', TOURNAMENT_DOC), { bracket });
          }

          const tournamentMatches = await getDocs(query(collection(db, 'matches'), where('tournamentMatchId', '==', match.id)));
          tournamentMatches.forEach((entry) => {
            deleteDoc(doc(db, 'matches', entry.id)).catch(() => {});
          });
        } catch (error: any) {
          window.alert(`Error\n\n${error.message}`);
        }
      },
    });
  };

  const notifyAdminOnOverlap = async (matchDescription: string, overlap: string) => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const adminIds = usersSnapshot.docs
        .map((entry) => ({ uid: entry.id, ...entry.data() }))
        .filter((entry: any) => entry.role === 'admin' && !!entry.pushToken)
        .map((entry: any) => entry.uid);

      if (adminIds.length > 0) {
        await sendCategorizedPushNotification(
          adminIds,
          '⚡ Coincidencia de torneo',
          `Los 4 jugadores de ${matchDescription} pueden jugar el ${overlap}. ¡Apuébalo!`,
          'always',
        );
      }
    } catch (error) {
      console.error('[AdminPush] Error sending push to admins', error);
    }
  };

  const submitProposals = async () => {
    if (!myTeam || !selectedMatch || !user?.uid) return;
    setSubmittingProposals(true);

    try {
      const isBracket = selectedMatch.phase === 'bracket';
      const schedule = [...(tournament.schedule || [])];
      let match: any;
      let matchIndex = -1;

      if (!isBracket) {
        matchIndex = schedule.findIndex((entry: any) => entry.id === selectedMatch.id);
        if (matchIndex === -1) return;
        match = { ...schedule[matchIndex] };
      } else {
        const [roundName, roundIndex] = selectedMatch.bracketPath;
        match = roundName === 'final' ? { ...(tournament.bracket?.final || {}) } : { ...tournament.bracket[roundName][roundIndex] };
      }

      const playerAvailability = { ...(match.playerAvailability || {}) };
      playerAvailability[user.uid] = { proposed: myProposedSlots, vetoed: myVetoedSlots };

      if (includePartner) {
        const partnerId = myTeam.player1Id === user.uid ? myTeam.player2Id : myTeam.player1Id;
        if (partnerId) {
          playerAvailability[partnerId] = { proposed: myProposedSlots, vetoed: myVetoedSlots };
        }
      }

      match.playerAvailability = playerAvailability;

      const playerIds: string[] = [];
      const team1 = teams.find((entry) => entry.id === match.team1Id || entry.id === match.teamA?.id);
      const team2 = teams.find((entry) => entry.id === match.team2Id || entry.id === match.teamB?.id);
      if (team1) {
        playerIds.push(team1.player1Id);
        if (team1.player2Id) playerIds.push(team1.player2Id);
      }
      if (team2) {
        playerIds.push(team2.player1Id);
        if (team2.player2Id) playerIds.push(team2.player2Id);
      }

      const allProposedSlots = new Set<string>();
      playerIds.forEach((id) => {
        playerAvailability[id]?.proposed?.forEach((slot: string) => allProposedSlots.add(slot));
      });

      let overlap: string | null = null;
      for (const slot of Array.from(allProposedSlots)) {
        let consensus = true;
        for (const id of playerIds) {
          if (!playerAvailability[id] || !playerAvailability[id].proposed.includes(slot)) {
            consensus = false;
            break;
          }
        }
        if (consensus) {
          overlap = slot;
          break;
        }
      }

      if (overlap) {
        const [matchDate, matchTime] = overlap.split(' ');
        match.status = 'scheduled';
        match.date = overlap;

        if (autoApproveTournament) {
          if (team1 && team2) {
            await addDoc(collection(db, 'matches'), {
              fecha: matchDate.substring(0, 5),
              hora: matchTime,
              creadorId: 'admin',
              creadorNombre: 'Torneo',
              listaParticipantes: [team1.player1Id, team1.player2Id, team2.player1Id, team2.player2Id].filter(Boolean),
              listaInvitados: [],
              isTournament: true,
              tournamentMatchId: match.id,
              createdAt: new Date().toISOString(),
            });
          }
          window.alert(`${t('overlap_found')}\n\n${t('match_scheduled')} ${matchDate} ${matchTime}`);
        } else {
          const matchDescription = `${team1?.name || '?'} vs ${team2?.name || '?'}`;
          await notifyAdminOnOverlap(matchDescription, overlap);
          window.alert(`⚡ ¡Coincidencia!\n\nSe ha encontrado coincidencia el ${overlap}. Se notificará al administrador para que lo apruebe.`);
        }
      }

      if (!isBracket) {
        schedule[matchIndex] = match;
        await updateDoc(doc(db, 'tournament', TOURNAMENT_DOC), { schedule });
      } else {
        const bracket = { ...tournament.bracket };
        const [roundName, roundIndex] = selectedMatch.bracketPath;
        if (roundName === 'final') bracket.final = match;
        else bracket[roundName][roundIndex] = match;
        await updateDoc(doc(db, 'tournament', TOURNAMENT_DOC), { bracket });
      }

      setCalendarModalVisible(false);
      setMyProposedSlots([]);
      setMyVetoedSlots([]);
      setIncludePartner(false);
    } catch (error: any) {
      window.alert(`Error\n\n${error.message}`);
    } finally {
      setSubmittingProposals(false);
    }
  };

  const forceAdminSchedule = async (forcedDate: string) => {
    if (!selectedMatch) return;
    setSubmittingProposals(true);
    try {
      const isBracket = selectedMatch.phase === 'bracket';
      const schedule = [...(tournament?.schedule || [])];
      let match: any;
      let matchIndex = -1;

      if (!isBracket) {
        matchIndex = schedule.findIndex((entry: any) => entry.id === selectedMatch.id);
        if (matchIndex === -1) return;
        match = { ...schedule[matchIndex] };
      } else {
        const [roundName, roundIndex] = selectedMatch.bracketPath;
        match = roundName === 'final' ? { ...(tournament.bracket?.final || {}) } : { ...tournament.bracket[roundName][roundIndex] };
      }

      const [matchDate, matchTime] = forcedDate.split(' ');
      match.status = 'scheduled';
      match.date = forcedDate;

      const team1 = match.teamA || teams.find((entry) => entry.id === match.team1Id);
      const team2 = match.teamB || teams.find((entry) => entry.id === match.team2Id);

      if (team1 && team2) {
        await addDoc(collection(db, 'matches'), {
          fecha: matchDate.substring(0, 5),
          hora: matchTime,
          creadorId: 'admin',
          creadorNombre: 'Torneo',
          listaParticipantes: [team1.player1Id, team1.player2Id, team2.player1Id, team2.player2Id].filter(Boolean),
          listaInvitados: [],
          isTournament: true,
          tournamentMatchId: match.id,
          createdAt: new Date().toISOString(),
        });
      }

      if (!isBracket) {
        schedule[matchIndex] = match;
        await updateDoc(doc(db, 'tournament', TOURNAMENT_DOC), { schedule });
      } else {
        const bracket = { ...tournament.bracket };
        const [roundName, roundIndex] = selectedMatch.bracketPath;
        if (roundName === 'final') bracket.final = match;
        else bracket[roundName][roundIndex] = match;
        await updateDoc(doc(db, 'tournament', TOURNAMENT_DOC), { bracket });
      }

      window.alert(`Horario Fijado\n\nSe ha forzado el partido para el ${forcedDate}`);
      setSlotActionVisible({ visible: false, dateStr: '' });
      setCalendarModalVisible(false);
      setMyProposedSlots([]);
      setMyVetoedSlots([]);
    } catch (error: any) {
      window.alert(`Error\n\n${error.message}`);
    } finally {
      setSubmittingProposals(false);
    }
  };

  const overrideResult = async () => {
    if (!selectedMatch) return;
    const selectedId1 = selectedMatch.team1Id || selectedMatch.teamA?.id;
    const selectedId2 = selectedMatch.team2Id || selectedMatch.teamB?.id;
    const implicatedTeam = myTeam?.id && (selectedId1 === myTeam.id || selectedId2 === myTeam.id);
    if (user?.role !== 'admin' && !implicatedTeam) return;

    const validSets = matchSets.filter((set) => set.t1 !== '' && set.t2 !== '');
    if (validSets.length === 0) {
      window.alert('Error\n\nDebes introducir al menos un set válido.');
      return;
    }

    let team1Wins = 0;
    let team2Wins = 0;
    validSets.forEach((set) => {
      const score1 = parseInt(set.t1, 10);
      const score2 = parseInt(set.t2, 10);
      if (score1 > score2) team1Wins += 1;
      else if (score2 > score1) team2Wins += 1;
    });

    const id1 = selectedMatch.team1Id || selectedMatch.teamA?.id;
    const id2 = selectedMatch.team2Id || selectedMatch.teamB?.id;
    let winnerId = null;
    if (team1Wins > team2Wins) winnerId = id1;
    else if (team2Wins > team1Wins) winnerId = id2;

    try {
      if (selectedMatch.phase === 'bracket') {
        const bracket = { ...tournament.bracket };
        const [roundName, roundIndex] = selectedMatch.bracketPath;
        const updatedMatch = roundName === 'final' ? { ...bracket.final } : { ...bracket[roundName][roundIndex] };
        updatedMatch.status = 'confirmed';
        updatedMatch.sets = validSets.map((set) => ({ team1: parseInt(set.t1, 10), team2: parseInt(set.t2, 10) }));
        updatedMatch.winnerId = winnerId;

        if (roundName === 'final') bracket.final = updatedMatch;
        else bracket[roundName][roundIndex] = updatedMatch;

        const teamA = updatedMatch.teamA || teams.find((entry) => entry.id === updatedMatch.team1Id);
        const teamB = updatedMatch.teamB || teams.find((entry) => entry.id === updatedMatch.team2Id);
        const winnerTeam = winnerId === (teamA?.id || updatedMatch.team1Id) ? teamA : teamB;

        if (roundName === 'quarterfinals' && winnerTeam) {
          const allQuarterfinals = bracket.quarterfinals || [];
          const finishedCount = allQuarterfinals.filter((entry: any) => entry.winnerId || (entry.id === updatedMatch.id && winnerId)).length;
          if (finishedCount === 4 && (!bracket.semifinals || bracket.semifinals.length === 0)) {
            const winners = allQuarterfinals.map((entry: any) => {
              const currentWinnerId = entry.id === updatedMatch.id ? winnerId : entry.winnerId;
              const currentTeamA = entry.teamA || teams.find((team) => team.id === entry.team1Id);
              const currentTeamB = entry.teamB || teams.find((team) => team.id === entry.team2Id);
              return currentWinnerId === (currentTeamA?.id || entry.team1Id) ? currentTeamA : currentTeamB;
            });
            winners.sort(() => Math.random() - 0.5);
            bracket.semifinals = [
              { id: 'sf1', teamA: winners[0], teamB: winners[1] },
              { id: 'sf2', teamA: winners[2], teamB: winners[3] },
            ];
          }
        } else if (roundName === 'semifinals' && winnerTeam) {
          if (!bracket.final) bracket.final = { id: 'final' };
          if (roundIndex === 0) bracket.final.teamA = winnerTeam;
          else bracket.final.teamB = winnerTeam;
        }

        await updateDoc(doc(db, 'tournament', TOURNAMENT_DOC), { bracket });
      } else {
        const schedule = tournament.schedule.map((entry: any) => {
          if (entry.id === selectedMatch.id) {
            return {
              ...entry,
              status: 'confirmed',
              sets: validSets.map((set) => ({ team1: parseInt(set.t1, 10), team2: parseInt(set.t2, 10) })),
              winnerId,
            };
          }
          return entry;
        });
        await updateDoc(doc(db, 'tournament', TOURNAMENT_DOC), { schedule });
      }

      const tournamentMatches = await getDocs(query(collection(db, 'matches'), where('tournamentMatchId', '==', selectedMatch.id)));
      tournamentMatches.forEach((entry) => {
        deleteDoc(doc(db, 'matches', entry.id)).catch(() => {});
      });

      setOverrideModalVisible(false);
      setSelectedMatch(null);
      setMatchSets(initialSetState());
    } catch (error: any) {
      window.alert(`Error\n\n${error.message}`);
    }
  };

  const openCalendarForMatch = (match: any) => {
    setSelectedMatch(match);
    const playerAvailability = match.playerAvailability || {};
    const teamProposed = new Set<string>();
    const teamVetoed = new Set<string>();
    if (myTeam?.player1Id && playerAvailability[myTeam.player1Id]) {
      playerAvailability[myTeam.player1Id].proposed?.forEach((slot: string) => teamProposed.add(slot));
      playerAvailability[myTeam.player1Id].vetoed?.forEach((slot: string) => teamVetoed.add(slot));
    }
    if (myTeam?.player2Id && playerAvailability[myTeam.player2Id]) {
      playerAvailability[myTeam.player2Id].proposed?.forEach((slot: string) => teamProposed.add(slot));
      playerAvailability[myTeam.player2Id].vetoed?.forEach((slot: string) => teamVetoed.add(slot));
    }
    setMyProposedSlots(Array.from(teamProposed));
    setMyVetoedSlots(Array.from(teamVetoed));
    setCalendarModalVisible(true);
  };

  const isCalendarSlotBlocked = (dateString: string, timeString: string) => {
    for (const match of globalMatches) {
      if (match.fecha && match.hora && checkTimeOverlap(dateString, timeString, match.fecha, match.hora)) {
        return true;
      }
    }

    for (const match of tournament?.schedule || []) {
      if ((match.status === 'scheduled' || match.status === 'confirmed') && match.date) {
        const [matchDate, matchTime] = match.date.split(' ');
        if (checkTimeOverlap(dateString, timeString, matchDate, matchTime)) return true;
      }
    }

    const layers = [tournament?.bracket?.quarterfinals || [], tournament?.bracket?.semifinals || [], tournament?.bracket?.final ? [tournament.bracket.final] : []];
    for (const layer of layers) {
      for (const match of layer) {
        if ((match.status === 'scheduled' || match.status === 'confirmed') && match.date) {
          const [matchDate, matchTime] = match.date.split(' ');
          if (checkTimeOverlap(dateString, timeString, matchDate, matchTime)) return true;
        }
      }
    }

    return false;
  };

  const renderPhaseContent = () => {
    if (!tournament || tournament.phase === 'pending') {
      return (
        <div className="tournament-empty-state">
          <div className="tournament-empty-emoji">🏆</div>
          <div className="tournament-empty-title">En breves...</div>
          <div className="tournament-empty-subtitle">El próximo torneo de Pádel Sabardes se anunciará próximamente. ¡Mantente atento!</div>
        </div>
      );
    }
    if (tournament.phase === 'phase1') return renderPhase1();
    if (tournament.phase === 'phase2') return renderPhase2();
    if (tournament.phase === 'phase3') return renderPhase3();
    return null;
  };

  const renderPhase1 = () => {
    const confirmedTeams = teams.filter((entry) => entry.status === 'confirmed');
    const availablePartners = allUsers.filter(
      (entry) => entry.id !== user?.uid && !teams.some((team) => team.player1Id === entry.id || team.player2Id === entry.id),
    );

    return (
      <div>
        <div className="tournament-phase-title">Fase 1: Formación de Parejas</div>

        {pendingInvite && (
          <div className="tournament-invite-card" style={{ borderColor: primaryColor }}>
            <div className="tournament-invite-text"><strong>{pendingInvite.player1Name}</strong> te ha invitado a formar pareja 🎾</div>
            <div className="tournament-inline-actions">
              <button className="btn btn-primary" onClick={acceptInvite}>Aceptar</button>
              <button className="btn btn-danger" onClick={declineInvite}>Rechazar</button>
            </div>
          </div>
        )}

        {myTeam ? (
          <div className="tournament-my-team-card" style={{ borderColor: primaryColor }}>
            <Users size={36} color={primaryColor} />
            <div className="tournament-my-team-info">
              <div className="tournament-my-team-label">Mi Pareja</div>
              <div className="tournament-my-team-name-row">
                <div className="tournament-my-team-name">{myTeam.name}</div>
                {myTeam.status === 'confirmed' && (
                  <button onClick={() => { setMyTeamNewName(myTeam.name); setRenameMyTeamVisible(true); }}>
                    <Pencil size={16} color={primaryColor} />
                  </button>
                )}
              </div>
              <span className="tournament-status-badge" style={{ backgroundColor: myTeam.status === 'confirmed' ? primaryColor : colors.border }}>
                {myTeam.status === 'confirmed' ? 'Confirmada ✓' : 'Pendiente de aceptación...'}
              </span>
            </div>
          </div>
        ) : !pendingInvite ? (
          <button className="btn btn-primary full" onClick={() => setPartnerModalVisible(true)}>
            <UserPlus size={20} /> Buscar Pareja
          </button>
        ) : null}

        <div className="section-label" style={{ marginTop: 24 }}>Parejas Confirmadas ({confirmedTeams.length})</div>
        {confirmedTeams.map((team, index) => (
          <div key={team.id} className="tournament-team-row">
            <div className="tournament-team-number" style={{ color: primaryColor }}>#{index + 1}</div>
            <div className="tournament-team-avatar-group">
              {[team.player1Photo, team.player2Photo].map((photo, photoIndex) => (
                photo ? (
                  <img key={`${team.id}-${photoIndex}`} src={photo} alt={photoIndex === 0 ? team.player1Name : team.player2Name} className="tournament-team-avatar" />
                ) : (
                  <div key={`${team.id}-${photoIndex}`} className="tournament-team-avatar tournament-team-avatar-placeholder">
                    {(photoIndex === 0 ? team.player1Name : team.player2Name)?.charAt(0)}
                  </div>
                )
              ))}
            </div>
            <div className="tournament-team-name">{team.name}</div>
            {user?.role === 'admin' && (
              <div className="tournament-team-actions">
                <button
                  onClick={() => {
                    setEditingTeam(team);
                    setEditTeamName(team.name);
                    setP1(allUsers.find((entry) => entry.id === team.player1Id));
                    setP2(allUsers.find((entry) => entry.id === team.player2Id));
                    setEditTeamModalVisible(true);
                  }}
                >
                  <Pencil size={20} color={primaryColor} />
                </button>
                <button onClick={() => deleteTeam(team.id, team.name)}>
                  <Trash2 size={20} color={colors.danger} />
                </button>
              </div>
            )}
          </div>
        ))}

        {partnerModalVisible && (
          <div className="modal-overlay" onClick={() => setPartnerModalVisible(false)}>
            <div className="modal-sheet" onClick={(event) => event.stopPropagation()}>
              <div className="modal-handle"></div>
              <h3 className="tournament-modal-title">Elegir Compañero</h3>
              <div className="tournament-modal-list">
                {availablePartners.map((entry) => (
                  <button key={entry.id} className="tournament-user-row" onClick={() => requestPartner(entry.id)}>
                    {entry.fotoURL ? (
                      <img src={entry.fotoURL} alt={entry.nombreApellidos} className="tournament-user-avatar" />
                    ) : (
                      <div className="tournament-user-avatar tournament-user-avatar-placeholder">{entry.nombreApellidos?.charAt(0)}</div>
                    )}
                    <span>{entry.nombreApellidos}</span>
                    <ChevronRight size={20} color={colors.textDim} />
                  </button>
                ))}
                {availablePartners.length === 0 && <p className="tournament-muted-text">No hay jugadores disponibles.</p>}
              </div>
              <button className="btn btn-danger full" onClick={() => setPartnerModalVisible(false)}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderMatchCard = (match: any, isPlayed: boolean, specialLabel?: string) => {
    const confirmedTeams = teams.filter((entry) => entry.status === 'confirmed');
    const team1 = teams.find((entry) => entry.id === match.team1Id || entry.id === match.teamA?.id);
    const team2 = teams.find((entry) => entry.id === match.team2Id || entry.id === match.teamB?.id);

    if (!team1 && !team2 && match.phase === 'bracket') {
      return (
        <div className="tournament-match-card tournament-match-card-disabled">
          {specialLabel && <div className="tournament-bracket-label" style={{ color: primaryColor }}>{specialLabel}</div>}
          <div className="tournament-muted-text" style={{ padding: 8, margin: 0 }}>Pendiente oponentes...</div>
        </div>
      );
    }

    const id1 = team1?.id || match.team1Id || match.teamA?.id;
    const id2 = team2?.id || match.team2Id || match.teamB?.id;
    let isDelayed = false;

    if (!isPlayed && tournament?.startedAt && match.week) {
      const startedAt = new Date(tournament.startedAt);
      const today = new Date();
      startedAt.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      const weeksSinceStart = Math.floor((today.getTime() - startedAt.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
      if (match.week < weeksSinceStart) isDelayed = true;
    }

    const team1Seed = confirmedTeams.findIndex((entry) => entry.id === id1);
    const team2Seed = confirmedTeams.findIndex((entry) => entry.id === id2);
    const team1Tag = team1Seed >= 0 ? `#${team1Seed + 1} ` : '';
    const team2Tag = team2Seed >= 0 ? `#${team2Seed + 1} ` : '';

    const isTeam1Winner = match.winnerId === id1;
    const isTeam2Winner = match.winnerId === id2;
    const isMyMatch = Boolean(myTeam?.id && (id1 === myTeam.id || id2 === myTeam.id));

    const openMatch = () => {
      setSelectedMatch(match);
      if (user?.role === 'admin') {
        if (!isPlayed) setAdminMatchOptionsVisible(true);
        else {
          setMatchSets(initialSetState());
          setOverrideModalVisible(true);
        }
        return;
      }
      if (isMyMatch) {
        if (!isPlayed) openCalendarForMatch(match);
        else {
          setMatchSets(initialSetState());
          setOverrideModalVisible(true);
        }
      }
    };

    const playerAvailability = match.playerAvailability || {};

    const renderPlayerRow = (team: any, fallbackName: string | undefined, isWinner: boolean, seedTag: string) => (
      <div className="tournament-match-team-row">
        <div className="tournament-match-avatar-group">
          {renderAvatar(team?.player1Photo || null, team?.player1Name || fallbackName || '?')}
          <div className="tournament-match-avatar-overlap">{renderAvatar(team?.player2Photo || null, team?.player2Name || '')}</div>
        </div>
        <div className="tournament-match-name-stack">
          <div className={`tournament-match-name ${isWinner ? 'is-winner' : ''}`} style={isWinner ? { color: primaryColor } : undefined}>
            {!isPlayed && team?.player1Id ? (playerAvailability?.[team.player1Id]?.proposed?.length > 0 ? '✅ ' : '⏳ ') : ''}
            {seedTag}
            {team?.player1Name?.split(' ')[0] || fallbackName || '?'}
          </div>
          {team?.player2Name && (
            <div className={`tournament-match-name ${isWinner ? 'is-winner' : ''}`} style={isWinner ? { color: primaryColor } : undefined}>
              {!isPlayed && team?.player2Id ? (playerAvailability?.[team.player2Id]?.proposed?.length > 0 ? '   ✅ ' : '   ⏳ ') : '     '}
              {team.player2Name?.split(' ')[0]}
            </div>
          )}
        </div>
      </div>
    );

    let rightContent = null;
    if (isPlayed) {
      rightContent = (
        <div className="tournament-match-right">
          <div className="tournament-score-stack">
            <div className="tournament-score-row">
              <span className="tournament-score-trophy">{match.winnerId === id1 ? '🏆' : ''}</span>
              {(match.sets || []).map((set: any, index: number) => (
                <span key={`team1-${index}`} className={`tournament-score ${parseInt(set.team1, 10) > parseInt(set.team2, 10) ? 'is-winner' : ''}`}>{set.team1}</span>
              ))}
            </div>
            <div className="tournament-score-row">
              <span className="tournament-score-trophy">{match.winnerId === id2 ? '🏆' : ''}</span>
              {(match.sets || []).map((set: any, index: number) => (
                <span key={`team2-${index}`} className={`tournament-score ${parseInt(set.team2, 10) > parseInt(set.team1, 10) ? 'is-winner' : ''}`}>{set.team2}</span>
              ))}
            </div>
            {user?.role === 'admin' && (
              <button className="tournament-mini-danger" onClick={(event) => { event.stopPropagation(); resetPlayedMatch(match); }}>
                ↩️ Resetear
              </button>
            )}
          </div>
        </div>
      );
    } else if (match.status === 'scheduled' && isMyMatch) {
      rightContent = (
        <div className="tournament-match-right">
          <div className="tournament-status-pill" style={{ color: primaryColor }}>📅 Agendado</div>
          <button className="tournament-mini-danger" onClick={(event) => { event.stopPropagation(); resetScheduledMatch(match); }}>
            Cambiar Horario
          </button>
        </div>
      );
    } else {
      let customText = 'por jugar';
      let extraButton = null;
      if (!isPlayed && isMyMatch && user?.uid && playerAvailability[user.uid]?.proposed?.length > 0) {
        customText = `🗓️ ${playerAvailability[user.uid].proposed.length} opciones`;
      }

      const isFinal = match.phase === 'bracket' && match.bracketPath?.[0] === 'final';
      if (user?.role === 'admin' && isFinal) {
        extraButton = (
          <button className="tournament-mini-primary" onClick={(event) => { event.stopPropagation(); setSelectedMatch(match); setAdminMatchOptionsVisible(true); }}>
            Fijar Horario
          </button>
        );
      }

      rightContent = (
        <div className="tournament-match-right">
          <div className="tournament-status-pill" style={customText.includes('🗓️') ? { color: primaryColor, backgroundColor: `${primaryColor}22` } : undefined}>{customText}</div>
          {extraButton}
        </div>
      );
    }

    const matchDisabled = user?.role !== 'admin' && !isMyMatch;

    return (
      <div
        className={`tournament-match-card ${isDelayed ? 'is-delayed' : ''} ${matchDisabled ? 'is-disabled' : ''}`}
        role={matchDisabled ? undefined : 'button'}
        tabIndex={matchDisabled ? -1 : 0}
        onClick={matchDisabled ? undefined : openMatch}
        onKeyDown={matchDisabled ? undefined : (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openMatch();
          }
        }}
      >
        <div className="tournament-match-left">
          {specialLabel && <div className="tournament-bracket-label" style={{ color: primaryColor }}>{specialLabel}</div>}
          {renderPlayerRow(team1, match.team1Name || match.teamA?.name, isTeam1Winner, team1Tag)}
          <div className="tournament-match-divider"></div>
          {renderPlayerRow(team2, match.team2Name || match.teamB?.name, isTeam2Winner, team2Tag)}
        </div>

        {rightContent}

        <div className="tournament-match-meta">
          <span>{match.date || `Semana ${match.week || '-'}`}</span>
          {!isPlayed && isDelayed && <span className="tournament-match-delayed">(Retrasado)</span>}
        </div>
      </div>
    );
  };

  const renderPhase2 = () => {
    const standings = getStandings();
    const schedule = tournament?.schedule || [];
    const playedMatches = schedule.filter((entry: any) => entry.status === 'confirmed');
    const pendingMatches = schedule
      .filter((entry: any) => entry.status !== 'confirmed')
      .sort((left: any, right: any) => {
        const myId = myTeam?.id;
        if (!myId) return 0;
        const leftMine = left.team1Id === myId || left.team2Id === myId;
        const rightMine = right.team1Id === myId || right.team2Id === myId;
        if (leftMine && !rightMine) return -1;
        if (!leftMine && rightMine) return 1;
        return (left.week || 0) - (right.week || 0);
      });

    return (
      <div>
        <div className="tournament-phase-title">Fase 2: Clasificación</div>

        <div className="section-label">Tabla de Clasificación</div>
        {standings.map((team, index) => (
          <div key={team.id} className="tournament-standing-row">
            <span className="tournament-standing-pos" style={{ color: index < 8 ? primaryColor : colors.textDim }}>#{index + 1}</span>
            <span className="tournament-standing-name">{team.name}</span>
            <span className="tournament-standing-pts">{team.pts} pts</span>
          </div>
        ))}

        {pendingMatches.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 24 }}>Partidos por disputar</div>
            {pendingMatches.map((match: any, index: number) => <div key={`pending-${index}`}>{renderMatchCard(match, false)}</div>)}
          </>
        )}

        {playedMatches.length > 0 && (
          <>
            <div className="section-label" style={{ marginTop: 24 }}>Partidos disputados</div>
            {playedMatches.map((match: any, index: number) => <div key={`played-${index}`}>{renderMatchCard(match, true)}</div>)}
          </>
        )}
      </div>
    );
  };

  const renderPhase3 = () => {
    const bracket = tournament?.bracket;
    if (!bracket) return <p className="tournament-muted-text">Generando bracket...</p>;

    const quarterfinals = (bracket.quarterfinals || []).map((entry: any, index: number) => ({ ...entry, phase: 'bracket', bracketPath: ['quarterfinals', index] }));
    const semifinals = (bracket.semifinals || []).map((entry: any, index: number) => ({ ...entry, phase: 'bracket', bracketPath: ['semifinals', index] }));
    const finals = bracket.final?.teamA ? [{ ...bracket.final, phase: 'bracket', bracketPath: ['final'] }] : [];

    const isConfirmed = (match: any) => match.status === 'confirmed' || match.winner || match.winnerId;
    const allQuarterfinalsReady = quarterfinals.length > 0 && quarterfinals.every((entry: any) => entry.teamA && entry.teamB && isConfirmed(entry));
    const allSemifinalsReady = semifinals.length > 0 && semifinals.every((entry: any) => entry.teamA && entry.teamB && isConfirmed(entry));

    const renderSection = (title: string, matches: any[], emoji: string) => {
      const playedMatches = matches.filter(isConfirmed);
      const pendingMatches = matches.filter((entry: any) => !isConfirmed(entry));
      return (
        <div key={title}>
          <div className="tournament-round-header">
            <span>{emoji}</span>
            <div className="tournament-phase-title tournament-phase-title-small">{title}</div>
          </div>
          {pendingMatches.map((match: any, index: number) => <div key={`pending-${title}-${index}`}>{renderMatchCard(match, false)}</div>)}
          {playedMatches.length > 0 && (
            <>
              <div className="section-label" style={{ marginTop: 8 }}>Finalizados</div>
              {playedMatches.map((match: any, index: number) => <div key={`played-${title}-${index}`}>{renderMatchCard(match, true)}</div>)}
            </>
          )}
          {pendingMatches.length === 0 && playedMatches.length === 0 && <p className="tournament-muted-text">Pendiente de resultados anteriores...</p>}
        </div>
      );
    };

    return (
      <div>
        <div className="tournament-phase-title tournament-phase-title-main">Fase 3: Cuadro Final</div>
        {(allSemifinalsReady || finals.length > 0) && renderSection('Gran Final', finals, '🏆')}
        {(allQuarterfinalsReady || semifinals.length > 0) && renderSection('Semifinales', semifinals, '🔥')}
        {renderSection('Cuartos de Final', quarterfinals, '⚔️')}
      </div>
    );
  };

  const renderAvatar = (photo: string | null, name: string) => {
    if (photo) {
      return (
        <button
          type="button"
          className="tournament-avatar-button"
          onClick={(event) => {
            event.stopPropagation();
            setAvatarPreview({ imageUrl: photo, alt: name });
          }}
        >
          <img src={photo} alt={name} className="tournament-match-avatar" />
        </button>
      );
    }
    return <div className="tournament-match-avatar tournament-match-avatar-placeholder">{name?.charAt(0) || '?'}</div>;
  };

  const phase = tournament?.phase;

  return (
    <div className="tournament-page">
      <div className="tournament-header">
        <div className="tournament-header-title">Torneo</div>
        <button className="tournament-info-button" onClick={() => setRulesVisible(true)}>
          <Info size={30} color={primaryColor} />
        </button>
      </div>

      {user?.role === 'admin' && (
        <div className="tournament-admin-panel">
          <div className="tournament-admin-title">{t('tournament_control')}</div>
          <div className="tournament-admin-actions">
            {phase && phase !== 'pending' && (
              <button className="tournament-phase-button tournament-phase-button-secondary" onClick={goBackPhase}>
                <ArrowLeft size={16} />
                Retroceder
              </button>
            )}
            {phase === 'phase1' && (
              <button className="tournament-phase-button" style={{ backgroundColor: primaryColor }} onClick={() => { setAdminPairingVisible(true); setSelectingPlayer('p1'); }}>
                <Users size={16} />
                Crear Pareja
              </button>
            )}
            {(!tournament || phase === 'pending') && (
              <button className="tournament-phase-button" style={{ backgroundColor: primaryColor }} onClick={() => setPhase('phase1')}>
                {t('start_phase1')}
              </button>
            )}
            {phase === 'phase1' && (
              <button className="tournament-phase-button" style={{ backgroundColor: primaryColor }} onClick={() => setPhase('phase2')}>
                {t('advance_phase2')}
              </button>
            )}
            {phase === 'phase2' && (
              <button className="tournament-phase-button" style={{ backgroundColor: primaryColor }} onClick={() => setPhase('phase3')}>
                {t('advance_phase3')}
              </button>
            )}
            {phase && phase !== 'pending' && (
              <button className="tournament-phase-button" style={{ backgroundColor: colors.danger }} onClick={resetTournament}>
                <RotateCcw size={16} />
                {t('reset_tournament')}
              </button>
            )}
          </div>
        </div>
      )}

      <div className="tournament-scroll scroll-area">
        {loading ? <div className="centered-loader"><div className="spinner" style={{ borderTopColor: primaryColor }}></div></div> : renderPhaseContent()}
      </div>

      {avatarPreview && (
        <AvatarPreviewModal
          imageUrl={avatarPreview.imageUrl}
          alt={avatarPreview.alt}
          onClose={() => setAvatarPreview(null)}
        />
      )}

      {confirmModalConfig.visible && (
        <div className="modal-overlay modal-center" onClick={() => setConfirmModalConfig((previous) => ({ ...previous, visible: false }))}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h3 className="tournament-modal-title">{confirmModalConfig.title}</h3>
            <p className="tournament-confirm-text">{confirmModalConfig.message}</p>
            <div className="tournament-modal-actions">
              <button className="btn btn-outline" onClick={() => setConfirmModalConfig((previous) => ({ ...previous, visible: false }))}>Cancelar</button>
              <button className="btn" style={{ backgroundColor: confirmModalConfig.confirmColor, color: '#fff' }} onClick={() => { setConfirmModalConfig((previous) => ({ ...previous, visible: false })); confirmModalConfig.onConfirm(); }}>
                {confirmModalConfig.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {startPhaseModalVisible && (
        <div className="modal-overlay" onClick={() => setStartPhaseModalVisible(false)}>
          <div className="modal-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="modal-handle"></div>
            <h3 className="tournament-modal-title">Fecha de Inicio del Torneo</h3>
            <p className="tournament-muted-text">Selecciona el día (ej. Lunes) en que comenzará a contar la "Semana 1" para calcular los partidos retrasados.</p>
            <input className="input-field" type="date" value={`${startPhaseDate.getFullYear()}-${String(startPhaseDate.getMonth() + 1).padStart(2, '0')}-${String(startPhaseDate.getDate()).padStart(2, '0')}`} onChange={(event) => setStartPhaseDate(new Date(`${event.target.value}T12:00:00`))} />
            <div className="tournament-modal-actions">
              <button className="btn btn-outline" onClick={() => setStartPhaseModalVisible(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={startPhase2}>Arrancar Fase 2</button>
            </div>
          </div>
        </div>
      )}

      {adminPairingVisible && (
        <div className="modal-overlay" onClick={() => { setAdminPairingVisible(false); setP1(null); setP2(null); }}>
          <div className="modal-sheet tournament-tall-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="modal-handle"></div>
            <h3 className="tournament-modal-title">Crear Pareja Manual</h3>
            <div className="tournament-pair-preview">
              <div className="tournament-pair-box">
                <div className="tournament-pair-label">Jugador 1</div>
                <div className={`tournament-pair-name ${!p1 ? 'is-empty' : ''}`}>{p1?.nombreApellidos || 'Seleccionar...'}</div>
              </div>
              <Link2 size={24} color={primaryColor} />
              <div className="tournament-pair-box">
                <div className="tournament-pair-label">Jugador 2</div>
                <div className={`tournament-pair-name ${!p2 ? 'is-empty' : ''}`}>{p2?.nombreApellidos || 'Seleccionar...'}</div>
              </div>
            </div>
            <div className="tournament-picker-steps">
              <button className={`tournament-picker-step ${selectingPlayer === 'p1' ? 'is-active' : ''}`} style={selectingPlayer === 'p1' ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined} onClick={() => setSelectingPlayer('p1')}>Seleccionando P1</button>
              <button className={`tournament-picker-step ${selectingPlayer === 'p2' ? 'is-active' : ''}`} style={selectingPlayer === 'p2' ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined} onClick={() => setSelectingPlayer('p2')}>Seleccionando P2</button>
            </div>
            <div className="tournament-modal-list">
              {allUsers
                .filter((entry) => entry.id !== (selectingPlayer === 'p1' ? p2?.id : p1?.id))
                .map((entry) => {
                  const selected = p1?.id === entry.id || p2?.id === entry.id;
                  return (
                    <button
                      key={entry.id}
                      className={`tournament-user-row ${selected ? 'is-selected' : ''}`}
                      onClick={() => {
                        if (selectingPlayer === 'p1') {
                          setP1(entry);
                          setSelectingPlayer('p2');
                        } else {
                          setP2(entry);
                        }
                      }}
                    >
                      <span>{entry.nombreApellidos}</span>
                      {selected && <Check size={20} color={primaryColor} />}
                    </button>
                  );
                })}
            </div>
            <div className="tournament-modal-actions">
              <button className="btn btn-outline" onClick={() => { setAdminPairingVisible(false); setP1(null); setP2(null); }}>Cancelar</button>
              <button className="btn btn-primary" onClick={adminCreatePair} disabled={!p1 || !p2}>Confirmar Pareja</button>
            </div>
          </div>
        </div>
      )}

      {calendarModalVisible && selectedMatch && (
        <div className="modal-overlay" onClick={() => setCalendarModalVisible(false)}>
          <div className="modal-sheet tournament-calendar-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="modal-handle"></div>
            <h3 className="tournament-modal-title">Horarios Disp.</h3>
            <p className="tournament-muted-text">Toca una franja. Para jugar, todos los jugadores deben coincidir. ✅ = Propuesto, 🚫 = Vetado, ❌ = Imposible (rivales)</p>

            {myTeam?.player2Id && (
              <button className="tournament-toggle-card" onClick={() => setIncludePartner((previous) => !previous)}>
                <span className={`tournament-switch ${includePartner ? 'is-on' : ''}`}><span className="tournament-switch-thumb"></span></span>
                <span>
                  <strong>Marcar para los dos</strong>
                  <small>Guarda la misma disponibilidad a tu pareja, sobreescribiendo si ya tenía.</small>
                </span>
              </button>
            )}

            <div className="tournament-calendar-scroll">
              {(() => {
                const playerAvailability = selectedMatch?.playerAvailability || {};
                const opponentProposed = new Set<string>();
                const opponentVetoed = new Set<string>();
                const partnerId = myTeam?.player1Id === user?.uid ? myTeam?.player2Id : myTeam?.player1Id;
                const opponentTeamId = selectedMatch?.team1Id === myTeam?.id ? selectedMatch?.team2Id : selectedMatch?.team1Id;
                const opponentTeam = teams.find((entry: any) => entry.id === opponentTeamId);

                if (opponentTeam) {
                  [opponentTeam.player1Id, opponentTeam.player2Id].forEach((id) => {
                    if (playerAvailability[id]) {
                      playerAvailability[id].proposed?.forEach((slot: string) => opponentProposed.add(slot));
                      playerAvailability[id].vetoed?.forEach((slot: string) => opponentVetoed.add(slot));
                    }
                  });
                }

                const partnerProposed = playerAvailability[partnerId]?.proposed || [];
                const next14Days = Array.from({ length: 14 }).map((_, index) => {
                  const day = new Date();
                  day.setDate(day.getDate() + index);
                  day.setHours(0, 0, 0, 0);
                  return day;
                });
                const validDates = next14Days.filter((date) => availableSlots.some((slot) => slot.day === DAYS_ES[date.getDay()]));
                const formatDate = (date: Date) => `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;

                return validDates.map((date) => {
                  const dateString = formatDate(date);
                  const dayName = DAYS_ES[date.getDay()];
                  const slotsForDate = availableSlots.filter((slot) => slot.day === dayName);
                  return (
                    <div key={dateString} className="tournament-calendar-day-group">
                      <div className="section-label" style={{ color: primaryColor }}>{dayName} {dateString.substring(0, 5)}</div>
                      <div className="tournament-slot-grid">
                        {slotsForDate.map((slot) => {
                          const slotString = `${dateString} ${slot.start}`;
                          const blocked = isCalendarSlotBlocked(dateString, slot.start);
                          const proposed = myProposedSlots.includes(slotString);
                          const vetoed = myVetoedSlots.includes(slotString);
                          const impossible = opponentVetoed.has(slotString);
                          const partnerMarked = partnerProposed.includes(slotString) && !includePartner;

                          return (
                            <button
                              key={`${dateString}-${slot.id}`}
                              className={`tournament-slot-chip ${blocked ? 'is-blocked' : ''} ${proposed ? 'is-proposed' : ''} ${vetoed ? 'is-vetoed' : ''} ${impossible ? 'is-impossible' : ''} ${partnerMarked ? 'is-partner' : ''}`}
                              onClick={() => {
                                if (blocked) {
                                  window.alert('Horario Ocupado\n\nEste horario ya está ocupado por otro partido del torneo o una reserva global a esa misma hora (o que se solapa).');
                                  return;
                                }
                                if (impossible) {
                                  window.alert('Imposible\n\nLos rivales han vetado este horario por lo que no es posible jugar. Elige otro.');
                                  return;
                                }
                                setSlotActionVisible({ visible: true, dateStr: slotString });
                              }}
                            >
                              <span>{slot.start}</span>
                              <span>{blocked ? '🔒' : proposed ? '✅' : vetoed ? '🚫' : impossible ? '❌' : partnerMarked ? '🧑‍🤝‍🧑' : ''}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            <div className="tournament-modal-actions">
              <button className="btn btn-outline" onClick={() => setCalendarModalVisible(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={submitProposals} disabled={submittingProposals}>{submittingProposals ? '...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {slotActionVisible.visible && (
        <div className="modal-overlay modal-center" onClick={() => setSlotActionVisible({ visible: false, dateStr: '' })}>
          <div className="modal-card" onClick={(event) => event.stopPropagation()}>
            <h3 className="tournament-modal-title" style={{ marginBottom: 8 }}>{slotActionVisible.dateStr}</h3>
            <p className="tournament-confirm-text">¿Qué quieres marcar para este horario?</p>
            <div className="tournament-slot-actions">
              {user?.role === 'admin' && (
                <button className="tournament-slot-action tournament-slot-action-primary" style={{ backgroundColor: primaryColor, borderColor: primaryColor }} onClick={() => forceAdminSchedule(slotActionVisible.dateStr)}>
                  Fijar Horario Oficial (Admin) 🏆
                </button>
              )}
              <button className="tournament-slot-action tournament-slot-action-primary" style={{ color: primaryColor, borderColor: primaryColor, backgroundColor: `${primaryColor}22` }} onClick={() => {
                const current = slotActionVisible.dateStr;
                setMyProposedSlots((previous) => [...previous.filter((entry) => entry !== current), current]);
                setMyVetoedSlots((previous) => previous.filter((entry) => entry !== current));
                setSlotActionVisible({ visible: false, dateStr: '' });
              }}>
                Añadir a Propuestos ✅
              </button>
              <button className="tournament-slot-action tournament-slot-action-danger" style={{ color: colors.danger, borderColor: colors.danger, backgroundColor: `${colors.danger}22` }} onClick={() => {
                const current = slotActionVisible.dateStr;
                setMyVetoedSlots((previous) => [...previous.filter((entry) => entry !== current), current]);
                setMyProposedSlots((previous) => previous.filter((entry) => entry !== current));
                setSlotActionVisible({ visible: false, dateStr: '' });
              }}>
                Marcar como Vetado 🚫
              </button>
              <button className="tournament-slot-action" onClick={() => {
                const current = slotActionVisible.dateStr;
                setMyProposedSlots((previous) => previous.filter((entry) => entry !== current));
                setMyVetoedSlots((previous) => previous.filter((entry) => entry !== current));
                setSlotActionVisible({ visible: false, dateStr: '' });
              }}>
                Limpiar Casilla ✕
              </button>
              <button className="tournament-sheet-cancel" onClick={() => setSlotActionVisible({ visible: false, dateStr: '' })}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {editTeamModalVisible && (
        <div className="modal-overlay" onClick={() => { setEditTeamModalVisible(false); setP1(null); setP2(null); }}>
          <div className="modal-sheet tournament-tall-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="modal-handle"></div>
            <h3 className="tournament-modal-title">Editar Pareja</h3>
            <div className="settings-sub-label" style={{ padding: 0, marginTop: 0 }}>Nombre del equipo</div>
            <input className="input-field" value={editTeamName} onChange={(event) => setEditTeamName(event.target.value)} placeholder="Nombre del equipo" />

            <div className="settings-sub-label" style={{ padding: 0 }}>Jugadores</div>
            <div className="tournament-picker-steps">
              <button className={`tournament-picker-step ${selectingPlayer === 'p1' ? 'is-active' : ''}`} style={selectingPlayer === 'p1' ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined} onClick={() => setSelectingPlayer('p1')}>
                {p1?.nombreApellidos?.split(' ')[0] || 'Jugador 1'}
              </button>
              <button className={`tournament-picker-step ${selectingPlayer === 'p2' ? 'is-active' : ''}`} style={selectingPlayer === 'p2' ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined} onClick={() => setSelectingPlayer('p2')}>
                {p2?.nombreApellidos?.split(' ')[0] || 'Jugador 2'}
              </button>
            </div>

            <div className="tournament-modal-list tournament-short-list">
              {allUsers.map((entry) => {
                const isP1 = p1?.id === entry.id;
                const isP2 = p2?.id === entry.id;
                const selected = isP1 || isP2;
                return (
                  <button
                    key={entry.id}
                    className={`tournament-user-row ${selected ? 'is-selected' : ''}`}
                    onClick={() => {
                      if (selectingPlayer === 'p1') {
                        setP1(entry);
                        setSelectingPlayer('p2');
                      } else {
                        setP2(entry);
                      }
                    }}
                  >
                    {entry.fotoURL ? <img src={entry.fotoURL} alt={entry.nombreApellidos} className="tournament-user-avatar" /> : <div className="tournament-user-avatar tournament-user-avatar-placeholder">{entry.nombreApellidos?.charAt(0)}</div>}
                    <div className="tournament-user-row-content">
                      <span className={selected ? 'is-primary-text' : undefined} style={selected ? { color: primaryColor } : undefined}>{entry.nombreApellidos}</span>
                      {isP1 && <small style={{ color: primaryColor }}>Jugador 1</small>}
                      {isP2 && <small style={{ color: primaryColor }}>Jugador 2</small>}
                    </div>
                    {selected && <Check size={22} color={primaryColor} />}
                  </button>
                );
              })}
            </div>

            <div className="tournament-modal-actions">
              <button className="btn btn-outline" onClick={() => { setEditTeamModalVisible(false); setP1(null); setP2(null); }}>Cancelar</button>
              <button className="btn btn-primary" onClick={updateTeam} disabled={savingTeam}>{savingTeam ? '...' : 'Guardar'}</button>
            </div>
          </div>
        </div>
      )}

      {renameMyTeamVisible && (
        <div className="modal-overlay" onClick={() => setRenameMyTeamVisible(false)}>
          <div className="modal-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="modal-handle"></div>
            <h3 className="tournament-modal-title">Nombre de la Pareja</h3>
            <input className="input-field" value={myTeamNewName} onChange={(event) => setMyTeamNewName(event.target.value)} placeholder="Ej: Los Cañones" />
            <div className="tournament-modal-actions">
              <button className="btn btn-outline" onClick={() => setRenameMyTeamVisible(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={renameMyTeam}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {overrideModalVisible && (
        <div className="modal-overlay" onClick={() => { setMatchSets(initialSetState()); setSelectedMatch(null); setOverrideModalVisible(false); }}>
          <div className="modal-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="modal-handle"></div>
            <h3 className="tournament-modal-title">Resultado a 3 Sets</h3>
            {selectedMatch && (
              <>
                <div className="tournament-override-matchup">{selectedMatch.team1Name || selectedMatch.teamA?.name} vs {selectedMatch.team2Name || selectedMatch.teamB?.name}</div>
                {matchSets.map((set, index) => (
                  <div key={`set-${index}`} className="tournament-set-row">
                    <span>Set {index + 1}</span>
                    <input className="input-field tournament-score-input" type="number" value={set.t1} onChange={(event) => {
                      const next = [...matchSets];
                      next[index].t1 = event.target.value;
                      setMatchSets(next);
                    }} placeholder="T1" />
                    <span>-</span>
                    <input className="input-field tournament-score-input" type="number" value={set.t2} onChange={(event) => {
                      const next = [...matchSets];
                      next[index].t2 = event.target.value;
                      setMatchSets(next);
                    }} placeholder="T2" />
                  </div>
                ))}
                <div className="tournament-modal-actions">
                  <button className="btn btn-outline" onClick={() => { setMatchSets(initialSetState()); setSelectedMatch(null); setOverrideModalVisible(false); }}>Cancelar</button>
                  <button className="btn btn-primary" onClick={overrideResult}>Guardar Resultado</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {adminMatchOptionsVisible && (
        <div className="modal-overlay" onClick={() => setAdminMatchOptionsVisible(false)}>
          <div className="modal-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="modal-handle"></div>
            <h3 className="tournament-modal-title">Opciones de Partido</h3>
            <p className="tournament-muted-text">
              {myTeam?.id && selectedMatch && (selectedMatch.team1Id === myTeam.id || selectedMatch.team2Id === myTeam.id)
                ? 'Como administrador estás apuntado en este partido. ¿Qué deseas hacer?'
                : '¿Qué gestión quieres realizar como administrador?'}
            </p>
            <div className="tournament-slot-actions" style={{ marginTop: 12 }}>
              <button className="tournament-slot-action tournament-slot-action-primary" style={{ backgroundColor: primaryColor, borderColor: primaryColor, color: '#fff' }} onClick={() => {
                setAdminMatchOptionsVisible(false);
                if (selectedMatch) openCalendarForMatch(selectedMatch);
              }}>
                {myTeam?.id && selectedMatch && (selectedMatch.team1Id === myTeam.id || selectedMatch.team2Id === myTeam.id)
                  ? 'Proponer Horarios (Jugador)'
                  : 'Ver Horarios y Vetos (Lectura)'}
              </button>
              <button className="tournament-slot-action tournament-slot-action-danger" style={{ backgroundColor: colors.danger, borderColor: colors.danger, color: '#fff' }} onClick={() => {
                setAdminMatchOptionsVisible(false);
                setMatchSets(initialSetState());
                setOverrideModalVisible(true);
              }}>
                Escribir Resultado (Admin)
              </button>
              <button className="tournament-sheet-cancel" onClick={() => setAdminMatchOptionsVisible(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {rulesVisible && (
        <div className="modal-overlay" onClick={() => setRulesVisible(false)}>
          <div className="modal-sheet tournament-rules-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="tournament-rules-header">
              <Info size={28} color={primaryColor} />
              <h3 className="tournament-modal-title" style={{ marginBottom: 0 }}>{t('rules_title')}</h3>
            </div>
            <div className="tournament-modal-list">
              {RULES.map((rule) => (
                <div key={rule.title} className="tournament-rule-card">
                  <div className="tournament-rule-icon">{rule.icon}</div>
                  <div>
                    <div className="tournament-rule-title">{rule.title}</div>
                    <div className="tournament-rule-text">{rule.text}</div>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-primary full" onClick={() => setRulesVisible(false)}>{t('understood')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
