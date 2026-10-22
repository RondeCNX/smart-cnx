'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { 
  FolderKanban, 
  Box, 
  Wrench, 
  Building2, 
  Warehouse, 
  ArrowRightLeft, 
  ClipboardList, 
  BarChart2, 
  Settings, 
  ChevronDown,
  LogOut,
  User,
  XCircle
} from 'lucide-react';

export default function EstruturaDashboardLayout({ children }: { children: React.ReactNode }) {
  
  const pathname = usePathname();
  const router = useRouter();
  const isDashboardRoot = pathname === '/dashboard';
  
  const [isCadastrosOpen, setIsCadastrosOpen] = useState(false);
  const [isMovimentacoesOpen, setIsMovimentacoesOpen] = useState(false);
  const [isUnitFilterOpen, setIsUnitFilterOpen] = useState(false);
  
  const menuCadastrosRef = useRef<HTMLDivElement>(null);
  const menuMovimentacoesRef = useRef<HTMLDivElement>(null);
  const filterUnitRef = useRef<HTMLDivElement>(null);
  
  const [userName, setUserName] = useState('Carregando...');
  const [userRole, setUserRole] = useState('...');
  const [lastAccess, setLastAccess] = useState('...');
  
  const [availableUnits, setAvailableUnits] = useState<{id: number, nome: string}[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<number[]>([]);
  const [isAllUnitsSelected, setIsAllUnitsSelected] = useState(true);

  // Fecha menus flutuantes ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuCadastrosRef.current && !menuCadastrosRef.current.contains(event.target as Node)) setIsCadastrosOpen(false);
      if (menuMovimentacoesRef.current && !menuMovimentacoesRef.current.contains(event.target as Node)) setIsMovimentacoesOpen(false);
      if (filterUnitRef.current && !filterUnitRef.current.contains(event.target as Node)) setIsUnitFilterOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Lógica Global da Tecla ESC (Aplica-se a todas as telas filhas automaticamente)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDashboardRoot) {
        router.push('/dashboard');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router, isDashboardRoot]);

  // Carregamento de Dados do Usuário
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
      const { data: userInfo } = await supabase.from('usuarios').select(`nome_completo, cargos (nome), unidades (id, nome)`).eq('id', user.id).maybeSingle();
      if (userInfo) {
        setUserName(userInfo.nome_completo);
        const cargo = userInfo.cargos as any;
        setUserRole(cargo?.nome || 'Sem cargo');
      } else {
        setUserName('Perfil não encontrado');
      }
      const { data: units } = await supabase.from('unidades').select('id, nome').order('nome');
      if (units) setAvailableUnits(units);
    }
    fetchUserData();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
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
    if (!isAllUnitsSelected) setSelectedUnits([]); 
  };

  return (
    <div className="h-screen w-full bg-gray-50 flex flex-col overflow-hidden">
      
      {/* Cabeçalho */}
      <header className={`bg-[#F26522] text-white shrink-0 shadow-md flex items-center transition-all duration-300 relative z-50 ${isDashboardRoot ? 'h-16' : 'h-10'}`}>
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-full">
            
            <div className="flex-shrink-0 flex items-center gap-2">
              <Image 
                src="/Imagens/Logo.png" 
                alt="Logo CNX" 
                width={isDashboardRoot ? 36 : 24} 
                height={isDashboardRoot ? 36 : 24} 
                className="object-contain transition-all"
                priority 
              />
              {isDashboardRoot && (
                <>
                  <span className="font-extrabold text-2xl tracking-wider">CNX</span>
                  <span className="font-light text-sm mt-1 border-l border-white/40 pl-2">Telecom</span>
                </>
              )}
            </div>

            <nav className="hidden md:flex space-x-6 items-center">
              <div className="relative" ref={menuCadastrosRef}>
                <button title={!isDashboardRoot ? "Cadastros" : ""} onClick={() => setIsCadastrosOpen(!isCadastrosOpen)} className="hover:text-white/80 font-medium flex items-center gap-1.5 transition-colors">
                  <FolderKanban className={isDashboardRoot ? "w-4 h-4" : "w-5 h-5"} />
                  {isDashboardRoot && <span>Cadastros</span>}
                  {isDashboardRoot && <ChevronDown className="w-4 h-4" />}
                </button>
                {isCadastrosOpen && (
                  <div className="absolute left-0 mt-2 w-56 bg-white rounded-md shadow-lg py-2 border border-gray-100 text-gray-700 z-50">
                    <Link href="/dashboard/cadastros/insumos" onClick={() => setIsCadastrosOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-orange-50 hover:text-[#F26522]"><Box className="w-4 h-4 text-gray-400" /> Insumos</Link>
                    <Link href="/dashboard/cadastros/equipamentos" onClick={() => setIsCadastrosOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-orange-50 hover:text-[#F26522]"><Wrench className="w-4 h-4 text-gray-400" /> Equipamentos</Link>
                    <Link href="/dashboard/cadastros/unidades" onClick={() => setIsCadastrosOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-orange-50 hover:text-[#F26522]"><Building2 className="w-4 h-4 text-gray-400" /> Unidades</Link>
                    <Link href="/dashboard/cadastros/almoxarifados" onClick={() => setIsCadastrosOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm hover:bg-orange-50 hover:text-[#F26522]"><Warehouse className="w-4 h-4 text-gray-400" /> Almoxarifados</Link>
                  </div>
                )}
              </div>

              <div className="relative" ref={menuMovimentacoesRef}>
                <button title={!isDashboardRoot ? "Movimentações" : ""} onClick={() => setIsMovimentacoesOpen(!isMovimentacoesOpen)} className="hover:text-white/80 font-medium flex items-center gap-1.5 transition-colors">
                  <ArrowRightLeft className={isDashboardRoot ? "w-4 h-4" : "w-5 h-5"} />
                  {isDashboardRoot && <span>Movimentações</span>}
                  {isDashboardRoot && <ChevronDown className="w-4 h-4" />}
                </button>
                {isMovimentacoesOpen && (
                  <div className="absolute left-0 mt-2 w-64 bg-white rounded-md shadow-lg py-2 border border-gray-100 text-gray-700 z-50">
                    <Link href="/dashboard/movimentacoes/solicitacao-transferencia" onClick={() => setIsMovimentacoesOpen(false)} className="block px-4 py-2 text-sm hover:bg-orange-50 hover:text-[#F26522]">Solicitação de Transferência</Link>
                    <Link href="/dashboard/movimentacoes/solicitacao-equipamentos" onClick={() => setIsMovimentacoesOpen(false)} className="block px-4 py-2 text-sm hover:bg-orange-50 hover:text-[#F26522]">Solicitação de Equipamentos</Link>
                    <div className="border-t border-gray-100 my-1"></div>
                    <Link href="/dashboard/movimentacoes/entrada-insumos" onClick={() => setIsMovimentacoesOpen(false)} className="block px-4 py-2 text-sm hover:bg-orange-50 hover:text-[#F26522]">Entrada de Insumos</Link>
                    <Link href="/dashboard/movimentacoes/entrada-equipamentos" onClick={() => setIsMovimentacoesOpen(false)} className="block px-4 py-2 text-sm hover:bg-orange-50 hover:text-[#F26522]">Entrada de Equipamentos</Link>
                    <div className="border-t border-gray-100 my-1"></div>
                    <Link href="/dashboard/movimentacoes/saida-insumos" onClick={() => setIsMovimentacoesOpen(false)} className="block px-4 py-2 text-sm hover:bg-orange-50 hover:text-[#F26522]">Saída de Insumos</Link>
                    <Link href="/dashboard/movimentacoes/saida-equipamentos" onClick={() => setIsMovimentacoesOpen(false)} className="block px-4 py-2 text-sm hover:bg-orange-50 hover:text-[#F26522]">Saída de Equipamentos</Link>
                  </div>
                )}
              </div>

              <Link href="/dashboard/inventario" title={!isDashboardRoot ? "Inventário" : ""} className="hover:text-white/80 font-medium flex items-center gap-1.5 transition-colors"><ClipboardList className={isDashboardRoot ? "w-4 h-4" : "w-5 h-5"} />{isDashboardRoot && <span>Inventário</span>}</Link>
              <Link href="/dashboard/relatorios" title={!isDashboardRoot ? "Relatórios" : ""} className="hover:text-white/80 font-medium flex items-center gap-1.5 transition-colors"><BarChart2 className={isDashboardRoot ? "w-4 h-4" : "w-5 h-5"} />{isDashboardRoot && <span>Relatórios</span>}</Link>
              <Link href="/dashboard/configuracoes" title={!isDashboardRoot ? "Configurações" : ""} className="hover:text-white/80 font-medium flex items-center gap-1.5 transition-colors"><Settings className={isDashboardRoot ? "w-4 h-4" : "w-5 h-5"} />{isDashboardRoot && <span>Configurações</span>}</Link>
              
              <button title={!isDashboardRoot ? "Sair" : ""} onClick={handleLogout} className={`ml-4 bg-white text-[#F26522] flex items-center gap-1.5 rounded-full font-bold hover:bg-gray-100 transition-colors shadow-sm ${isDashboardRoot ? 'px-4 py-1.5 text-sm' : 'p-1.5'}`}>
                <LogOut className="w-4 h-4" />
                {isDashboardRoot && <span>Sair</span>}
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col overflow-hidden relative z-0">
        
        {/* Menu Oculto de Fechamento */}
        {!isDashboardRoot && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 z-50 group flex flex-col items-center">
            <div className="h-6 w-48 bg-transparent absolute top-0"></div>
            <button 
              onClick={() => router.push('/dashboard')} 
              className="transform -translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-black hover:bg-gray-900 text-white px-4 py-1 rounded-b-md shadow-md text-xs font-bold flex items-center gap-1.5 pt-2 pb-1.5 mt-[-2px] border border-black border-t-0"
            >
              <XCircle className="w-3.5 h-3.5 text-red-500" /> 
              Fechar Tela
            </button>
          </div>
        )}

        {children}
      </main>

      {/* Rodapé Dinâmico */}
      <footer className={`bg-white border-t border-gray-200 shrink-0 flex items-center text-xs text-gray-600 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] transition-all duration-300 relative z-10 ${isDashboardRoot ? 'h-10' : 'h-8'}`}>
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between relative h-full">
          
          <div className="flex items-center h-full relative">
            <div className={`rounded-full flex items-center justify-center overflow-hidden transition-all duration-300 ${
              isDashboardRoot 
                ? 'absolute left-0 -top-4 w-10 h-10 z-50 shadow-md bg-white border-[3px] border-white' 
                : 'static w-6 h-6 mr-2 bg-slate-100 border border-slate-200'
            }`}>
              <User className={`text-slate-400 ${isDashboardRoot ? 'p-1.5' : 'p-[3px]'}`} />
            </div>
            
            {isDashboardRoot ? (
              <div className="ml-12 flex items-center">
                <span className="font-semibold text-gray-800">{userName}</span>
                <span className="border-l border-gray-300 pl-3 ml-3">Perfil: <strong className="font-medium text-[#F26522]">{userRole}</strong></span>
              </div>
            ) : (
              <div className="flex items-center font-medium text-gray-500">
                {userName}
              </div>
            )}
          </div>

          <div className="relative" ref={filterUnitRef}>
            <button 
              onClick={() => setIsUnitFilterOpen(!isUnitFilterOpen)}
              title={!isDashboardRoot ? (isAllUnitsSelected ? 'Todas as Unidades' : `${selectedUnits.length} unidade(s)`) : ''}
              className={`flex items-center gap-2 font-medium bg-gray-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors ${isDashboardRoot ? 'px-3 py-1' : 'p-1'}`}
            >
              <span className="text-[#F26522]">
                <Building2 className={`${isDashboardRoot ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />
              </span>
              {isDashboardRoot && (isAllUnitsSelected ? 'Todas as Unidades' : `${selectedUnits.length} unidade(s) selecionada(s)`)}
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