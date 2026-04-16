import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../services/firebaseConfig';
import { useTheme } from '../context/ThemeContext';
import './Auth.css';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { primaryColor } = useTheme();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!nombre || !email || !password) {
      window.alert('Error\n\nTodos los campos son obligatorios');
      return;
    }

    try {
      setLoading(true);
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = userCredential.user.uid;

      await setDoc(doc(db, 'users', uid), {
        email: email.trim(),
        nombreApellidos: nombre,
        role: 'user',
        grupos: [],
        fechaCreacion: new Date().toISOString(),
      });

      navigate('/');
    } catch (error: any) {
      window.alert(`Error al registrar\n\n${error.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-panel card">
        <h1 className="auth-title">Crear Cuenta</h1>

        <input
          className="input-field auth-input"
          placeholder="Nombre y Apellidos"
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
        />
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

        <button className="btn btn-primary auth-submit" style={{ backgroundColor: primaryColor }} onClick={handleRegister} disabled={loading}>
          {loading ? <div className="spinner small auth-spinner"></div> : 'Registrarme'}
        </button>

        <button className="auth-link-button" onClick={() => navigate('/login')}>
          Ya tengo cuenta. <span style={{ color: primaryColor }}>Iniciar sesion</span>
        </button>
      </div>
    </div>
  );
}
