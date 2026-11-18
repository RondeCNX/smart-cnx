// js/admin.js
document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    try {
        const { data: { session }, error } = await window.db.auth.getSession();
        if (error || !session) { window.location.replace('../index.html'); return; }
        carregarPerfilRodape(session.user.id);
        carregarFiltroAlmoxarifados();
        navegarPara('dashboard');
    } catch (err) { window.location.replace('../index.html'); }
});

function toggleDropdown(id) {
    document.querySelectorAll('.dropdown-menu').forEach(el => { if (el.id !== id) el.classList.remove('show'); });
    const menu = document.getElementById(id);
    if (menu) menu.classList.toggle('show');
}
document.addEventListener('click', (e) => {
    if (!e.target.closest('.has-dropdown')) document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('show'));
});

async function carregarPerfilRodape(userId) {
    try {
        const { data: userInfo } = await window.db.from('usuarios').select('nome_completo, avatar_url, cargos(nome)').eq('id', userId).single();
        if (userInfo) {
            document.getElementById('layout-nome-usuario').innerText = userInfo.nome_completo;
            document.getElementById('layout-cargo-usuario').innerText = userInfo.cargos?.nome || 'Membro';
            if (userInfo.avatar_url) document.getElementById('layout-avatar').innerHTML = `<img src="${userInfo.avatar_url}" alt="Avatar">`;
        }
    } catch (err) {}
}

async function carregarFiltroAlmoxarifados() {
    try {
        const { data: almoxData } = await window.db.from('almoxarifados').select('id, codigo, descricao').eq('status', 'ATIVO').order('descricao');
        if (almoxData) {
            let html = '';
            almoxData.forEach(almox => {
                html += `<label class="checkbox-label disabled"><input type="checkbox" class="chk-almox-item" value="${almox.id}" disabled onchange="atualizarLabelFiltro()"><span>${almox.codigo} - ${almox.descricao}</span></label>`;
            });
            document.getElementById('lista-almoxarifados').innerHTML = html;
        }
    } catch (err) {}
}
function toggleTodosAlmoxarifados(checkbox) {
    const isChecked = checkbox.checked;
    document.querySelectorAll('.chk-almox-item').forEach(item => { item.disabled = isChecked; if (isChecked) item.checked = false; });
    document.querySelectorAll('.filtro-lista .checkbox-label').forEach(lbl => { if (isChecked) lbl.classList.add('disabled'); else lbl.classList.remove('disabled'); });
    if (isChecked) document.getElementById('label-filtro-almox').innerText = "Todos os Almoxarifados";
    else atualizarLabelFiltro();
}
function atualizarLabelFiltro() {
    const qt = document.querySelectorAll('.chk-almox-item:checked').length;
    document.getElementById('label-filtro-almox').innerText = qt === 0 ? "Nenhum selecionado" : `${qt} almoxarifado(s)`;
}
async function fazerLogout() { await window.db.auth.signOut(); window.location.replace('../index.html'); }

// ================= UTILITÁRIO GLOBAL: POP-UPS E CONFIRMAÇÕES =================
let alertTimeout = null;

window.appConfirm = function(title, message, type = 'warning', confirmText = 'Confirmar', cancelText = 'Cancelar') {
    return new Promise((resolve) => {
        const popup = document.getElementById('global-popup');
        const titleEl = document.getElementById('popup-title');
        const msgEl = document.getElementById('popup-message');
        const iconEl = document.getElementById('popup-icon');
        const btnConfirm = document.getElementById('popup-btn-confirm');
        const btnCancel = document.getElementById('popup-btn-cancel');

        if (alertTimeout) clearTimeout(alertTimeout);

        titleEl.innerText = title;
        msgEl.innerHTML = message;
        
        btnConfirm.innerText = confirmText;
        btnCancel.innerText = cancelText;

        iconEl.className = 'popup-icon-wrapper';
        btnConfirm.className = 'popup-btn confirm';
        
        let iconName = 'info';
        if (type === 'warning') { iconName = 'alert-triangle'; iconEl.classList.add('warning'); }
        else if (type === 'error' || type === 'danger') { iconName = 'alert-circle'; iconEl.classList.add('error'); btnConfirm.classList.add('danger'); }
        else if (type === 'success') { iconName = 'check-circle'; iconEl.classList.add('success'); }
        else { iconEl.classList.add('info'); }

        iconEl.innerHTML = `<i data-lucide="${iconName}"></i>`;
        lucide.createIcons();

        const handleConfirm = () => { fechar(); resolve(true); };
        const handleCancel = () => { fechar(); resolve(false); };
        
        btnConfirm.onclick = handleConfirm;
        btnCancel.onclick = handleCancel;
        
        btnConfirm.style.display = 'flex';
        btnCancel.style.display = 'flex';

        popup.classList.add('show');

        function fechar() {
            popup.classList.remove('show');
            btnConfirm.onclick = null;
            btnCancel.onclick = null;
        }
    });
};

