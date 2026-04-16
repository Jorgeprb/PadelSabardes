import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../services/firebaseConfig';
import { useTheme } from '../context/ThemeContext';
import './Auth.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const { primaryColor } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      window.alert('Error\n\nCompleta los campos');
      return;
    }

    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      navigate('/');
    } catch (error: any) {
      window.alert(`Error al iniciar sesion\n\n${error.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-panel card">
        <h1 className="auth-title">Padel Sabardes</h1>
        <p className="auth-subtitle">Inicia sesion para entrar a la pista</p>

        <input
          className="input-field auth-input"
          placeholder="Correo electronico"
          autoCapitalize="none"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          className="input-field auth-input"
          placeholder="Contrasena"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <button className="btn btn-primary auth-submit" style={{ backgroundColor: primaryColor }} onClick={handleLogin} disabled={loading}>
          {loading ? <div className="spinner small auth-spinner"></div> : 'Entrar'}
        </button>

        <button className="auth-link-button" onClick={() => navigate('/register')}>
          No tienes cuenta? <span style={{ color: primaryColor }}>Registrate</span>
        </button>
      </div>
    </div>
  );
}
