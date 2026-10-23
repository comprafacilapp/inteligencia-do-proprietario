import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import './index.css';
import App from './App.tsx';
import Login from './Login.tsx';
import SiteComercial from './SiteComercial.tsx';
import { auth } from './firebase';

function AplicacaoProtegida() {
  const [usuario, setUsuario] = useState<User | null>(null);
  const [verificando, setVerificando] = useState(true);
  const [bloqueado, setBloqueado] = useState(false);

  useEffect(() => {
    const cancelar = onAuthStateChanged(
      auth,
      (usuarioAtual) => {
        setUsuario(usuarioAtual);
        setVerificando(false);

        if (!usuarioAtual) {
          setBloqueado(false);
          return;
        }

        const donoDosDados = localStorage.getItem(
          'prevanzia_proprietario_local'
        );

        const existemDadosAntigos = [
          'prevanzia_lancamentos_financeiros',
          'prevanzia_historico_importacoes',
        ].some((chave) => {
          const valor = localStorage.getItem(chave);
          return valor !== null && valor !== '[]';
        });

       // COLE O CÓDIGO NOVO AQUI

// Preserva dados antigos que ainda não possuem proprietário.
if (!donoDosDados && existemDadosAntigos) {
  setBloqueado(true);
  return;
}

// Não transfere dados antigos entre contas.
// Cada usuário mantém seus registros separados pelo UID.
if (!donoDosDados || donoDosDados === usuarioAtual.uid) {
  localStorage.setItem(
    'prevanzia_proprietario_local',
    usuarioAtual.uid
  );
}

// Permite a troca de contas autenticadas.
setBloqueado(false);
      },
      (erro) => {
        console.error('Erro de autenticação:', erro);
        setUsuario(null);
        setVerificando(false);
      }
    );

    return cancelar;
  }, []);

  if (verificando) {
    return (
      <main style={{ padding: 32 }}>Verificando acesso ao PREVANZIA...</main>
    );
  }

  if (!usuario) {
    return <Login />;
  }

  if (bloqueado) {
    return (
      <main
        style={{
          minHeight: '100vh',
          padding: 30,
          background: '#0e1b2d',
          color: 'white',
          fontFamily: 'Arial, sans-serif',
        }}
      >
        <h1>PREVANZIA</h1>
        <h2>Dados locais protegidos</h2>
        <p>
          Este navegador contém dados financeiros que ainda não foram associados
          com segurança à sua conta.
        </p>
        <p>
          Para evitar misturar informações de proprietários, o painel foi
          temporariamente bloqueado. Nenhum dado foi apagado.
        </p>
        <button onClick={() => signOut(auth)}>Sair da conta</button>
      </main>
    );
  }

  return <App key={usuario.uid} />;
}

// PREVANZIA — Navegação inicial do site comercial
const caminhoAtual = window.location.pathname;

const mostrarSiteComercial =
  caminhoAtual.endsWith('/site') ||
  caminhoAtual.endsWith('/site/');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {mostrarSiteComercial ? (
      <SiteComercial />
    ) : (
      <AplicacaoProtegida />
    )}
  </StrictMode>
);
// Registra o Service Worker somente na versão publicada.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((erro) => {
        console.error('Erro ao registrar Service Worker:', erro);
      });
  });
}