window.appAlert = function(title, message, type = 'info', tempoMs = 2500) {
    const popup = document.getElementById('global-popup');
    const titleEl = document.getElementById('popup-title');
    const msgEl = document.getElementById('popup-message');
    const iconEl = document.getElementById('popup-icon');
    const btnConfirm = document.getElementById('popup-btn-confirm');
    const btnCancel = document.getElementById('popup-btn-cancel');

    if (alertTimeout) clearTimeout(alertTimeout);

    titleEl.innerText = title;
    msgEl.innerHTML = message;
    
    iconEl.className = 'popup-icon-wrapper';
    
    let iconName = 'info';
    if (type === 'warning') { iconName = 'alert-triangle'; iconEl.classList.add('warning'); }
    else if (type === 'error' || type === 'danger') { iconName = 'alert-circle'; iconEl.classList.add('error'); }
    else if (type === 'success') { iconName = 'check-circle'; iconEl.classList.add('success'); }
    else { iconEl.classList.add('info'); }

    iconEl.innerHTML = `<i data-lucide="${iconName}"></i>`;
    lucide.createIcons();

    btnConfirm.style.display = 'none';
    btnCancel.style.display = 'none';

    popup.classList.add('show');

    alertTimeout = setTimeout(() => {
        popup.classList.remove('show');
    }, tempoMs);
};

