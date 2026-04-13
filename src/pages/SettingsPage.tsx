import { useState, useEffect, useRef } from 'react';
import { signOut, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, updateDoc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { auth, db, storage } from '../services/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Camera, LogOut, ChevronRight, Shield, Moon, CalendarDays, Bell, Lock, Palette, Users, Trophy, Clock } from 'lucide-react';
import './Settings.css';

const COLOR_PALETTE = [
  '#ef4444','#f97316','#f59e0b','#eab308','#84cc16',
  '#22c55e','#10b981','#14b8a6','#06b6d4','#0ea5e9',
  '#3b82f6','#6366f1','#8b5cf6','#a855f7','#d946ef',
  '#ec4899','#f43f5e','#64748b','#1e293b','#ffffff',
];

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const {
    primaryColor, setPrimaryColor, isDarkMode, toggleDarkMode,
    isCalendarView, toggleCalendarView, autoApproveTournament, toggleAutoApproveTournament,
    openMatchCreation, toggleOpenMatchCreation,
  } = useTheme();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.nombreApellidos || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password Modal
  const [pwModal, setPwModal] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  // Admin mode
  const [adminPw, setAdminPw] = useState('');

  // Notification prefs
  const [notifPrefs, setNotifPrefs] = useState({
    pushEnabled: true, invitations: true, joins: true, leaves: true, changes: true, cancellations: true,
  });

  // Tournament slots
  const [slots, setSlots] = useState<any[]>([]);
  const [slotModal, setSlotModal] = useState(false);
  const [newSlotDay, setNewSlotDay] = useState('Lunes');
  const [newSlotTime, setNewSlotTime] = useState('17:00');
  const [matchesPerWeek, setMatchesPerWeek] = useState(1);

  // PWA Install
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    setIsStandalone(standalone);
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubNotifs = onSnapshot(doc(db, 'users', user.uid), snap => {
      if (snap.exists() && snap.data().notifPrefs) {
        setNotifPrefs(p => ({ ...p, ...snap.data()!.notifPrefs }));
      }
    });
    const unsubSlots = onSnapshot(doc(db, 'config', 'tournamentSlots'), snap => {
      if (snap.exists()) {
        setSlots(snap.data().slots || []);
        if (snap.data().matchesPerWeek) setMatchesPerWeek(snap.data().matchesPerWeek);
      }
    });
    return () => { unsubNotifs(); unsubSlots(); };
  }, [user?.uid]);

  const saveNotifPref = async (key: string, value: boolean) => {
    if (!user?.uid) return;
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    await updateDoc(doc(db, 'users', user.uid), { notifPrefs: updated });
  };

  const handleSaveName = async () => {
    if (!user || !nameInput.trim()) return;
    await updateDoc(doc(db, 'users', user.uid), { nombreApellidos: nameInput.trim() });
    await refreshUser();
    setEditingName(false);
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) return alert('Las contraseñas no coinciden');
    if (!user || !auth.currentUser) return;
    try {
      const cred = EmailAuthProvider.credential(user.email!, currentPw);
      await reauthenticateWithCredential(auth.currentUser, cred);
      await updatePassword(auth.currentUser, newPw);
      alert('¡Contraseña actualizada!');
      setPwModal(false);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch { alert('Verifica tu contraseña actual.'); }
  };

  const handleActivateAdmin = async () => {
    const configSnap = await getDoc(doc(db, 'config', 'settings'));
    const masterPw = configSnap.exists() ? configSnap.data().masterPassword : 'Sabardes34';
    if (adminPw !== masterPw) return alert('Contraseña incorrecta');
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), { role: 'admin' });
    setAdminPw('');
    await refreshUser();
  };

  const handleDeactivateAdmin = async () => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.uid), { role: 'user' });
    await refreshUser();
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingImage(true);
    try {
      const storageRef = ref(storage, `profileImages/${user.uid}`);
      await uploadBytes(storageRef, file);
      const url = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'users', user.uid), { fotoURL: url });
      await refreshUser();
    } catch (err: any) { alert('Error al subir imagen: ' + err.message); }
    finally { setUploadingImage(false); }
  };

  const addSlot = async () => {
    const [h, m] = newSlotTime.split(':').map(Number);
    const endTotal = h * 60 + m + 90;
    const endH = Math.floor(endTotal / 60) % 24;
    const endM = endTotal % 60;
    const endTime = `${endH.toString().padStart(2, '0')}:${endM.toString().padStart(2, '0')}`;
    const newSlot = { id: Date.now().toString(), day: newSlotDay, start: newSlotTime, end: endTime, display: `${newSlotDay} ${newSlotTime} - ${endTime}` };
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const updated = [...slots, newSlot].sort((a, b) => {
      const dd = days.indexOf(a.day) - days.indexOf(b.day);
      return dd !== 0 ? dd : a.start.localeCompare(b.start);
    });
    await setDoc(doc(db, 'config', 'tournamentSlots'), { slots: updated }, { merge: true });
    setSlotModal(false);
  };

  const deleteSlot = async (id: string) => {
    const updated = slots.filter(s => s.id !== id);
    await setDoc(doc(db, 'config', 'tournamentSlots'), { slots: updated }, { merge: true });
  };

  const saveMpw = async (val: number) => {
    const v = Math.max(1, Math.min(5, val));
    setMatchesPerWeek(v);
    await setDoc(doc(db, 'config', 'tournamentSlots'), { matchesPerWeek: v }, { merge: true });
  };

  return (
    <div className="settings-page">
      <div className="page-header"><h1>Ajustes</h1></div>
      <div className="scroll-area" style={{ padding: '0 16px 100px' }}>

        {/* Profile Section */}
        <div className="settings-section">
          <div className="profile-card">
            <div className="profile-avatar-wrap" onClick={() => fileInputRef.current?.click()}>
              {user?.fotoURL ? (
                <img src={user.fotoURL} className="profile-avatar" alt="Profile" />
              ) : (
                <div className="profile-avatar placeholder-avatar">
                  {user?.nombreApellidos?.charAt(0)?.toUpperCase()}
                </div>
              )}
              <div className="camera-badge"><Camera size={14} color="#fff" /></div>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleImageUpload} />
              {uploadingImage && <div className="uploading-overlay"><div className="spinner small"></div></div>}
            </div>
            <div className="profile-info">
              {editingName ? (
                <div className="name-edit-row">
                  <input className="input-field small" value={nameInput} onChange={e => setNameInput(e.target.value)} />
                  <button className="btn btn-primary small" onClick={handleSaveName}>✓</button>
                </div>
              ) : (
                <h2 onClick={() => setEditingName(true)}>{user?.nombreApellidos} <Palette size={14} /></h2>
              )}
              <span className="profile-email">{user?.email}</span>
              <span className="profile-role">{user?.role === 'admin' ? '🛡️ Administrador' : '👤 Usuario'}</span>
            </div>
          </div>
        </div>

        {/* PWA Install Prompt (iOS only, not installed) */}
        {isIOS && !isStandalone && (
          <div className="settings-section">
            <div className="pwa-install-banner">
              <h3>📲 Instalar como App</h3>
              <p>Para la mejor experiencia en iPhone:</p>
              <ol>
                <li>Pulsa el botón <strong>Compartir</strong> <span className="share-icon">⬆️</span> de Safari</li>
                <li>Selecciona <strong>"Añadir a pantalla de inicio"</strong></li>
                <li>Pulsa <strong>"Añadir"</strong></li>
              </ol>
              <p className="pwa-note">Esto permite recibir notificaciones push y una experiencia completa a pantalla completa.</p>
            </div>
          </div>
        )}

        {/* Apariencia */}
        <div className="settings-section">
          <h3 className="section-title"><Palette size={18} /> Apariencia</h3>
          <div className="settings-row" onClick={toggleDarkMode}>
            <div className="row-left"><Moon size={18} /><span>Modo oscuro</span></div>
            <label className="toggle"><input type="checkbox" checked={isDarkMode} readOnly /><span className="toggle-slider"></span></label>
          </div>
          <div className="settings-row" onClick={toggleCalendarView}>
            <div className="row-left"><CalendarDays size={18} /><span>Vista calendario</span></div>
            <label className="toggle"><input type="checkbox" checked={isCalendarView} readOnly /><span className="toggle-slider"></span></label>
          </div>
          <div className="color-palette">
            {COLOR_PALETTE.map(c => (
              <button key={c} className={`color-dot ${primaryColor === c ? 'selected' : ''}`}
                style={{ backgroundColor: c }} onClick={() => setPrimaryColor(c)} />
            ))}
          </div>
        </div>

        {/* Notificaciones */}
        <div className="settings-section">
          <h3 className="section-title"><Bell size={18} /> Notificaciones</h3>
          {[
            { key: 'pushEnabled', label: 'Notificaciones Push' },
            { key: 'invitations', label: 'Invitaciones a partidos' },
            { key: 'joins', label: 'Nuevos apuntados' },
            { key: 'leaves', label: 'Bajas de partidos' },
            { key: 'changes', label: 'Cambios de partidos' },
            { key: 'cancellations', label: 'Cancelaciones' },
          ].map(item => (
            <div className="settings-row" key={item.key} onClick={() => saveNotifPref(item.key, !(notifPrefs as any)[item.key])}>
              <span>{item.label}</span>
              <label className="toggle"><input type="checkbox" checked={(notifPrefs as any)[item.key]} readOnly /><span className="toggle-slider"></span></label>
            </div>
          ))}
        </div>

        {/* Seguridad */}
        <div className="settings-section">
          <h3 className="section-title"><Lock size={18} /> Seguridad</h3>
          <div className="settings-row" onClick={() => setPwModal(true)}>
            <span>Cambiar contraseña</span><ChevronRight size={18} />
          </div>
        </div>

        {/* Admin */}
        <div className="settings-section">
          <h3 className="section-title"><Shield size={18} /> Administración</h3>
          {user?.role === 'admin' ? (
            <>
              <div className="settings-row" onClick={toggleOpenMatchCreation}>
                <div className="row-left"><Users size={18} /><span>Creación abierta de partidos</span></div>
                <label className="toggle"><input type="checkbox" checked={openMatchCreation} readOnly /><span className="toggle-slider"></span></label>
              </div>
              <div className="settings-row" onClick={toggleAutoApproveTournament}>
                <div className="row-left"><Trophy size={18} /><span>Auto-aprobar torneo</span></div>
                <label className="toggle"><input type="checkbox" checked={autoApproveTournament} readOnly /><span className="toggle-slider"></span></label>
              </div>

              <h4 className="sub-title"><Clock size={16} /> Horarios de Torneo</h4>
              {slots.map(s => (
                <div className="slot-row" key={s.id}>
                  <span>{s.display}</span>
                  <button className="slot-delete" onClick={() => deleteSlot(s.id)}>×</button>
                </div>
              ))}
              <button className="btn btn-outline small" onClick={() => setSlotModal(true)}>+ Añadir Horario</button>

              <div className="mpw-row">
                <span>Partidos por semana:</span>
                <div className="mpw-controls">
                  <button onClick={() => saveMpw(matchesPerWeek - 1)}>−</button>
                  <span>{matchesPerWeek}</span>
                  <button onClick={() => saveMpw(matchesPerWeek + 1)}>+</button>
                </div>
              </div>

              <button className="btn btn-danger full" onClick={handleDeactivateAdmin} style={{ marginTop: 16 }}>Desactivar Admin</button>
            </>
          ) : (
            <div className="admin-activate">
              <input className="input-field" type="password" placeholder="Contraseña de administrador" value={adminPw} onChange={e => setAdminPw(e.target.value)} />
              <button className="btn btn-primary" onClick={handleActivateAdmin}>Activar</button>
            </div>
          )}
        </div>

        <button className="btn btn-danger full logout-btn" onClick={() => signOut(auth)}>
          <LogOut size={18} /> Cerrar Sesión
        </button>
      </div>

      {/* Password Modal */}
      {pwModal && (
        <div className="modal-overlay" onClick={() => setPwModal(false)}>
          <div className="modal-body" onClick={e => e.stopPropagation()}>
            <h3>Cambiar Contraseña</h3>
            <div className="modal-form">
              <input className="input-field" type="password" placeholder="Contraseña actual" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
              <input className="input-field" type="password" placeholder="Nueva contraseña" value={newPw} onChange={e => setNewPw(e.target.value)} />
              <input className="input-field" type="password" placeholder="Confirmar nueva" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setPwModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleChangePassword}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Slot Modal */}
      {slotModal && (
        <div className="modal-overlay" onClick={() => setSlotModal(false)}>
          <div className="modal-body" onClick={e => e.stopPropagation()}>
            <h3>Nuevo Horario</h3>
            <div className="modal-form">
              <select className="input-field" value={newSlotDay} onChange={e => setNewSlotDay(e.target.value)}>
                {['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'].map(d => <option key={d}>{d}</option>)}
              </select>
              <input className="input-field" type="time" value={newSlotTime} onChange={e => setNewSlotTime(e.target.value)} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setSlotModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={addSlot}>Añadir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
