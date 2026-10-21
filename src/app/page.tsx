'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function TelaAcessoLogin() {
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [isSplashActive, setIsSplashActive] = useState(false);
  const [splashData, setSplashData] = useState({
    nome: '',
    email: '',
    perfil: '',
    ultimoAcesso: ''
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError('Credenciais inválidas. Tente novamente.');
      setLoading(false);
    } else {
      const { data: userInfo } = await supabase
        .from('usuarios')
        .select(`nome_completo, cargos (nome)`)
        .eq('id', authData.user.id)
        .maybeSingle();

      const cargo = userInfo?.cargos as any;
      const dataAcesso = new Date().toLocaleString('pt-BR');

      setSplashData({
        nome: userInfo?.nome_completo || 'Usuário',
        email: authData.user.email || '',
        perfil: cargo?.nome || 'Sem perfil',
        ultimoAcesso: dataAcesso
      });

      setIsSplashActive(true);
      
      setTimeout(() => {
        router.push('/dashboard');
      }, 3500);
    }
  };

  if (isSplashActive) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center relative overflow-hidden py-10">
        <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100 z-10 w-full max-w-md transform transition-all animate-fade-in-down mb-12">
          <div className="flex items-center gap-4 border-b border-gray-100 pb-4 mb-4">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center text-[#F26522] font-bold text-xl">
              {splashData.nome.charAt(0)}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{splashData.nome}</h2>
              <p className="text-sm text-gray-500">{splashData.email}</p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex justify-between">
              <span className="font-medium">Perfil de Acesso:</span>
              <span className="text-[#F26522] font-semibold">{splashData.perfil}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-medium">Sessão Iniciada:</span>
              <span>{splashData.ultimoAcesso}</span>
            </div>
          </div>
          <div className="mt-6 flex justify-center">
            <div className="flex items-center gap-2 text-[#00A651] font-medium text-sm">
              <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
              Preparando ambiente...
            </div>
          </div>
        </div>

        <div className="z-10 w-[90%] max-w-6xl flex justify-center animate-fade-in-up">
          <img src="/Imagens/Splash.jpg" alt="Carregando ambiente..." className="w-full h-auto object-contain rounded-md shadow-sm" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-white overflow-hidden">
      {/* Lado Esquerdo - 70% da tela */}
      <div 
        className="hidden lg:flex lg:w-[70%] xl:w-[75%] bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/Imagens/Fundo.jpg')" }}
      >
      </div>

      {/* Lado Direito - 30% da tela */}
      <div className="w-full lg:w-[30%] xl:w-[25%] flex flex-col justify-center px-8 sm:px-12 lg:px-10 shadow-[-15px_0_30px_rgba(0,0,0,0.05)] z-10 relative bg-white min-w-[320px]">
        
        <div className="flex justify-center mb-10">
          <img src="/Imagens/Logo_Login.png" alt="CNX Telecom" className="h-20 w-auto object-contain" />
        </div>
        
        <div className="text-center mb-10">
          <h1 className="text-2xl xl:text-3xl font-extrabold text-gray-800 tracking-tight">Smart CNX</h1>
          <h2 className="text-gray-600 font-medium text-base xl:text-lg mt-1">Controle de Estoque</h2>
          <p className="text-gray-500 text-xs xl:text-sm mt-3">Insira suas credenciais para acessar</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F26522] focus:border-transparent transition-all text-sm"
              required
              placeholder="seu.email@cnxtelecom.com"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Senha</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-4 py-3 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#F26522] focus:border-transparent transition-all pr-12 text-sm"
                required
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-[#F26522] transition-colors"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3.5 rounded-md text-sm text-center font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#F26522] text-white font-bold py-3.5 rounded-md hover:bg-[#d9551a] transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4 shadow-md hover:shadow-lg text-sm"
          >
            {loading ? 'Autenticando...' : 'Acessar Sistema'}
          </button>
        </form>
        
      </div>
    </div>
  );
}