window.abrirHistorico = async function(tabela, registroId) {
    window.almoxarifadosCacheMap = {}; window.usuariosCacheMap = {}; window.produtosCacheMap = {};
    
    try {
        const [resA, resU, resP] = await Promise.all([
            window.db.from('almoxarifados').select('id, codigo, descricao'),
            window.db.from('usuarios').select('id, nome_completo'),
            window.db.from('produtos').select('id, codigo, descricao')
        ]);
        if (resA.data) resA.data.forEach(a => window.almoxarifadosCacheMap[String(a.id).toLowerCase()] = `${a.codigo} - ${a.descricao}`);
        if (resU.data) resU.data.forEach(u => window.usuariosCacheMap[String(u.id).toLowerCase()] = u.nome_completo);
        if (resP.data) resP.data.forEach(p => window.produtosCacheMap[String(p.id).toLowerCase()] = `${p.codigo} - ${p.descricao}`);
    } catch (e) { console.error("Erro cache histórico:", e); }

    const modal = document.getElementById('global-historico-modal');
    const content = document.getElementById('historico-content');
    modal.classList.add('show');
    
    content.innerHTML = `<div style="text-align: center; padding: 4rem; color: #94a3b8;"><i data-lucide="loader-2" class="lucide-spin" style="width: 48px; height: 48px; color: var(--cnx-orange);"></i><p style="margin-top: 1.5rem; font-weight: 600;">Buscando registos e agrupando transações...</p></div>`;
    lucide.createIcons();

    try {
        let query = window.db.from('logs_auditoria').select('*, usuarios(nome_completo)').eq('tabela', tabela).eq('registro_id', registroId);
        const { data: logsReq, error } = await query;
        if (error) throw error;
        
        let todosLogs = logsReq || [];

        if (tabela === 'requisicoes' || tabela === 'emprestimos' || tabela === 'ajustes_estoque') {
            let idsFilhos = [];
            
            if (tabela === 'requisicoes') {
                const { data: itens } = await window.db.from('requisicao_itens').select('id').eq('requisicao_id', registroId);
                if (itens) idsFilhos = [...idsFilhos, ...itens.map(i => i.id)];
                
                const { data: diverg } = await window.db.from('requisicao_divergencias').select('id').eq('requisicao_id', registroId);
                if (diverg) idsFilhos = [...idsFilhos, ...diverg.map(d => d.id)];
                
                const { data: logsDeletados } = await window.db.from('logs_auditoria').select('registro_id').eq('tabela', 'requisicao_itens').eq('acao', 'DELETE').ilike(`dados_anteriores->>requisicao_id`, registroId);
                if (logsDeletados) idsFilhos = [...idsFilhos, ...logsDeletados.map(l => l.registro_id)];
            } 
            else if (tabela === 'emprestimos') {
                const { data: itens } = await window.db.from('emprestimo_itens').select('id').eq('emprestimo_id', registroId);
                if (itens) idsFilhos = [...idsFilhos, ...itens.map(i => i.id)];
                
                const { data: logsDeletados } = await window.db.from('logs_auditoria').select('registro_id').eq('tabela', 'emprestimo_itens').eq('acao', 'DELETE').ilike(`dados_anteriores->>emprestimo_id`, registroId);
                if (logsDeletados) idsFilhos = [...idsFilhos, ...logsDeletados.map(l => l.registro_id)];
            }
            // NOVO: Busca MACs amarrados ou desvinculados
            else if (tabela === 'ajustes_estoque') {
                const { data: itens } = await window.db.from('coletas_mac').select('id').eq('ajuste_estoque_id', registroId);
                if (itens) idsFilhos = [...idsFilhos, ...itens.map(i => i.id)];
                
                const { data: logsDesvinculados } = await window.db.from('logs_auditoria').select('registro_id').eq('tabela', 'coletas_mac').ilike(`dados_anteriores->>ajuste_estoque_id`, registroId);
                if (logsDesvinculados) idsFilhos = [...idsFilhos, ...logsDesvinculados.map(l => l.registro_id)];
            }
            
            if (idsFilhos.length > 0) {
                idsFilhos = [...new Set(idsFilhos)]; 
                const { data: logsFilhos } = await window.db.from('logs_auditoria')
                    .select('*, usuarios(nome_completo)')
                    .in('registro_id', idsFilhos);
                if (logsFilhos) todosLogs = [...todosLogs, ...logsFilhos];
            }
        }

        todosLogs.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));

        if (todosLogs.length === 0) {
            content.innerHTML = `<div style="text-align: center; padding: 4rem; color: #64748b;">Nenhum registo encontrado.</div>`; return;
        }

        let reqCriadaEmTime = 0;
        if (tabela === 'requisicoes' || tabela === 'emprestimos' || tabela === 'ajustes_estoque') {
            const logCriacaoReq = todosLogs.find(l => l.tabela === tabela && (l.acao === 'INSERT' || l.acao === 'CRIAR'));
            if (logCriacaoReq) reqCriadaEmTime = new Date(logCriacaoReq.criado_em).getTime();
        }

        let gruposTransacao = [];
        
        todosLogs.forEach(log => {
            const logTime = new Date(log.criado_em).getTime();
            const autor = log.usuarios ? log.usuarios.nome_completo : 'Sistema Automático';
            const acaoUpper = String(log.acao || '').toUpperCase();
            
            if (acaoUpper === 'INSERT' && (log.tabela === 'requisicao_itens' || log.tabela === 'emprestimo_itens' || log.tabela === 'coletas_mac')) {
                if (reqCriadaEmTime > 0 && Math.abs(logTime - reqCriadaEmTime) < 10000) return;
            }

            const detalhesHtml = formatarDadosLog(log.dados_anteriores, log.dados_novos, log.tabela);
            
            if (detalhesHtml === '' && acaoUpper === 'UPDATE') return;
            if (detalhesHtml === '' && acaoUpper === 'DELETE') return;

            let grupoEncontrado = gruposTransacao.find(g => g.autor === autor && Math.abs(g.tempoBase - logTime) <= 3000);
            
            if (grupoEncontrado) {
                grupoEncontrado.logs.push({ log, detalhesHtml });
            } else {
                gruposTransacao.push({
                    tempoBase: logTime,
                    autor: autor,
                    criado_em: log.criado_em,
                    logs: [{ log, detalhesHtml }]
                });
            }
        });

        let html = '<div class="timeline">';
        
        gruposTransacao.forEach(grupo => {
            const dataFormatada = new Date(grupo.criado_em).toLocaleString('pt-BR');
            let acaoCor = '#64748b'; let acaoIcon = 'activity'; let acaoTexto = 'ATUALIZADO';
            
            const temInsertPai = grupo.logs.some(l => (l.log.acao === 'INSERT' || l.log.acao === 'CRIAR') && l.log.tabela === tabela);
            const temDelete = grupo.logs.some(l => l.log.acao === 'DELETE' || l.log.acao === 'INATIVAR');
            const temUpdate = grupo.logs.some(l => l.log.acao === 'UPDATE' || l.log.acao === 'EDITAR');

            if (temInsertPai) { acaoCor = '#10b981'; acaoIcon = 'plus-circle'; acaoTexto = 'CRIADO'; } 
            else if (temUpdate) { acaoCor = '#f59e0b'; acaoIcon = 'edit-3'; acaoTexto = 'ATUALIZADO'; } 
            else if (temDelete) { acaoCor = '#ef4444'; acaoIcon = 'trash-2'; acaoTexto = 'ITENS EXCLUÍDOS'; }

            let htmlTransacaoCompleta = '';
            grupo.logs.forEach(l => {
                htmlTransacaoCompleta += l.detalhesHtml;
            });

            html += `
                <div class="timeline-item">
                    <div class="timeline-icon" style="background: ${acaoCor}15; color: ${acaoCor};">
                        <i data-lucide="${acaoIcon}"></i>
                    </div>
                    <div class="timeline-content">
                        <div class="timeline-header">
                            <strong style="color: ${acaoCor};">${acaoTexto}</strong>
                            <span>${dataFormatada}</span>
                        </div>
                        <div class="timeline-user"><i data-lucide="user"></i> ${grupo.autor}</div>
                        ${htmlTransacaoCompleta}
                    </div>
                </div>
            `;
        });
        
        content.innerHTML = html + '</div>';
        lucide.createIcons();
    } catch (err) { content.innerHTML = `<div style="text-align: center; padding: 3rem; color: #ef4444;">Falha ao buscar histórico.</div>`; }
};

