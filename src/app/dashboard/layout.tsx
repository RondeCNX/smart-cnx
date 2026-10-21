'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';

export default function EstruturaDashboardLayout({ children }: { children: React.ReactNode }) {
  
  const [isMovimentacoesOpen, setIsMovimentacoesOpen] = useState(false);
  const [isUnitFilterOpen, setIsUnitFilterOpen] = useState(false);
  
  const [userName, setUserName] = useState('Carregando...');
  const [userRole, setUserRole] = useState('...');
  const [lastAccess, setLastAccess] = useState('...');
  
  const [availableUnits, setAvailableUnits] = useState<{id: number, nome: string}[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<number[]>([]);
  const [isAllUnitsSelected, setIsAllUnitsSelected] = useState(true);

  useEffect(() => {
    async function fetchUserData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/';
        return;
      }

      if (user.last_sign_in_at) {
        const date = new Date(user.last_sign_in_at);
        setLastAccess(date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }));
      }

      const { data: userInfo } = await supabase
        .from('usuarios')
        .select(`nome_completo, cargos (nome), unidades (id, nome)`)
        .eq('id', user.id)
        .maybeSingle();

      if (userInfo) {
        setUserName(userInfo.nome_completo);
        const cargo = userInfo.cargos as any;
        setUserRole(cargo?.nome || 'Sem cargo');
      } else {
        setUserName('Perfil não encontrado');
      }

      const { data: units } = await supabase.from('unidades').select('id, nome').order('nome');
      if (units) {
        setAvailableUnits(units);
      }
    }
    
    fetchUserData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Força o navegador a recarregar a página raiz, destruindo qualquer estado antigo (como o Splash)
    window.location.href = '/';
  };

  const handleUnitToggle = (unitId: number) => {
    setIsAllUnitsSelected(false);
    if (selectedUnits.includes(unitId)) {
      setSelectedUnits(selectedUnits.filter(id => id !== unitId));
    } else {
      setSelectedUnits([...selectedUnits, unitId]);
    }
  };

  const handleAllUnitsToggle = () => {
    setIsAllUnitsSelected(!isAllUnitsSelected);
    if (!isAllUnitsSelected) {
      setSelectedUnits([]); 
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pt-16 pb-12">
      <header className="bg-[#F26522] text-white fixed top-0 w-full z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            
            <div className="flex-shrink-0 flex items-center gap-2">
              <Image 
                src="/Imagens/Logo.png" 
                alt="Logo CNX" 
                width={36} 
                height={36} 
                className="h-9 w-auto object-contain"
                priority 
              />
              <span className="font-extrabold text-2xl tracking-wider">CNX</span>
              <span className="font-light text-sm mt-1 border-l border-white/40 pl-2">Telecom</span>
            </div>

            <nav className="hidden md:flex space-x-8 items-center">
              <div className="relative">
                <button 
                  onClick={() => setIsMovimentacoesOpen(!isMovimentacoesOpen)}
                  onBlur={() => setTimeout(() => setIsMovimentacoesOpen(false), 200)}
                  className="hover:text-white/80 font-medium flex items-center transition-colors"
                >
                  Movimentações
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isMovimentacoesOpen && (
                  <div className="absolute left-0 mt-2 w-64 bg-white rounded-md shadow-lg py-2 border border-gray-100 text-gray-700 z-50">
                    <Link href="/dashboard/movimentacoes/solicitacao-transferencia" className="block px-4 py-2 text-sm hover:bg-orange-50 hover:text-[#F26522]">Solicitação de Transferência</Link>
                    <Link href="/dashboard/movimentacoes/solicitacao-equipamentos" className="block px-4 py-2 text-sm hover:bg-orange-50 hover:text-[#F26522]">Solicitação de Equipamentos</Link>
                    <div className="border-t border-gray-100 my-1"></div>
                    <Link href="/dashboard/movimentacoes/entrada-insumos" className="block px-4 py-2 text-sm hover:bg-orange-50 hover:text-[#F26522]">Entrada de Insumos</Link>
                    <Link href="/dashboard/movimentacoes/entrada-equipamentos" className="block px-4 py-2 text-sm hover:bg-orange-50 hover:text-[#F26522]">Entrada de Equipamentos</Link>
                    <div className="border-t border-gray-100 my-1"></div>
                    <Link href="/dashboard/movimentacoes/saida-insumos" className="block px-4 py-2 text-sm hover:bg-orange-50 hover:text-[#F26522]">Saída de Insumos</Link>
                    <Link href="/dashboard/movimentacoes/saida-equipamentos" className="block px-4 py-2 text-sm hover:bg-orange-50 hover:text-[#F26522]">Saída de Equipamentos</Link>
                  </div>
                )}
              </div>

              <Link href="/dashboard/inventario" className="hover:text-white/80 font-medium transition-colors">Inventário</Link>
              <Link href="/dashboard/relatorios" className="hover:text-white/80 font-medium transition-colors">Relatórios</Link>
              <Link href="/dashboard/configuracoes" className="hover:text-white/80 font-medium transition-colors">Configurações</Link>
              
              <button 
                onClick={handleLogout} 
                className="ml-4 bg-white text-[#F26522] px-4 py-1.5 rounded-full text-sm font-bold hover:bg-gray-100 transition-colors shadow-sm"
              >
                Sair
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="bg-white border-t border-gray-200 fixed bottom-0 w-full z-40 text-xs text-gray-600 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-10 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="font-semibold text-gray-800">{userName}</span>
            </div>
            <span className="hidden sm:inline border-l border-gray-300 pl-4">Perfil: <strong className="font-medium text-[#F26522]">{userRole}</strong></span>
            <span className="hidden md:inline border-l border-gray-300 pl-4">Último acesso: {lastAccess}</span>
          </div>

          <div className="relative">
            <button 
              onClick={() => setIsUnitFilterOpen(!isUnitFilterOpen)}
              className="flex items-center gap-2 font-medium bg-gray-50 border border-gray-200 px-3 py-1 rounded hover:bg-gray-100 transition-colors"
            >
              <span className="text-[#F26522]">
                <svg className="w-3.5 h-3.5 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </span>
              {isAllUnitsSelected ? 'Todas as Unidades' : `${selectedUnits.length} unidade(s) selecionada(s)`}
            </button>

            {isUnitFilterOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-64 bg-white rounded-md shadow-xl border border-gray-200 p-3 z-50">
                <div className="mb-2 pb-2 border-b border-gray-100">
                  <label className="flex items-center space-x-2 cursor-pointer p-1.5 hover:bg-orange-50 rounded">
                    <input 
                      type="checkbox" 
                      checked={isAllUnitsSelected}
                      onChange={handleAllUnitsToggle}
                      className="rounded border-gray-300 text-[#F26522] focus:ring-[#F26522]"
                    />
                    <span className="font-semibold text-gray-800">Todas as Unidades</span>
                  </label>
                </div>
                
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {availableUnits.map((unit) => (
                    <label key={unit.id} className="flex items-center space-x-2 cursor-pointer p-1.5 hover:bg-gray-50 rounded">
                      <input 
                        type="checkbox" 
                        checked={selectedUnits.includes(unit.id)}
                        onChange={() => handleUnitToggle(unit.id)}
                        disabled={isAllUnitsSelected}
                        className="rounded border-gray-300 text-[#F26522] focus:ring-[#F26522] disabled:opacity-50"
                      />
                      <span className={`${isAllUnitsSelected ? 'text-gray-400' : 'text-gray-700'}`}>{unit.nome}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}