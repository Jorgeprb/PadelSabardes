import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../services/firebaseConfig';
import { useNavigate, Link } from 'react-router-dom';
import './Auth.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return setError('Rellena todos los campos');
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: any) {
      setError('Credenciales incorrectas. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">🎾</div>
        <h1 className="auth-title">Padel Sabardes</h1>
        <p className="auth-subtitle">Inicia sesión para continuar</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            className="input-field"
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
          />
          <input
            className="input-field"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="auth-error">{error}</p>}
          <button className="btn btn-primary auth-btn" type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Iniciar Sesión'}
          </button>
        </form>

        <p className="auth-link">
          ¿No tienes cuenta? <Link to="/register">Regístrate</Link>
        </p>
      </div>
    </div>
  );
}