function formatarDadosLog(antigos, novos, tabelaOrigem = null) {
    if (!antigos && !novos) return '';
    let html = '<div class="timeline-details" style="display:flex; flex-direction:column; gap:0.25rem; padding-top: 0.5rem; border-top: 1px dashed #e2e8f0; margin-top: 0.5rem;">';
    
    const chavesIgnoradas = ['id', 'created_at', 'modificado_em', 'atualizado_em', 'requisicao_id', 'emprestimo_id', 'senha', 'avatar_url', 'qtd_devolvida'];
    
    if (tabelaOrigem === 'requisicao_itens' && antigos && novos && novos.qtd_enviada && antigos.qtd_enviada !== novos.qtd_enviada) {
        if (Number(novos.qtd_enviada) === Number(novos.qtd_aprovada)) chavesIgnoradas.push('qtd_enviada');
    }

    const rotulosAmigaveis = {
        'codigo': 'Código Interno', 'descricao': 'Descrição', 'status': 'Status',
        'almoxarifado_abastecedor_id': 'Abastecedor (Origem)', 'almoxarifado_requisitante_id': 'Solicitante (Destino)',
        'usuario_atendente_id': 'Atendente', 'usuario_solicitante_id': 'Solicitante',
        'observacoes_solicitacao': 'Obs. Solicitação', 'dados_envio': 'Dados Envio', 'numero_pedido': 'Pedido ERP',
        'produto_id': 'Equipamento / Produto', 'qtd_solicitada': 'Qtd. Solicitada', 'qtd_aprovada': 'Qtd. Aprovada', 
        'qtd_enviada': 'Qtd. Enviada', 'qtd_recebida': 'Qtd. Conferida/Recebida', 'justificativa': 'Justificativa',
        'responsavel': 'Responsável Pelo Empréstimo', 'data_emprestimo': 'Data de Abertura', 
        'previsao_devolucao': 'Previsão de Devolução', 'data_devolucao': 'Devolução Efetiva',
        'qtd_emprestada': 'Qtd. de Saída (Emprestada)', 'observacoes': 'Observações Adicionais',
        'arquivo_assinatura': 'Documento de Assinatura (Ficha)',
        // CORREÇÃO: Nomes bonitos para as alterações dos MACs
        'ajuste_estoque_id': 'Vínculo com Lote (ID)',
        'produto_patrimonio_erp': 'Novo Patrimônio ERP',
        'mac': 'MAC (Gpon)',
        'numero_serie': 'Nº de Série'
    };

    const formatarValorAmigavel = (chave, valor) => {
        if (valor === null || valor === '' || valor === undefined || valor === 'NULO') return '<span style="color: #94a3b8; font-style: italic;">Nenhum</span>';
        if (typeof valor === 'boolean') return valor ? 'SIM' : 'NÃO';
        
        const chaveLower = String(chave || '').toLowerCase();
        
        if (chaveLower === 'arquivo_assinatura' && typeof valor === 'string' && valor.includes('http')) {
            return `<span style="color:#10b981; font-weight:800; display:inline-flex; align-items:center; gap:4px;"><i data-lucide="file-check-2" style="width:14px; height:14px;"></i> FICHA DIGITALIZADA / ANEXADA</span>`;
        }
        
        if (chaveLower.includes('data') || chaveLower.includes('previsao')) {
            if (typeof valor === 'string' && valor.includes('-')) {
                const dateParts = valor.split('T')[0].split('-');
                if (dateParts.length === 3) return `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`;
            }
        }

        if (chaveLower.includes('almoxarifado') && typeof valor === 'string' && valor.length > 20) return window.almoxarifadosCacheMap[valor.toLowerCase()] || 'Almoxarifado Desconhecido';
        if (chaveLower.includes('usuario') && typeof valor === 'string' && valor.length > 20) return window.usuariosCacheMap[valor.toLowerCase()] || 'Usuário Desconhecido';
        if (chaveLower === 'produto_id' && typeof valor === 'string' && valor.length > 20) return window.produtosCacheMap[valor.toLowerCase()] || 'Equipamento Desconhecido';
        
        return String(valor);
    };

    const renderObjectDiff = (objAntigo, objNovo, chavePai = null) => {
        let vAntigo = objAntigo; let vNovo = objNovo;
        if (chavePai) {
            vAntigo = formatarValorAmigavel(chavePai, objAntigo);
            vNovo = formatarValorAmigavel(chavePai, objNovo);
        } else {
            vAntigo = objAntigo === null || objAntigo === '' ? 'Nenhum' : String(objAntigo);
            vNovo = objNovo === null || objNovo === '' ? 'Nenhum' : String(objNovo);
        }

        if (String(objAntigo) !== String(objNovo)) {
            if (typeof vAntigo === 'string') vAntigo = vAntigo.replace(/\n/g, '<br>');
            if (typeof vNovo === 'string') vNovo = vNovo.replace(/\n/g, '<br>');
            return { antigo: `<div style="margin-bottom: 2px;">${vAntigo}</div>`, novo: `<div style="margin-bottom: 2px;">${vNovo}</div>`, hasDiff: true };
        }
        return { antigo: '', novo: '', hasDiff: false };
    };

    let produtoDoContexto = '';
    if (tabelaOrigem === 'requisicao_itens' || tabelaOrigem === 'requisicao_divergencias' || tabelaOrigem === 'emprestimo_itens') {
        const prodId = (novos && novos.produto_id) || (antigos && antigos.produto_id) || null;
        if (prodId && String(prodId).length > 20) {
            produtoDoContexto = window.produtosCacheMap[String(prodId).toLowerCase()] || 'Desconhecido';
        }
    } 
    // CORREÇÃO: Dá um título ao bloquinho de histórico mostrando qual MAC sofreu alteração (Vincular/Desvincular)
    else if (tabelaOrigem === 'coletas_mac') {
        const macInfo = (novos && novos.mac) || (antigos && antigos.mac) || null;
        if (macInfo) produtoDoContexto = `Equipamento MAC: ${macInfo}`;
    }

    if (antigos && novos) { // UPDATE
        let temAlteracao = false;
        let blocosDiff = '';
        for (const key in novos) {
            if (chavesIgnoradas.includes(key.toLowerCase())) continue;
            const diffResult = renderObjectDiff(antigos[key], novos[key], key);
            if (diffResult.hasDiff) {
                temAlteracao = true;
                const labelKey = key.toLowerCase();
                let keyLabel = rotulosAmigaveis[labelKey] || key.replace(/_/g, ' ');
                
                blocosDiff += `
                    <div style="background: white; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; margin-bottom: 4px;">
                        <div style="background: #f8fafc; padding: 4px 8px; font-size: 0.6rem; font-weight: 800; color: var(--cnx-blue); border-bottom: 1px solid #e2e8f0; text-transform: uppercase;">Modificação em: ${keyLabel}</div>
                        <div style="display: flex; flex-direction: row; width: 100%;">
                            <div style="flex: 1; padding: 6px 8px; background: #fef2f2; color: #991b1b; border-right: 1px solid #e2e8f0; font-family: inherit; font-size: 0.7rem; text-align: left;">
                                <div style="text-decoration: line-through; opacity: 0.7; margin-bottom: 4px; font-size: 0.6rem; font-weight: 700;">ANTERIOR:</div>${diffResult.antigo}
                            </div>
                            <div style="flex: 1; padding: 6px 8px; background: #ecfdf5; color: #065f46; font-family: inherit; font-size: 0.7rem; text-align: left;">
                                <div style="margin-bottom: 4px; font-size: 0.6rem; font-weight: 700;">NOVO:</div>${diffResult.novo}
                            </div>
                        </div>
                    </div>`;
            }
        }
        if (!temAlteracao) return ''; 
        if (produtoDoContexto) html += `<div style="font-size: 0.75rem; font-weight: 800; color: var(--cnx-orange); margin-bottom: 4px;">${produtoDoContexto}</div>`;
        html += blocosDiff;

    } else if (antigos && !novos) { // DELETE / EXCLUSÃO
        if (produtoDoContexto) html += `<div style="font-size: 0.75rem; font-weight: 800; color: #ef4444; margin-bottom: 6px; text-decoration: line-through;">${produtoDoContexto}</div>`;
        html += `<div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; padding: 8px; color: #991b1b; font-size: 0.7rem; text-align: left;">`;
        html += `<div style="font-weight: 800; margin-bottom: 4px; text-transform: uppercase; border-bottom: 1px solid #fecaca; padding-bottom: 4px;">Dados do Item Removido:</div>`;
        for(const key in antigos) {
            if (chavesIgnoradas.includes(key.toLowerCase())) continue;
            const labelKey = key.toLowerCase();
            const labelFormatado = (rotulosAmigaveis[labelKey] || key).replace(/_/g, ' ').toUpperCase();
            const valFmt = formatarValorAmigavel(key, antigos[key]);
            html += `<div style="margin-bottom: 2px;"><strong>${labelFormatado}:</strong> ${valFmt}</div>`;
        }
        html += `</div>`;
        
    } else if (novos && !antigos) { // INSERT POSTERIOR
        if (tabelaOrigem === 'requisicao_divergencias') {
            html += `
                <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 4px; padding: 8px; font-size: 0.75rem;">
                    <div style="font-weight: 800; color: #991b1b; margin-bottom: 4px;">Divergência Registada:</div>
                    <div style="color: #7f1d1d; margin-bottom: 6px;">${produtoDoContexto}</div>
                    <div style="display: flex; gap: 15px; margin-top: 8px;">
                        <div><span style="font-size: 0.6rem; font-weight: 700;">QTD ENVIADA:</span> <strong style="color:var(--cnx-blue);">${novos.qtd_enviada}</strong></div>
                        <div><span style="font-size: 0.6rem; font-weight: 700;">QTD CONFERIDA:</span> <strong style="color:#16a34a;">${novos.qtd_recebida}</strong></div>
                    </div>
                </div>`;
        } else if (tabelaOrigem === 'requisicao_itens' || tabelaOrigem === 'emprestimo_itens') {
            if (produtoDoContexto) html += `<div style="font-size: 0.75rem; font-weight: 800; color: #10b981; margin-bottom: 6px;">NOVO ITEM ADICIONADO: ${produtoDoContexto}</div>`;
            html += `<div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 4px; padding: 8px; color: #065f46; font-size: 0.7rem; text-align: left;">`;
            html += `<div><strong>QTD DE SAÍDA:</strong> ${novos.qtd_solicitada || novos.qtd_emprestada || 1}</div>`;
            html += `</div>`;
        } else {
            return '';
        }
    }
    
    html += '</div>';
    return html;
}

