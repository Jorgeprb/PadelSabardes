import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebaseConfig';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email || !password) return setError('Rellena todos los campos');
    if (password !== confirm) return setError('Las contraseñas no coinciden');
    if (password.length < 6) return setError('La contraseña necesita al menos 6 caracteres');
    setLoading(true);
    setError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, 'users', cred.user.uid), {
        email,
        nombreApellidos: name.trim(),
        role: 'user',
        grupos: [],
        fechaCreacion: new Date().toISOString(),
      });
      navigate('/');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') setError('Este correo ya está registrado.');
      else setError('Error al registrar. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🎾</div>
        <h1 className="auth-title">Crear Cuenta</h1>
        <p className="auth-subtitle">Regístrate en Padel Sabardes</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <input className="input-field" type="text" placeholder="Nombre y apellidos" value={name} onChange={e => setName(e.target.value)} />
          <input className="input-field" type="email" placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
          <input className="input-field" type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} />
          <input className="input-field" type="password" placeholder="Confirmar contraseña" value={confirm} onChange={e => setConfirm(e.target.value)} />
          {error && <p className="auth-error">{error}</p>}
          <button className="btn btn-primary auth-btn" type="submit" disabled={loading}>
            {loading ? 'Creando...' : 'Registrarse'}
          </button>
        </form>

        <p className="auth-link">
          ¿Ya tienes cuenta? <Link to="/login">Inicia sesión</Link>
        </p>
      </div>
    </div>
  );
}
