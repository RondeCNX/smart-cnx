'use client';

export default function Dashboard() {
  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 border-l-4 border-l-[#00A651]">
        <h2 className="text-xl font-bold text-gray-800">Visão Geral do Estoque</h2>
        <p className="text-gray-500 mt-1">Selecione uma opção no menu superior para iniciar as movimentações.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col">
          <span className="text-gray-500 text-sm font-medium">Requisições Pendentes</span>
          <span className="text-3xl font-bold text-gray-800 mt-2">0</span>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col">
          <span className="text-gray-500 text-sm font-medium">Itens em Baixo Estoque</span>
          <span className="text-3xl font-bold text-[#E31E24] mt-2">0</span>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex flex-col">
          <span className="text-gray-500 text-sm font-medium">Entradas na Semana</span>
          <span className="text-3xl font-bold text-[#00AEEF] mt-2">0</span>
        </div>
      </div>
    </div>
  );
}