// UTILITÁRIO GLOBAL: Trailing Upper
window.applyTrailingUpper = function(text) {
    if (!text) return text;
    return text.slice(0, -1).toUpperCase() + text.slice(-1);
};
document.addEventListener('input', (e) => {
    if (e.target && e.target.classList.contains('input-upper')) {
        let val = e.target.value;
        if(val.length > 0) e.target.value = window.applyTrailingUpper(val);
        clearTimeout(e.target.upperTimeout);
        e.target.upperTimeout = setTimeout(() => { e.target.value = e.target.value.toUpperCase(); }, 600);
    }
});

// ================= UTILITÁRIO GLOBAL: ORDENAÇÃO DE TABELAS =================
window.ordenarDadosTabela = function(lista, sortConfig) {
    if (!sortConfig.key) return lista;
    return lista.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        if (valA === null || valA === undefined) valA = '';
        if (valB === null || valB === undefined) valB = '';
        
        if (!isNaN(valA) && !isNaN(valB) && valA !== '' && valB !== '') {
            valA = Number(valA);
            valB = Number(valB);
        } else {
            valA = String(valA).toUpperCase();
            valB = String(valB).toUpperCase();
        }
        
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
};

window.configurarOrdenacaoTabela = function(containerEl, sortConfig, callbackAtualizacao) {
    containerEl.querySelectorAll('.sort-col').forEach(th => {
        th.addEventListener('click', (e) => {
            const col = e.currentTarget.dataset.col;
            if (!col) return;
            
            if (sortConfig.key === col) { 
                sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc'; 
            } else { 
                sortConfig.key = col; 
                sortConfig.direction = 'asc'; 
            }
            
            // Reseta todas as setas de forma segura (procura i em qualquer profundidade do th)
            containerEl.querySelectorAll('.sort-col').forEach(el => {
                const icone = el.querySelector('i');
                if (icone) {
                    icone.setAttribute('data-lucide', 'chevron-down');
                    icone.style.opacity = '0.3';
                    icone.style.color = 'inherit';
                }
            });
            
            // Acende a seta da coluna atual
            const iconeAtual = e.currentTarget.querySelector('i');
            if (iconeAtual) {
                iconeAtual.setAttribute('data-lucide', sortConfig.direction === 'asc' ? 'chevron-up' : 'chevron-down');
                iconeAtual.style.opacity = '1';
                iconeAtual.style.color = 'var(--cnx-orange)';
            }
            lucide.createIcons();
            
            if (typeof callbackAtualizacao === 'function') {
                callbackAtualizacao();
            }
        });
    });
};


