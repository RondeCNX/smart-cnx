'use client';

import { useState } from 'react';
import { 
  Eye, 
  RotateCcw, 
  Edit, 
  ToggleRight,
  Filter,
  Trash2,
  PackagePlus,
  ListPlus
} from 'lucide-react';

interface Insumo {
  id: string;
  codigo: string;
  descricao: string;
  grupo: string;
  unidadeMedida: string;
  status: 'ATIVO' | 'INATIVO';
}

interface Filtro {
  id: number;
  campo: string;
  valor: string;
}

export default function GestaoInsumos() {
  const [filtros, setFiltros] = useState<Filtro[]>([{ id: 1, campo: 'descricao', valor: '' }]);
  
  const [insumos] = useState<Insumo[]>([
    { id: '1', codigo: 'INS001', descricao: 'CABO DE REDE CAT6', grupo: 'CABEAMENTO', unidadeMedida: 'METRO', status: 'ATIVO' },
    { id: '2', codigo: 'INS002', descricao: 'CONECTOR RJ45', grupo: 'CONECTORES', unidadeMedida: 'UNIDADE', status: 'ATIVO' },
    { id: '3', codigo: 'INS003', descricao: 'FITA ISOLANTE 3M', grupo: 'DIVERSOS', unidadeMedida: 'ROLO', status: 'ATIVO' },
    { id: '4', codigo: 'INS004', descricao: 'ROTEADOR WI-FI 6', grupo: 'EQUIPAMENTOS', unidadeMedida: 'UNIDADE', status: 'INATIVO' },
    { id: '5', codigo: 'INS005', descricao: 'PARAFUSO SEXTAVADO M8', grupo: 'FERRAGENS', unidadeMedida: 'UNIDADE', status: 'ATIVO' },
    { id: '6', codigo: 'INS006', descricao: 'CABO DE FIBRA OPTICA DROP', grupo: 'FIBRA', unidadeMedida: 'METRO', status: 'ATIVO' },
    { id: '7', codigo: 'INS007', descricao: 'CAIXA HERMETICA PADRAO', grupo: 'FERRAGENS', unidadeMedida: 'UNIDADE', status: 'ATIVO' },
    { id: '8', codigo: 'INS008', descricao: 'BRAÇADEIRA DE NYLON 200MM', grupo: 'DIVERSOS', unidadeMedida: 'PACOTE', status: 'ATIVO' },
    { id: '9', codigo: 'INS009', descricao: 'ALICATE DE CRIMPAR RJ45', grupo: 'FERRAMENTAS', unidadeMedida: 'UNIDADE', status: 'ATIVO' },
    { id: '10', codigo: 'INS010', descricao: 'SPLITTER OPTICO 1X8', grupo: 'FIBRA', unidadeMedida: 'UNIDADE', status: 'ATIVO' },
    { id: '11', codigo: 'INS011', descricao: 'CORDÃO OPTICO SIMPLEX SC/APC', grupo: 'FIBRA', unidadeMedida: 'UNIDADE', status: 'ATIVO' },
    { id: '12', codigo: 'INS012', descricao: 'BUCHA DE PAREDE Nº 8', grupo: 'FERRAGENS', unidadeMedida: 'CENTO', status: 'ATIVO' },
    { id: '13', codigo: 'INS013', descricao: 'ONT GPON AC1200', grupo: 'EQUIPAMENTOS', unidadeMedida: 'UNIDADE', status: 'INATIVO' },
    { id: '14', codigo: 'INS014', descricao: 'CABO UTP CAT5E EXTERNO', grupo: 'CABEAMENTO', unidadeMedida: 'METRO', status: 'ATIVO' },
    { id: '15', codigo: 'INS015', descricao: 'CAIXA DE EMENDA OPTICA (CEO)', grupo: 'FIBRA', unidadeMedida: 'UNIDADE', status: 'ATIVO' },
    { id: '16', codigo: 'INS016', descricao: 'BATERIA ESTACIONARIA 12V 45AH', grupo: 'EQUIPAMENTOS', unidadeMedida: 'UNIDADE', status: 'ATIVO' },
  ]);

  const adicionarFiltro = () => {
    setFiltros([...filtros, { id: Date.now(), campo: 'descricao', valor: '' }]);
  };

  const removerFiltro = (id: number) => {
    if (filtros.length > 1) {
      setFiltros(filtros.filter(f => f.id !== id));
    } else {
      setFiltros([{ id: Date.now(), campo: 'descricao', valor: '' }]);
    }
  };

  const atualizarFiltro = (id: number, campo: string, valor: string) => {
    setFiltros(filtros.map(f => f.id === id ? { ...f, [campo]: valor } : f));
  };

  return (
    <div className="h-full bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col overflow-hidden">
      
      {/* Cabeçalho do Card */}
      <div className="bg-white border-b border-gray-200 px-5 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center shrink-0">
        <div>
          <h1 className="text-xl font-extrabold text-[#002B5B] leading-tight">Gestão de Insumos</h1>
          <p className="text-[11px] text-gray-500 mt-0.5 uppercase tracking-wider font-semibold">Gerencie o cadastro de materiais de consumo</p>
        </div>
        
        <button className="mt-2 sm:mt-0 bg-[#002B5B] hover:bg-[#001B3A] text-white pl-2 pr-4 py-2 rounded-md text-sm font-bold flex items-center transition-colors shadow-sm">
          <div className="bg-white/10 p-1.5 rounded mr-2 flex items-center justify-center">
            <PackagePlus className="w-4 h-4 text-[#F26522]" />
          </div>
          Novo Insumo
        </button>
      </div>

      {/* Box de Filtros */}
      <div className="px-5 py-4 border-b border-gray-200 shrink-0 bg-white flex items-start justify-between gap-6">
        <div className="flex-1 flex flex-col gap-3">
          {filtros.map((filtro) => (
            <div key={filtro.id} className="flex items-center shadow-sm rounded-md border border-gray-300 focus-within:ring-1 focus-within:ring-[#002B5B] focus-within:border-[#002B5B] bg-white transition-all w-fit">
              <select 
                value={filtro.campo}
                onChange={(e) => atualizarFiltro(filtro.id, 'campo', e.target.value)}
                className="px-3 py-1.5 text-xs text-[#002B5B] bg-slate-50 border-r border-gray-300 outline-none font-bold cursor-pointer rounded-l-md w-36"
              >
                <option value="descricao">Descrição</option>
                <option value="codigo">Código</option>
                <option value="grupo">Grupo</option>
                <option value="status">Status</option>
              </select>

              {filtro.campo === 'grupo' ? (
                <select 
                  value={filtro.valor}
                  onChange={(e) => atualizarFiltro(filtro.id, 'valor', e.target.value)}
                  className="px-3 py-1.5 text-xs text-gray-700 bg-transparent outline-none w-[430px] cursor-pointer"
                >
                  <option value="">Selecione um grupo...</option>
                  <option value="CABEAMENTO">CABEAMENTO</option>
                  <option value="CONECTORES">CONECTORES</option>
                  <option value="DIVERSOS">DIVERSOS</option>
                  <option value="EQUIPAMENTOS">EQUIPAMENTOS</option>
                  <option value="FERRAGENS">FERRAGENS</option>
                  <option value="FERRAMENTAS">FERRAMENTAS</option>
                  <option value="FIBRA">FIBRA</option>
                </select>
              ) : filtro.campo === 'status' ? (
                <select 
                  value={filtro.valor}
                  onChange={(e) => atualizarFiltro(filtro.id, 'valor', e.target.value)}
                  className="px-3 py-1.5 text-xs text-gray-700 bg-transparent outline-none w-[430px] cursor-pointer"
                >
                  <option value="">Selecione o status...</option>
                  <option value="ATIVO">ATIVO</option>
                  <option value="INATIVO">INATIVO</option>
                </select>
              ) : (
                <input 
                  type="text" 
                  placeholder={`Buscar por ${filtro.campo}...`}
                  value={filtro.valor}
                  onChange={(e) => atualizarFiltro(filtro.id, 'valor', e.target.value)}
                  className="px-3 py-1.5 text-xs text-gray-700 bg-transparent outline-none w-[430px] uppercase"
                />
              )}

              <button 
                onClick={() => removerFiltro(filtro.id)}
                className="px-3 py-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors border-l border-gray-300 rounded-r-md"
                title="Excluir filtro"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <button 
          onClick={adicionarFiltro}
          className="shrink-0 bg-orange-50 hover:bg-orange-100 text-[#F26522] border border-orange-200 px-4 py-2 rounded-md text-xs font-bold flex items-center gap-2 transition-colors shadow-sm mt-0.5"
        >
          <ListPlus className="w-4 h-4" />
          Adicionar Filtro
        </button>
      </div>

      {/* Barra de Resumo */}
      <div className="bg-[#E2E8F0] px-5 py-1.5 border-b border-gray-300 flex justify-between items-center text-[11px] shrink-0">
        <span className="font-bold text-[#002B5B] uppercase tracking-wider">Total: {insumos.length}</span>
        <span className="text-gray-600 flex items-center gap-1 font-medium">
          <Filter className="w-3 h-3" />
          Mostrando todos os registros
        </span>
      </div>

      {/* Tabela de Dados */}
      <div className="flex-1 overflow-auto bg-white">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead className="sticky top-0 z-10 bg-[#002B5B] text-white text-xs shadow-sm">
            <tr>
              <th className="px-5 py-2.5 font-semibold w-24 border-r border-[#001B3A]/50">Código</th>
              <th className="px-5 py-2.5 font-semibold border-r border-[#001B3A]/50">Descrição</th>
              <th className="px-5 py-2.5 font-semibold border-r border-[#001B3A]/50">Grupo</th>
              <th className="px-5 py-2.5 font-semibold border-r border-[#001B3A]/50">U.M.</th>
              <th className="px-5 py-2.5 font-semibold text-center w-24 border-r border-[#001B3A]/50">Status</th>
              <th className="px-5 py-2.5 font-semibold text-center w-36">Ações</th>
            </tr>
          </thead>
          
          <tbody className="text-[12px] text-gray-700">
            {insumos.map((insumo) => (
              <tr key={insumo.id} className="even:bg-slate-50 hover:bg-orange-50 transition-colors border-b border-gray-100">
                <td className="px-5 py-2 font-bold text-gray-900">{insumo.codigo}</td>
                <td className="px-5 py-2 font-medium">{insumo.descricao}</td>
                <td className="px-5 py-2 text-gray-600">{insumo.grupo}</td>
                <td className="px-5 py-2 text-gray-600">{insumo.unidadeMedida}</td>
                <td className="px-5 py-2 text-center">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold ${
                    insumo.status === 'ATIVO' 
                      ? 'bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6]' 
                      : 'bg-[#FCE8E6] text-[#C5221F] border border-[#FAD2CF]'
                  }`}>
                    {insumo.status}
                  </span>
                </td>
                <td className="px-5 py-2">
                  <div className="flex justify-center items-center gap-3 text-[#002B5B]">
                    <button className="hover:text-[#F26522] transition-colors" title="Visualizar">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="hover:text-[#F26522] transition-colors" title="Histórico">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button className="hover:text-[#F26522] transition-colors" title="Editar">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button className={`transition-colors ${insumo.status === 'ATIVO' ? 'text-[#137333] hover:text-green-800' : 'text-gray-400 hover:text-gray-500'}`} title="Alterar Status">
                      <ToggleRight className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}