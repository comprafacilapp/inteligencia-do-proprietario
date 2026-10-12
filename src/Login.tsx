import { useState, type FormEvent } from 'react';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from './firebase';

export default function Login() {
  const [modo, setModo] = useState<'entrar' | 'cadastrar'>('entrar');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState('');

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setMensagem('');
    setCarregando(true);

    try {
      if (modo === 'cadastrar') {
        await createUserWithEmailAndPassword(auth, email.trim(), senha);
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), senha);
      }
    } catch (erro: unknown) {
      const codigo =
        typeof erro === 'object' && erro !== null && 'code' in erro
          ? String(erro.code)
          : '';

      const mensagens: Record<string, string> = {
        'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
        'auth/invalid-email': 'Digite um e-mail válido.',
        'auth/weak-password': 'A senha é muito fraca.',
        'auth/invalid-credential': 'E-mail ou senha incorretos.',
        'auth/too-many-requests':
          'Muitas tentativas. Aguarde e tente novamente.',
        'auth/network-request-failed': 'Verifique sua conexão com a internet.',
      };

      setMensagem(mensagens[codigo] || 'Não foi possível concluir a operação.');
    } finally {
      setCarregando(false);
    }
  }

  async function recuperarSenha() {
    if (!email.trim()) {
      setMensagem('Digite seu e-mail para recuperar a senha.');
      return;
    }

    setCarregando(true);
    setMensagem('');

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMensagem(
        'Se o e-mail estiver cadastrado, você receberá instruções de recuperação.'
      );
    } catch {
      setMensagem(
        'Não foi possível solicitar a recuperação. Confira o e-mail e tente novamente.'
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0e1b2d',
        padding: 20,
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <section
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#ffffff',
          borderRadius: 18,
          padding: 32,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 25,
          }}
        >
          <div
            style={{
              background: '#28b5ae',
              color: '#082b39',
              padding: 14,
              borderRadius: 12,
              fontWeight: 'bold',
              fontSize: 24,
            }}
          >
            P
          </div>
          <div>
            <h1 style={{ margin: 0, color: '#10263d', fontSize: 25 }}>
              PREVANZIA
            </h1>
            <small style={{ color: '#65758a' }}>Inteligência empresarial</small>
          </div>
        </div>

        <h2 style={{ color: '#10263d' }}>
          {modo === 'entrar' ? 'Acessar minha conta' : 'Criar minha conta'}
        </h2>

        <form onSubmit={enviar}>
          <label htmlFor="login-email">E-mail</label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={campo}
          />

          <label htmlFor="login-senha">Senha</label>
          <input
            id="login-senha"
            type="password"
            required
            minLength={6}
            autoComplete={
              modo === 'entrar' ? 'current-password' : 'new-password'
            }
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            style={campo}
          />

          {mensagem && (
            <p role="status" style={{ color: '#a33a30', fontSize: 14 }}>
              {mensagem}
            </p>
          )}

          <button type="submit" disabled={carregando} style={botao}>
            {carregando
              ? 'Aguarde...'
              : modo === 'entrar'
              ? 'Entrar'
              : 'Criar conta'}
          </button>
        </form>

        {modo === 'entrar' && (
          <button
            type="button"
            disabled={carregando}
            onClick={recuperarSenha}
            style={botaoTexto}
          >
            Esqueci minha senha
          </button>
        )}

        <button
          type="button"
          disabled={carregando}
          onClick={() => {
            setModo(modo === 'entrar' ? 'cadastrar' : 'entrar');
            setMensagem('');
          }}
          style={botaoTexto}
        >
          {modo === 'entrar'
            ? 'Não tenho conta. Cadastrar'
            : 'Já tenho conta. Entrar'}
        </button>
      </section>
    </main>
  );
}

const campo = {
  display: 'block',
  width: '100%',
  padding: 12,
  marginTop: 7,
  marginBottom: 18,
  border: '1px solid #cbd5e1',
  borderRadius: 8,
  boxSizing: 'border-box' as const,
  fontSize: 16,
};

const botao = {
  width: '100%',
  padding: 14,
  border: 'none',
  borderRadius: 9,
  background: '#168c88',
  color: '#ffffff',
  fontSize: 16,
  fontWeight: 'bold' as const,
  cursor: 'pointer',
};

const botaoTexto = {
  display: 'block',
  margin: '17px auto 0',
  background: 'transparent',
  border: 'none',
  color: '#167b85',
  cursor: 'pointer',
  fontSize: 14,
};