// ================= GESTÃO DE JANELAS (SPA Window Manager) =================
const appContentInner = document.getElementById('app-content-inner');
let timeoutJanelas = {};
let historicoNavegacao = ['dashboard'];
let janelasAbertas = {}; 
let idAtual = null; 

const sidebarPanel = document.getElementById('sidebar-panel');
const menuEstrutura = {
    'Cadastros': [
        {id: 'produtos', nome: 'Produtos', icone: 'box'},
        {id: 'almoxarifados', nome: 'Almoxarifados', icone: 'warehouse'},
        {id: 'usuarios', nome: 'Usuários', icone: 'users'}
    ],
    'Movimentações': [
        {id: 'requisicoes', nome: 'Requisição e Envio', icone: 'truck'},
        {id: 'emprestimos', nome: 'Empréstimos', icone: 'wrench'},
        {id: 'coleta_mac', nome: 'Coleta de MAC', icone: 'cpu'},
        {id: 'ajuste_estoque', nome: 'Ajuste de Estoque', icone: 'layers'}
    ]
};

function renderizarSidebar() {
    let html = '<div class="sidebar-header">Telas Abertas</div>';
    for (const [cat, items] of Object.entries(menuEstrutura)) {
        let itemsHtml = '';
        items.forEach(item => {
            if (janelasAbertas[item.id] && item.id !== idAtual) {
                itemsHtml += `
                    <div class="sidebar-item">
                        <div class="item-info" onclick="restaurarJanela('${item.id}')" style="flex:1;">
                            <i data-lucide="${item.icone}" class="item-icon"></i> ${item.nome}
                        </div>
                        <button class="btn-close-sidebar" onclick="fecharJanelaPeloSidebar(event, '${item.id}')" title="Fechar Tela">
                            <i data-lucide="x"></i>
                        </button>
                    </div>
                `;
            }
        });
        if (itemsHtml) html += `<div class="sidebar-category">${cat}</div>${itemsHtml}`;
    }
    if (html === '<div class="sidebar-header">Telas Abertas</div>') {
        html += '<div style="padding: 1.5rem; text-align: center; color: #94a3b8; font-size: 0.75rem;">Nenhuma tela minimizada.</div>';
    }
    sidebarPanel.innerHTML = html;
    lucide.createIcons();
}


