import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential, signOut, updatePassword } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import {
  Bell,
  Camera,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  KeyRound,
  Lock,
  LogOut,
  Moon,
  Pencil,
  Shield,
  Trophy,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { auth, db, requestPushNotificationToken, storage } from '../services/firebaseConfig';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useTranslation } from '../context/LanguageContext';
import './Settings.css';

const COLOR_PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16',
  '#22c55e', '#10b981', '#14b8a6', '#06b6d4', '#0ea5e9',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
  '#ec4899', '#f43f5e', '#64748b', '#1e293b', '#ffffff',
] as const;

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const {
    primaryColor,
    setPrimaryColor,
    isDarkMode,
    toggleDarkMode,
    isCalendarView,
    toggleCalendarView,
    autoApproveTournament,
    toggleAutoApproveTournament,
    openMatchCreation,
    toggleOpenMatchCreation,
    fontSize,
    setFontSize,
    colors,
  } = useTheme();
  const { t, language, setLanguage } = useTranslation();

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.nombreApellidos || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePickerOpen, setImagePickerOpen] = useState(false);

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [adminPassword, setAdminPassword] = useState('');
  const [changingRole, setChangingRole] = useState(false);

  const [masterPasswordModalOpen, setMasterPasswordModalOpen] = useState(false);
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [savingMasterPassword, setSavingMasterPassword] = useState(false);

  const [slots, setSlots] = useState<any[]>([]);
  const [slotModalOpen, setSlotModalOpen] = useState(false);
  const [newSlotDay, setNewSlotDay] = useState('Lunes');
  const [newSlotTime, setNewSlotTime] = useState('17:00');
  const [savingSlot, setSavingSlot] = useState(false);
  const [matchesPerWeek, setMatchesPerWeek] = useState(1);
  const [savingMatchesPerWeek, setSavingMatchesPerWeek] = useState(false);

  const [notifPrefs, setNotifPrefs] = useState({
    pushEnabled: true,
    invitations: true,
    joins: true,
    leaves: true,
    changes: true,
    cancellations: true,
  });

  useEffect(() => {
    setNameInput(user?.nombreApellidos || '');
  }, [user?.nombreApellidos]);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribeNotifPrefs = onSnapshot(doc(db, 'users', user.uid), (snapshot) => {
      if (snapshot.exists() && snapshot.data().notifPrefs) {
        setNotifPrefs((previous) => ({ ...previous, ...snapshot.data().notifPrefs }));
      }
    });

    const unsubscribeTournamentSlots = onSnapshot(doc(db, 'config', 'tournamentSlots'), (snapshot) => {
      if (snapshot.exists()) {
        setSlots(snapshot.data().slots || []);
        if (snapshot.data().matchesPerWeek) {
          setMatchesPerWeek(snapshot.data().matchesPerWeek);
        }
      }
    });

    return () => {
      unsubscribeNotifPrefs();
      unsubscribeTournamentSlots();
    };
  }, [user?.uid]);

  const saveNotifPref = async (key: string, value: boolean) => {
    if (!user?.uid) return;
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    await updateDoc(doc(db, 'users', user.uid), { notifPrefs: updated });
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      window.alert(`${t('error')}\n\nNo se pudo cerrar sesión`);
    }
  };

  const handleSaveProfile = async () => {
    if (!user || !nameInput.trim()) return;
    setSavingProfile(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { nombreApellidos: nameInput.trim() });
      await refreshUser();
      setEditingName(false);
    } catch (error: any) {
      window.alert(`${t('error')}\n\n${error.message}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleImageFile = async (file?: File | null) => {
    if (!file || !user) return;
    setUploadingImage(true);
    try {
      const storageRef = ref(storage, `profiles/${user.uid}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'users', user.uid), { fotoURL: downloadURL });
      await refreshUser();
      setImagePickerOpen(false);
      window.alert('✅ Foto actualizada\n\n¡Tu foto de perfil ha sido actualizada con éxito!');
    } catch (error: any) {
      window.alert(`${t('error')}\n\nNo se pudo subir la foto.\n\nDetalle: ${error?.message || 'Error desconocido'}`);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      window.alert(`${t('error')}\n\n${t('passwords_no_match')}`);
      return;
    }
    if (!user || !auth.currentUser) return;

    setChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email || '', currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      window.alert('Éxito\n\n¡Contraseña actualizada!');
      setPasswordModalOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      window.alert(`${t('error')}\n\nVerifica tu contraseña actual.`);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleActivateAdmin = async () => {
    const configSnapshot = await getDoc(doc(db, 'config', 'settings'));
    const masterPassword = configSnapshot.exists() ? configSnapshot.data().masterPassword : 'Sabardes34';
    if (adminPassword !== masterPassword) {
      window.alert(`${t('error')}\n\nContraseña incorrecta`);
      return;
    }
    if (!user) return;

    setChangingRole(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: 'admin' });
      window.alert(`${t('success')}\n\nModo administrador activado.`);
      setAdminPassword('');
      await refreshUser();
    } catch {
      window.alert(`${t('error')}\n\nNo se pudo actualizar el rol.`);
    } finally {
      setChangingRole(false);
    }
  };

  const handleDeactivateAdmin = async () => {
    if (!user) return;

    setChangingRole(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { role: 'user' });
      window.alert(`${t('success')}\n\nPrivilegios de administrador eliminados.`);
      await refreshUser();
    } catch {
      window.alert(`${t('error')}\n\nNo se pudo actualizar el rol.`);
    } finally {
      setChangingRole(false);
    }
  };

  const handleSaveMasterPassword = async () => {
    if (!newMasterPassword.trim()) return;
    setSavingMasterPassword(true);
    try {
      await setDoc(doc(db, 'config', 'settings'), { masterPassword: newMasterPassword.trim() }, { merge: true });
      window.alert(`${t('success')}\n\nContraseña maestra actualizada.`);
      setMasterPasswordModalOpen(false);
      setNewMasterPassword('');
    } catch (error: any) {
      window.alert(`${t('error')}\n\n${error.message}`);
    } finally {
      setSavingMasterPassword(false);
    }
  };

  const retryNotificationPermissions = async () => {
    if (!user?.uid) return;

    const token = await requestPushNotificationToken();
    const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';

    if (token) {
      await setDoc(doc(db, 'users', user.uid), { pushToken: token }, { merge: true });
      await refreshUser();
      window.alert('✅ Permisos concedidos\n\nLas notificaciones están activadas.');
      return;
    }

    if (permission === 'granted') {
      window.alert('❌ Error\n\nSe concedieron los permisos, pero no se pudo registrar el dispositivo para recibir notificaciones.');
      return;
    }

    window.alert('❌ Permisos denegados\n\nVe a Ajustes del sistema para activarlas manualmente.');
  };

  const addTournamentSlot = async () => {
    setSavingSlot(true);
    try {
      const [hours, minutes] = newSlotTime.split(':').map(Number);
      const endTotal = hours * 60 + minutes + 90;
      const endHours = Math.floor(endTotal / 60) % 24;
      const endMinutes = endTotal % 60;
      const endTime = `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`;

      const newSlot = {
        id: Date.now().toString(),
        day: newSlotDay,
        start: newSlotTime,
        end: endTime,
        display: `${newSlotDay} ${newSlotTime} - ${endTime}`,
      };

      const updatedSlots = [...slots, newSlot].sort((left, right) => {
        const dayDifference = DAYS.indexOf(left.day) - DAYS.indexOf(right.day);
        if (dayDifference !== 0) return dayDifference;
        return left.start.localeCompare(right.start);
      });

      await setDoc(doc(db, 'config', 'tournamentSlots'), { slots: updatedSlots }, { merge: true });
      setSlotModalOpen(false);
    } catch (error: any) {
      window.alert(`${t('error')}\n\n${error.message}`);
    } finally {
      setSavingSlot(false);
    }
  };

  const deleteSlot = async (id: string) => {
    const updatedSlots = slots.filter((entry) => entry.id !== id);
    await setDoc(doc(db, 'config', 'tournamentSlots'), { slots: updatedSlots }, { merge: true });
  };

  const saveMatchesPerWeek = async (value: number) => {
    const nextValue = Math.max(1, Math.min(5, value));
    setMatchesPerWeek(nextValue);
    setSavingMatchesPerWeek(true);
    try {
      await setDoc(doc(db, 'config', 'tournamentSlots'), { matchesPerWeek: nextValue }, { merge: true });
    } catch (error: any) {
      window.alert(`${t('error')}\n\n${error.message}`);
    } finally {
      setSavingMatchesPerWeek(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-scroll scroll-area">
        <h1 className="page-title settings-page-title">{t('settings')}</h1>

        <div className="section-label">{t('profile')}</div>
        <div className="settings-section-card">
          <div className="settings-profile-row">
            <button className="settings-avatar-wrap" onClick={() => setImagePickerOpen(true)}>
              {uploadingImage ? (
                <div className="settings-avatar settings-avatar-placeholder"><div className="spinner small" style={{ borderTopColor: primaryColor }}></div></div>
              ) : user?.fotoURL ? (
                <img src={user.fotoURL} alt={user.nombreApellidos} className="settings-avatar" />
              ) : (
                <div className="settings-avatar settings-avatar-placeholder">{user?.nombreApellidos?.charAt(0)?.toUpperCase()}</div>
              )}
              <span className="settings-camera-badge" style={{ backgroundColor: primaryColor }}>
                <Camera size={12} color="#fff" />
              </span>
            </button>

            <div className="settings-profile-info">
              {editingName ? (
                <div className="settings-name-edit-row">
                  <input className="input-field" value={nameInput} onChange={(event) => setNameInput(event.target.value)} placeholder={t('full_name')} />
                  <button className="settings-name-action" onClick={handleSaveProfile} disabled={savingProfile}>
                    {savingProfile ? <div className="spinner small" style={{ borderTopColor: primaryColor }}></div> : <Check size={18} color={primaryColor} />}
                  </button>
                  <button className="settings-name-action" onClick={() => { setEditingName(false); setNameInput(user?.nombreApellidos || ''); }}>
                    <X size={18} color={colors.textDim} />
                  </button>
                </div>
              ) : (
                <div className="settings-name-display-row">
                  <div className="settings-profile-name">{user?.nombreApellidos}</div>
                  <button className="settings-pencil-button" onClick={() => setEditingName(true)}>
                    <Pencil size={16} color={primaryColor} />
                  </button>
                </div>
              )}
              <div className="settings-profile-role" style={{ color: primaryColor }}>{user?.role}</div>
              <div className="settings-profile-email">{user?.email}</div>
            </div>
          </div>

          <div className="settings-divider"></div>

          <button className="settings-action-row" onClick={() => setPasswordModalOpen(true)}>
            <div className="settings-action-left">
              <span className="settings-action-icon"><Lock size={18} color={colors.textDim} /></span>
              <span>{t('change_password')}</span>
            </div>
            <ChevronRight size={18} color={colors.textDim} />
          </button>
        </div>

        {user?.role === 'admin' && (
          <>
            <div className="section-label">Partidos</div>
            <div className="settings-section-card">
              <ToggleRow
                icon={<Users size={18} color={primaryColor} />}
                label={t('open_match_creation')}
                desc={t('open_match_creation_desc')}
                value={openMatchCreation}
                onToggle={toggleOpenMatchCreation}
              />
            </div>

            <div className="section-label">{t('admin_options')}</div>
            <div className="settings-section-card">
              <ToggleRow
                icon={<Trophy size={18} color={primaryColor} />}
                label={t('auto_approve')}
                desc={t('auto_approve_desc')}
                value={autoApproveTournament}
                onToggle={toggleAutoApproveTournament}
              />
            </div>
          </>
        )}

        <div className="section-label">{t('appearance')}</div>
        <div className="settings-section-card">
          <ToggleRow icon={<Moon size={18} color={primaryColor} />} label={t('dark_mode')} value={isDarkMode} onToggle={toggleDarkMode} />
          <div className="settings-divider"></div>
          <ToggleRow icon={<CalendarDays size={18} color={primaryColor} />} label={t('calendar_view')} value={isCalendarView} onToggle={toggleCalendarView} />

          <div className="settings-divider"></div>
          <div className="settings-sub-label">{t('language')}</div>
          <div className="settings-language-row">
            {(['es', 'gl'] as const).map((lang) => (
              <button
                key={lang}
                className={`settings-language-button ${language === lang ? 'is-active' : ''}`}
                style={language === lang ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined}
                onClick={() => setLanguage(lang)}
              >
                {lang === 'es' ? '🇪🇸 Castellano de Castilla' : '🏔️ Galego'}
              </button>
            ))}
          </div>

          <div className="settings-divider"></div>
          <div className="settings-sub-label">{t('main_color')}</div>
          <div className="settings-color-grid">
            {COLOR_PALETTE.map((color) => (
              <button
                key={color}
                className={`settings-color-swatch ${primaryColor === color ? 'is-active' : ''}`}
                style={{ backgroundColor: color, borderColor: color === '#ffffff' ? colors.border : 'transparent' }}
                onClick={() => setPrimaryColor(color)}
              >
                {primaryColor === color && <Check size={14} color={color === '#ffffff' ? '#000' : '#fff'} />}
              </button>
            ))}
          </div>

          <div className="settings-divider"></div>
          <div className="settings-sub-label">{t('font_size')}</div>
          <div className="settings-font-row">
            {(['small', 'normal', 'large'] as const).map((size, index) => (
              <button
                key={size}
                className={`settings-font-button ${fontSize === size ? 'is-active' : ''}`}
                style={fontSize === size ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined}
                onClick={() => setFontSize(size)}
              >
                <span style={{ fontSize: [13, 17, 22][index], color: fontSize === size ? '#fff' : colors.text }}>A</span>
              </button>
            ))}
          </div>
        </div>

        <div className="section-label">{t('notifications')}</div>
        <div className="settings-section-card">
          <ToggleRow icon={<Bell size={18} color={primaryColor} />} label={t('notif_push')} value={notifPrefs.pushEnabled} onToggle={(value) => saveNotifPref('pushEnabled', value)} />
          <div className="settings-retry-row">
            <button className="settings-retry-button" style={{ borderColor: primaryColor, color: primaryColor }} onClick={retryNotificationPermissions}>
              <Bell size={14} color={primaryColor} />
              {t('notif_retry_perms')}
            </button>
          </div>

          {notifPrefs.pushEnabled && (
            <>
              <div className="settings-divider"></div>
              <ToggleRow icon={<Bell size={18} color={primaryColor} />} label={t('notif_invitations')} value={notifPrefs.invitations} onToggle={(value) => saveNotifPref('invitations', value)} />
              <div className="settings-divider"></div>
              {(user?.role === 'admin' || openMatchCreation) && (
                <>
                  <ToggleRow icon={<Users size={18} color={primaryColor} />} label={t('notif_joins')} value={notifPrefs.joins} onToggle={(value) => saveNotifPref('joins', value)} />
                  <div className="settings-divider"></div>
                </>
              )}
              <ToggleRow icon={<Users size={18} color={primaryColor} />} label={t('notif_leaves')} value={notifPrefs.leaves} onToggle={(value) => saveNotifPref('leaves', value)} />
              <div className="settings-divider"></div>
              <ToggleRow icon={<Clock3 size={18} color={primaryColor} />} label={t('notif_changes')} value={notifPrefs.changes} onToggle={(value) => saveNotifPref('changes', value)} />
              <div className="settings-divider"></div>
              <ToggleRow icon={<X size={18} color={primaryColor} />} label={t('notif_cancellations')} value={notifPrefs.cancellations} onToggle={(value) => saveNotifPref('cancellations', value)} />
            </>
          )}
        </div>

        {user?.role === 'admin' && (
          <>
            <div className="section-label">{t('manage_tournament_slots')}</div>
            <div className="settings-section-card">
              <div className="settings-sub-label">Partidos mínimos por equipo por semana</div>
              <div className="settings-mpw-row">
                <button className="settings-stepper" onClick={() => saveMatchesPerWeek(matchesPerWeek - 1)}>-</button>
                <div className="settings-mpw-value" style={{ color: primaryColor }}>{savingMatchesPerWeek ? '...' : matchesPerWeek}</div>
                <button className="settings-stepper" onClick={() => saveMatchesPerWeek(matchesPerWeek + 1)}>+</button>
                <div className="settings-mpw-note">partido{matchesPerWeek !== 1 ? 's' : ''} / equipo / semana (máx. 5)</div>
              </div>

              {slots.map((slot) => (
                <div key={slot.id} className="settings-slot-row">
                  <div className="settings-slot-left">
                    <Clock3 size={16} color={primaryColor} />
                    <span>{slot.display}</span>
                  </div>
                  <button onClick={() => deleteSlot(slot.id)}>
                    <TrashIcon color={colors.danger} />
                  </button>
                </div>
              ))}

              <button className="settings-add-slot" onClick={() => setSlotModalOpen(true)}>
                <Clock3 size={18} color={primaryColor} />
                <span style={{ color: primaryColor }}>{t('add_slot')}</span>
              </button>
            </div>

            <div className="section-label">{t('master_password')}</div>
            <div className="settings-section-card">
              <button className="settings-action-row" onClick={() => setMasterPasswordModalOpen(true)}>
                <div className="settings-action-left">
                  <span className="settings-action-icon"><KeyRound size={18} color={colors.textDim} /></span>
                  <span>{t('change_master_password')}</span>
                </div>
                <ChevronRight size={18} color={colors.textDim} />
              </button>
            </div>
          </>
        )}

        {user?.role !== 'admin' ? (
          <>
            <div className="section-label">{t('admin_mode')}</div>
            <div className="settings-section-card">
              <div className="settings-admin-box">
                <input
                  className="input-field"
                  type="password"
                  placeholder={t('master_password')}
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                />
                <button className="btn btn-primary" onClick={handleActivateAdmin} disabled={changingRole}>
                  {changingRole ? '...' : t('enter')}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="section-label">Desactivar Admin</div>
            <div className="settings-section-card">
              <button className="settings-action-row" onClick={handleDeactivateAdmin}>
                <div className="settings-action-left">
                  <span className="settings-action-icon"><Shield size={18} color={colors.danger} /></span>
                  <span style={{ color: colors.danger, fontWeight: 700 }}>Perder privilegios de Administrador</span>
                </div>
              </button>
            </div>
          </>
        )}

        <button className="settings-logout-button" onClick={handleLogout}>
          <LogOut size={20} color="#fff" />
          {t('logout')}
        </button>
      </div>

      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => handleImageFile(event.target.files?.[0] || null)} />
      <input ref={galleryInputRef} type="file" accept="image/*" hidden onChange={(event) => handleImageFile(event.target.files?.[0] || null)} />

      {imagePickerOpen && (
        <div className="modal-overlay" onClick={() => setImagePickerOpen(false)}>
          <div className="modal-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="modal-handle"></div>
            <h3 className="settings-modal-title">Foto de perfil</h3>
            <div className="settings-modal-stack">
              <button className="settings-sheet-option" onClick={() => cameraInputRef.current?.click()}>📷 Sacar foto</button>
              <button className="settings-sheet-option" onClick={() => galleryInputRef.current?.click()}>🖼️ Galería</button>
              <button className="settings-sheet-cancel" onClick={() => setImagePickerOpen(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {passwordModalOpen && (
        <ModalSheet title={t('change_password')} onClose={() => setPasswordModalOpen(false)}>
          <input className="input-field" type="password" placeholder={t('current_password')} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          <input className="input-field" type="password" placeholder={t('new_password')} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
          <input className="input-field" type="password" placeholder={t('confirm_password')} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          <div className="settings-modal-actions">
            <button className="btn btn-outline" onClick={() => setPasswordModalOpen(false)}>{t('cancel')}</button>
            <button className="btn btn-primary" onClick={handleChangePassword} disabled={changingPassword}>{changingPassword ? '...' : t('update_password')}</button>
          </div>
        </ModalSheet>
      )}

      {slotModalOpen && (
        <ModalSheet title={t('add_slot')} onClose={() => setSlotModalOpen(false)}>
          <div className="settings-sub-label" style={{ padding: 0, marginTop: 0 }}>Día de la semana</div>
          <div className="settings-day-picker">
            {DAYS.map((day) => (
              <button key={day} className={`settings-day-chip ${newSlotDay === day ? 'is-active' : ''}`} style={newSlotDay === day ? { backgroundColor: primaryColor, borderColor: primaryColor } : undefined} onClick={() => setNewSlotDay(day)}>
                {day.slice(0, 1)}
              </button>
            ))}
          </div>
          <div className="settings-sub-label" style={{ padding: 0 }}>Hora de inicio (ej. 17:00)</div>
          <input className="input-field" type="time" value={newSlotTime} onChange={(event) => setNewSlotTime(event.target.value)} />
          <p className="settings-help-text">* Se sumará 1h 30min automáticamente al guardarse.</p>
          <div className="settings-modal-actions">
            <button className="btn btn-outline" onClick={() => setSlotModalOpen(false)}>{t('cancel')}</button>
            <button className="btn btn-primary" onClick={addTournamentSlot} disabled={savingSlot}>{savingSlot ? '...' : t('add_slot')}</button>
          </div>
        </ModalSheet>
      )}

      {masterPasswordModalOpen && (
        <ModalSheet title={t('change_master_password')} onClose={() => setMasterPasswordModalOpen(false)}>
          <input className="input-field" type="password" placeholder={t('new_master_password')} value={newMasterPassword} onChange={(event) => setNewMasterPassword(event.target.value)} />
          <div className="settings-modal-actions">
            <button className="btn btn-outline" onClick={() => setMasterPasswordModalOpen(false)}>{t('cancel')}</button>
            <button className="btn btn-primary" onClick={handleSaveMasterPassword} disabled={savingMasterPassword}>{savingMasterPassword ? '...' : t('save_changes')}</button>
          </div>
        </ModalSheet>
      )}
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  desc,
  value,
  onToggle,
}: {
  icon: ReactNode;
  label: string;
  desc?: string;
  value: boolean;
  onToggle: (value: boolean) => void;
}) {
  return (
    <button className="settings-toggle-row" onClick={() => onToggle(!value)}>
      <span className="settings-toggle-icon">{icon}</span>
      <span className="settings-toggle-texts">
        <span className="settings-toggle-label">{label}</span>
        {desc && <span className="settings-toggle-desc">{desc}</span>}
      </span>
      <span className={`settings-switch ${value ? 'is-on' : ''}`}>
        <span className="settings-switch-thumb"></span>
      </span>
    </button>
  );
}

function ModalSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="modal-handle"></div>
        <h3 className="settings-modal-title">{title}</h3>
        <div className="settings-modal-stack">{children}</div>
      </div>
    </div>
  );
}

function TrashIcon({ color }: { color: string }) {
  return <Trash2 size={18} color={color} />;
}