async function navegarPara(rota) {
    document.querySelectorAll('.dropdown-menu').forEach(el => el.classList.remove('show'));
    if (rota === idAtual) return; 

    // Ocultar a janela atual
    if (idAtual && idAtual !== 'dashboard') {
        const frameAtual = document.getElementById('janela-' + idAtual);
        if (frameAtual) {
            frameAtual.classList.add('minimized');
            // Guardar o ID do timeout para podermos cancelar se o utilizador clicar rápido
            timeoutJanelas[idAtual] = setTimeout(() => { 
                if(frameAtual.classList.contains('minimized')) frameAtual.style.display = 'none'; 
            }, 300); 
        }
    }

    idAtual = rota;
    if (historicoNavegacao[historicoNavegacao.length-1] !== rota) historicoNavegacao.push(rota);

    if (rota === 'dashboard') {
        document.body.classList.remove('compact-mode');
        appContentInner.innerHTML = `
            <div id="dashboard-welcome" style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#64748b;">
                <img src="../assets/imagens/Logo.png" alt="Logo" style="width:80px; margin-bottom:1rem; opacity:0.5; filter:grayscale(1);">
                <h2>Bem-vindo ao Smart CNX</h2>
                <p>Selecione uma opção no menu acima para começar.</p>
            </div>
        `;
        // Quando volta ao dashboard, garante que todas as janelas abertas estão escondidas no DOM
        for (const r in janelasAbertas) {
            appContentInner.appendChild(janelasAbertas[r].node);
            janelasAbertas[r].node.style.display = 'none';
        }
        renderizarSidebar();
        return;
    }
    
    document.body.classList.add('compact-mode');
    
    const dashContent = document.getElementById('dashboard-welcome');
    if (dashContent) dashContent.remove();

    if (janelasAbertas[rota]) {
        // Cancelar qualquer ordem de ocultação pendente para esta janela
        if (timeoutJanelas[rota]) clearTimeout(timeoutJanelas[rota]);
        
        const f = janelasAbertas[rota].node;
        // Garantir que ela está no DOM (pode ter sido limpa pelo dashboard)
        if (!f.parentNode) appContentInner.appendChild(f);
        
        f.style.display = 'flex'; 
        f.classList.remove('maximized');
        janelasAbertas[rota].isMaximized = false;
        
        // Forçar um pequeno delay para a animação do CSS pegar o display:flex
        setTimeout(() => { f.classList.remove('minimized'); }, 10);
        renderizarSidebar();
        
        const evt = new CustomEvent('telaRestaurada', { detail: { rota } });
        document.dispatchEvent(evt);
        return;
    }

    // Criar nova janela
    const currentFrame = document.createElement('div');
    currentFrame.id = `janela-${rota}`;
    currentFrame.className = `window-frame`; 
    currentFrame.innerHTML = `
        <div class="window-controls-trigger"></div>
        <div class="window-controls">
            <button class="w-btn minimize" onclick="minimizarJanela('${rota}')" title="Minimizar"><i data-lucide="minus"></i></button>
            <button class="w-btn maximize" onclick="toggleMaximizar('${rota}')" title="Maximizar"><i data-lucide="maximize-2"></i></button>
            <button class="w-btn close" onclick="fecharJanela('${rota}')" title="Fechar"><i data-lucide="x"></i></button>
        </div>
        <div class="content-injector" style="flex:1; display:flex; flex-direction:column; overflow:hidden;">
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:var(--cnx-blue);">
                <i data-lucide="loader-2" class="lucide-spin"></i>
            </div>
        </div>
    `;
    appContentInner.appendChild(currentFrame);
    lucide.createIcons();

    const injector = currentFrame.querySelector('.content-injector');

    try {
        const response = await fetch(`pages/${rota}.html`);
        if (!response.ok) throw new Error();
        injector.innerHTML = await response.text();
        lucide.createIcons();

        janelasAbertas[rota] = { node: currentFrame, isMaximized: false };

        const scriptId = `script-${rota}`;
        if (document.getElementById(scriptId)) document.getElementById(scriptId).remove();
        const scriptTag = document.createElement('script');
        scriptTag.id = scriptId;
        scriptTag.src = `js/${rota}.js?v=${Date.now()}`; 
        document.body.appendChild(scriptTag);
        
    } catch (error) {
        injector.innerHTML = `<div style="text-align: center; margin: 2rem auto; color: #ef4444;"><i data-lucide="alert-triangle" style="width: 48px; height: 48px; margin-bottom: 1rem;"></i><h2>Módulo Indisponível</h2></div>`;
        lucide.createIcons();
    }
    renderizarSidebar();
}

window.minimizarJanela = function(rota) {
    if (idAtual === rota) {
        const frame = document.getElementById(`janela-${rota}`);
        frame.classList.add('minimized');
        
        timeoutJanelas[rota] = setTimeout(() => { 
            if(frame.classList.contains('minimized')) frame.style.display = 'none'; 
        }, 300);
        
        historicoNavegacao = historicoNavegacao.filter(r => r !== rota);
        const prev = historicoNavegacao[historicoNavegacao.length-1] || 'dashboard';
        idAtual = null; 
        navegarPara(prev);
    }
};

window.toggleMaximizar = function(rota) {
    const frame = document.getElementById(`janela-${rota}`);
    if (janelasAbertas[rota]) {
        janelasAbertas[rota].isMaximized = !janelasAbertas[rota].isMaximized;
        if (janelasAbertas[rota].isMaximized) {
            frame.classList.add('maximized');
        } else {
            frame.classList.remove('maximized');
        }
    }
};

window.fecharJanela = function(rota) {
    const frame = document.getElementById(`janela-${rota}`);
    if (frame) frame.remove();
    delete janelasAbertas[rota];
    
    const scr = document.getElementById(`script-${rota}`);
    if (scr) scr.remove();
    
    historicoNavegacao = historicoNavegacao.filter(r => r !== rota);
    
    if (idAtual === rota) {
        const prev = historicoNavegacao[historicoNavegacao.length-1] || 'dashboard';
        idAtual = null;
        navegarPara(prev);
    } else {
        renderizarSidebar();
    }
};

window.fecharJanelaPeloSidebar = function(e, rota) {
    e.stopPropagation(); 
    fecharJanela(rota);
};

window.restaurarJanela = function(rota) {
    navegarPara(rota);
};

// Tecla ESC fecha modais ou popup primeiro. Depois fecha janela
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const popup = document.getElementById('global-popup');
        if (popup && popup.classList.contains('show')) {
            const btnCancel = document.getElementById('popup-btn-cancel');
            if(btnCancel && window.getComputedStyle(btnCancel).display !== 'none') {
                btnCancel.click(); 
            } else {
                clearTimeout(alertTimeout);
                popup.classList.remove('show');
            }
            return;
        }
        
        const histModal = document.getElementById('global-historico-modal');
        if (histModal && histModal.classList.contains('show')) {
            histModal.classList.remove('show');
            return;
        }

        const modals = document.querySelectorAll('.modal-overlay');
        let modalAberto = false;
        modals.forEach(m => {
            if (window.getComputedStyle(m).display !== 'none') {
                modalAberto = true;
                const btnCancel = m.querySelector('#btn-cancelar-modal');
                if (btnCancel) btnCancel.click();
                else m.style.display = 'none'; 
            }
        });
        if (modalAberto) return;
        
        if (idAtual && idAtual !== 'dashboard') {
            fecharJanela(idAtual);
        }
    }
});