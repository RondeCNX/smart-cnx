// js/ajuste_estoque.js
(async function initModuloAjusteEstoque() {
    console.log("Módulo Ajuste de Estoque carregado.");
    lucide.createIcons();

    const moduloContent = document.querySelector('#janela-ajuste_estoque .modulo-container');
    if (!moduloContent) return;

    // Componentes Grelha e Filtros
    const tbodyAjustes = moduloContent.querySelector('#tbody-ajustes');
    const lblTotalGeral = moduloContent.querySelector('#lbl-total-geral');
    const lblTotalExibidos = moduloContent.querySelector('#lbl-total-exibidos');
    
    const comboCampo = moduloContent.querySelector('#filtro-campo');
    const inputTexto = moduloContent.querySelector('#filtro-valor-texto');
    const inputData = moduloContent.querySelector('#filtro-valor-data');
    const wrapperTexto = moduloContent.querySelector('#wrapper-texto');
    const chkExato = moduloContent.querySelector('#filtro-exato');
    
    const btnAddFiltro = moduloContent.querySelector('#btn-add-filtro');
    const btnAplicarFiltro = moduloContent.querySelector('#btn-aplicar-filtro');
    const btnLimparFiltros = moduloContent.querySelector('#btn-limpar-filtros');
    const btnRefresh = moduloContent.querySelector('#btn-refresh-ajustes');

    // Componentes Modal Principal
    const btnNovoAjuste = moduloContent.querySelector('#btn-novo-ajuste');
    const modalAjuste = moduloContent.querySelector('#modal-ajuste');
    const modalTitulo = moduloContent.querySelector('#modal-titulo-ajuste');
    const footerAjuste = moduloContent.querySelector('#modal-ajuste-footer');
    
    const tabBtns = moduloContent.querySelectorAll('.tab-form-btn');
    const tabContents = moduloContent.querySelectorAll('.tab-form-content');

    const inAlmoxId = moduloContent.querySelector('#ajuste-almox-id');
    const inAlmoxOrigemId = moduloContent.querySelector('#ajuste-almox-origem-id');
    const inAlmoxDesc = moduloContent.querySelector('#ajuste-almox-desc');
    const blocoAlmoxPendentes = moduloContent.querySelector('#bloco-almox-pendentes');
    const blocoAlmoxReadonly = moduloContent.querySelector('#bloco-almox-readonly');
    const listaAlmoxPendentesEl = moduloContent.querySelector('#lista-almox-pendentes-ajuste');

    const inIdEntrada = moduloContent.querySelector('#ajuste-id-entrada');
    const inIdInventario = moduloContent.querySelector('#ajuste-id-inventario');
    const inDataAjuste = moduloContent.querySelector('#ajuste-data');
    const inObs = moduloContent.querySelector('#ajuste-obs');

    // Itens (Aba 2)
    const tbodyMacs = moduloContent.querySelector('#tbody-itens-pendentes');
    const chkAllEntrada = moduloContent.querySelector('#chk-all-entrada');
    const chkAllSaida = moduloContent.querySelector('#chk-all-saida');
    const lblTotalMacsSel = moduloContent.querySelector('#lbl-total-macs-sel');
    const lblTotalMacsEnt = moduloContent.querySelector('#lbl-total-macs-ent');
    const lblTotalMacsSai = moduloContent.querySelector('#lbl-total-macs-sai');

    let usuarioLogadoId = null;
    let isAdmin = false;
    let isGestor = false;
    let acessoTodos = false;
    let permissoesAcesso = { view: false, create: false, edit: false, delete: false };
    let meusAlmoxarifadosIds = [];
    
    let almoxarifados = [];
    let todosAjustes = [];
    let macsDisponiveis = [];
    let filtrosAtivos = [];
    let sortConfig = { key: 'data_ajuste', direction: 'desc' };

    let modoForm = 'novo'; 
    let registroEmEdicaoId = null;
    let formFoiAlterado = false;

    btnRefresh.addEventListener('click', async () => {
        const icon = btnRefresh.querySelector('.refresh-icon');
        icon.classList.add('lucide-spin');
        await buscarAjustes();
        icon.classList.remove('lucide-spin');
    });

    async function verificarAutoAbrirNovoAjuste() {
        const autoConfig = window.ajusteEstoqueAutoAbrir || (window.ajusteEstoqueAutoAbrirAlmoxId ? { destinoId: window.ajusteEstoqueAutoAbrirAlmoxId, abrirAbaMacs: true } : null);
        if (!autoConfig) return;

        window.ajusteEstoqueAutoAbrir = null;
        window.ajusteEstoqueAutoAbrirAlmoxId = null;

        if (!permissoesAcesso.create) {
            window.appAlert('Acesso Negado', 'Você não tem permissão para criar lotes de ajuste.', 'error');
            return;
        }

        await abrirFormulario('novo', null, autoConfig);
    }

    document.addEventListener('telaRestaurada', (e) => {
        if (e.detail?.rota === 'ajuste_estoque') {
            verificarAutoAbrirNovoAjuste();
        }
    });

    async function carregarDadosIniciais() {
        try {
            permissoesAcesso = {
                view: window.temPermissao('ajuste_estoque', 'view'),
                create: window.temPermissao('ajuste_estoque', 'create'),
                edit: window.temPermissao('ajuste_estoque', 'edit'),
                delete: window.temPermissao('ajuste_estoque', 'delete')
            };

            if (!permissoesAcesso.view) {
                moduloContent.innerHTML = `<div style="text-align: center; padding: 4rem; color: #ef4444;"><i data-lucide="shield-alert" style="width: 48px; height: 48px; margin-bottom: 1rem;"></i><h2 style="font-weight: 800;">Acesso Negado</h2><p>Você não tem permissão para visualizar o Ajuste de Estoque.</p></div>`;
                lucide.createIcons();
                return;
            }

            if (btnNovoAjuste) btnNovoAjuste.style.display = permissoesAcesso.create ? 'flex' : 'none';

            const { data: { session } } = await window.db.auth.getSession();
            if (!session) return;
            usuarioLogadoId = session.user.id;

            const { data: user } = await window.db
                .from('usuarios')
                .select('acesso_todos_almoxarifados, cargos(nome)')
                .eq('id', usuarioLogadoId)
                .single();

            const upperCargo = user?.cargos?.nome?.toUpperCase() || '';
            isAdmin = upperCargo === 'ADMINISTRADOR';
            isGestor = isAdmin || upperCargo.includes('SUPERVISOR');
            acessoTodos = isAdmin || isGestor || !!user?.acesso_todos_almoxarifados;

            const { data: vincs } = await window.db
                .from('usuario_almoxarifados')
                .select('almoxarifado_id')
                .eq('usuario_id', usuarioLogadoId);
            const acessosDiretos = vincs ? vincs.map(v => v.almoxarifado_id) : [];
            
            const { data: resAlmox } = await window.db
                .from('almoxarifados')
                .select('*')
                .eq('status', 'ATIVO')
                .order('descricao');
            almoxarifados = resAlmox || [];
            
            meusAlmoxarifadosIds = acessoTodos ? almoxarifados.map(a => a.id) : acessosDiretos;

            await buscarAjustes();
            await verificarAutoAbrirNovoAjuste();
        } catch (e) { console.error(e); }
    }

    async function buscarAjustes() {
        tbodyAjustes.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem;"><i data-lucide="loader-2" class="lucide-spin"></i></td></tr>`;
        lucide.createIcons();

        let query = window.db.from('ajustes_estoque')
            .select(`
                *,
                almoxarifado:almoxarifados(codigo, descricao),
                usuario:usuarios!usuario_supervisor_id(nome_completo),
                coletas:coletas_mac(
                    id, mac, numero_serie,
                    almoxarifado_origem:almoxarifados!almoxarifado_id(codigo, descricao),
                    almoxarifado_destino:almoxarifados!almoxarifado_destino_id(codigo, descricao)
                )
            `)
            .order('created_at', { ascending: false });

        if (!acessoTodos) {
            if (meusAlmoxarifadosIds.length > 0) query = query.in('almoxarifado_id', meusAlmoxarifadosIds);
            else { todosAjustes = []; aplicarFiltrosEOrdenar(); return; }
        }

        const { data, error } = await query;
        if (error) {
            console.error('Erro ao buscar ajustes:', error);
            tbodyAjustes.innerHTML = `<tr><td colspan="8" style="text-align:center; color:red;">Erro ao buscar ajustes.</td></tr>`;
            return;
        }

        todosAjustes = (data || []).map(r => {
            const origensUnicas = [
                ...new Set(
                    (r.coletas || [])
                        .map(c => c.almoxarifado_origem ? `${window.fmtCod(c.almoxarifado_origem.codigo)} - ${c.almoxarifado_origem.descricao}` : null)
                        .filter(Boolean)
                )
            ];
            const destinosUnicos = [
                ...new Set(
                    (r.coletas || [])
                        .map(c => c.almoxarifado_destino ? `${window.fmtCod(c.almoxarifado_destino.codigo)} - ${c.almoxarifado_destino.descricao}` : null)
                        .filter(Boolean)
                )
            ];

            const almoxBase = r.almoxarifado ? `${window.fmtCod(r.almoxarifado.codigo)} - ${r.almoxarifado.descricao}` : 'Desconhecido';

            return {
                ...r,
                almoxarifadoDesc: origensUnicas.length > 0 ? origensUnicas.join(', ') : almoxBase,
                almoxarifadoDestinoDesc: destinosUnicos.length > 0 ? destinosUnicos.join(', ') : almoxBase,
                supervisorNome: r.usuario ? r.usuario.nome_completo : 'Desconhecido',
                qtdEquips: r.coletas ? r.coletas.length : 0
            };
        });

        if (lblTotalGeral) lblTotalGeral.innerText = todosAjustes.length;
        aplicarFiltrosEOrdenar();
    }

    // ================= FILTROS E TABELA =================
    comboCampo.addEventListener('change', () => {
        const val = comboCampo.value;
        moduloContent.querySelectorAll('.filtro-input-dinamico').forEach(el => el.style.display = 'none');
        if (val === 'data') { inputData.style.display = 'block'; wrapperTexto.style.display = 'none'; }
        else { wrapperTexto.style.display = 'flex'; inputTexto.value = ''; chkExato.checked = false; }
    });

    btnAddFiltro.addEventListener('click', adicionarFiltro);
    btnAplicarFiltro.addEventListener('click', adicionarFiltro);
    inputTexto.addEventListener('keypress', (e) => { if (e.key === 'Enter') adicionarFiltro(); });
    btnLimparFiltros.addEventListener('click', () => { filtrosAtivos = []; renderizarTagsFiltros(); aplicarFiltrosEOrdenar(); });

    function adicionarFiltro() {
        const campo = comboCampo.value; const labelCampo = comboCampo.options[comboCampo.selectedIndex].text;
        let valor = '', labelValor = '', exato = false;

        if (campo === 'data') {
            valor = inputData.value; if (!valor) return;
            const dt = new Date(valor + 'T12:00:00'); labelValor = dt.toLocaleDateString('pt-BR'); exato = true;
        } else {
            valor = inputTexto.value.trim().toUpperCase(); if (!valor) return;
            labelValor = valor; exato = chkExato.checked; inputTexto.value = ''; 
        }
        filtrosAtivos.push({ id: Date.now(), campo, labelCampo, valor, labelValor, exato });
        renderizarTagsFiltros(); aplicarFiltrosEOrdenar();
    }

    window.removerFiltroAjuste = function(idFiltro) {
        filtrosAtivos = filtrosAtivos.filter(f => f.id !== idFiltro);
        renderizarTagsFiltros(); aplicarFiltrosEOrdenar();
    };

    function renderizarTagsFiltros() {
        const containerTagsInline = moduloContent.querySelector('#container-tags-inline');
        const lblFiltrosAtivos = moduloContent.querySelector('#lbl-filtros-ativos');
        
        containerTagsInline.style.display = 'flex'; containerTagsInline.style.gap = '4px'; containerTagsInline.style.alignItems = 'center';
        containerTagsInline.innerHTML = '';
        
        if (filtrosAtivos.length === 0) { lblFiltrosAtivos.style.display = 'inline'; return; }
        lblFiltrosAtivos.style.display = 'none';

        const firstFiltro = filtrosAtivos[0];
        const isExato = firstFiltro.exato && firstFiltro.campo !== 'data' ? ' (Exato)' : '';
        let htmlInline = `
            <div style="background: white; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px; font-size: 0.65rem;">
                <span style="color: #64748b;">${firstFiltro.labelCampo}${isExato}:</span><strong style="color: var(--cnx-blue);">${firstFiltro.labelValor}</strong>
                <button style="background:none; border:none; margin-left: 4px; display:flex; align-items:center;" onclick="window.removerFiltroAjuste(${firstFiltro.id})"><i data-lucide="trash-2" style="width: 12px; height: 12px; color: #ef4444; cursor: pointer;"></i></button>
            </div>
        `;

        if (filtrosAtivos.length > 1) {
            const extraCount = filtrosAtivos.length - 1;
            htmlInline += `<div class="dropdown-filters" style="position: relative;"><button id="btn-toggle-filters-drop-ajuste" style="background: white; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; color: var(--cnx-blue); cursor: pointer; display: flex; align-items: center; gap: 4px;">+${extraCount} <i data-lucide="chevron-down" style="width:12px; height:12px;"></i></button><div id="drop-filters-menu-ajuste" style="display: none; position: absolute; top: 100%; right: 0; margin-top: 4px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); width: 280px; z-index: 50;"><div style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-radius: 6px 6px 0 0;"><strong style="color: var(--cnx-blue); font-size: 0.75rem;">Filtros Ativos</strong><button id="btn-close-filters-drop-ajuste" style="background:none; border:none; cursor:pointer; color:#64748b; display:flex;"><i data-lucide="x" style="width:14px; height:14px;"></i></button></div><div style="padding: 8px; display: flex; flex-direction: column; gap: 6px; max-height: 250px; overflow-y: auto;">`;
            filtrosAtivos.forEach(f => {
                const fExato = f.exato && f.campo !== 'data' ? ' (Exato)' : '';
                htmlInline += `<div style="border: 1px solid #e2e8f0; padding: 6px 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem;"><div style="flex:1;"><span style="color: #64748b;">${f.labelCampo}${fExato}:</span> <strong style="color: var(--cnx-blue); margin-left:4px;">${f.labelValor}</strong></div><button style="background: #fef2f2; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" onclick="window.removerFiltroAjuste(${f.id})"><i data-lucide="trash-2" style="width: 14px; height: 14px; color: #ef4444;"></i></button></div>`;
            });
            htmlInline += `</div></div></div>`;
        }
        containerTagsInline.innerHTML = htmlInline;
        lucide.createIcons();

        const btnToggle = containerTagsInline.querySelector('#btn-toggle-filters-drop-ajuste');
        const dropMenu = containerTagsInline.querySelector('#drop-filters-menu-ajuste');
        const btnClose = containerTagsInline.querySelector('#btn-close-filters-drop-ajuste');
        if (btnToggle && dropMenu) {
            btnToggle.addEventListener('click', (e) => { e.stopPropagation(); dropMenu.style.display = dropMenu.style.display === 'none' ? 'block' : 'none'; });
            btnClose.addEventListener('click', (e) => { e.stopPropagation(); dropMenu.style.display = 'none'; });
            document.addEventListener('click', function closeDrop(e) {
                if (!dropMenu.contains(e.target) && e.target !== btnToggle && !btnToggle.contains(e.target)) { dropMenu.style.display = 'none'; document.removeEventListener('click', closeDrop); }
            });
        }
    }

    function aplicarFiltrosEOrdenar() {
        let lista = [...todosAjustes];
        filtrosAtivos.forEach(f => {
            lista = lista.filter(item => {
                if (f.campo === 'data') { 
                    const d = new Date(item.data_ajuste + 'T12:00:00'); return d.toISOString().split('T')[0] === f.valor; 
                }
                
                if (f.campo === 'mac') {
                    const searchVal = f.valor.toUpperCase();
                    const matchFn = c => {
                        const cMac = String(c.mac || '').toUpperCase();
                        const cSn = String(c.numero_serie || '').toUpperCase();
                        if (f.exato) return cMac === searchVal || cSn === searchVal;
                        return cMac.includes(searchVal) || cSn.includes(searchVal);
                    };
                    return item.coletas && item.coletas.some(matchFn);
                }

                const v = String(item[f.campo] || '').toUpperCase();
                return f.exato ? v === f.valor : v.includes(f.valor);
            });
        });
        if (window.ordenarDadosTabela) lista = window.ordenarDadosTabela(lista, sortConfig);
        if (lblTotalExibidos) lblTotalExibidos.innerText = lista.length;
        renderizarGrid(lista);
    }

    function renderizarGrid(lista) {
        if (lista.length === 0) {
            tbodyAjustes.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color:#64748b;">Nenhum ajuste encontrado.</td></tr>`;
            return;
        }

        tbodyAjustes.innerHTML = lista.map(r => {
            const dataFmt = r.data_ajuste ? new Date(r.data_ajuste + 'T12:00:00').toLocaleDateString('pt-BR') : '-';
            
            let btnHtml = `<button class="btn-acao btn-ver" data-id="${r.id}" title="Visualizar" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="eye" style="width:16px;"></i></button>`;
            btnHtml += `<button class="btn-acao btn-historico" data-id="${r.id}" title="Auditoria/Histórico" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="rotate-ccw" style="width:16px;"></i></button>`;

            if (acessoTodos || r.usuario_supervisor_id === usuarioLogadoId) {
                if (permissoesAcesso.edit) {
                    btnHtml += `<button class="btn-acao btn-editar" data-id="${r.id}" title="Editar Ajuste" style="background:none; border:none; color:var(--cnx-blue); cursor:pointer;"><i data-lucide="edit-3" style="width:16px;"></i></button>`;
                }
                if (permissoesAcesso.delete) {
                    btnHtml += `<button class="btn-acao btn-excluir" data-id="${r.id}" title="Excluir Lote Inteiro" style="background:none; border:none; color:#ef4444; cursor:pointer;"><i data-lucide="trash-2" style="width:16px;"></i></button>`;
                }
            }

            return `
                <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s;" onmouseover="this.style.background='#fff7ed'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 0.6rem 1rem; font-size: 0.8rem;">${dataFmt}</td>
                    <td style="padding: 0.6rem 1rem; font-weight: 800; color: var(--cnx-orange);">${r.id_entrada_erp}</td>
                    <td style="padding: 0.6rem 1rem; font-weight: 800; color: #ef4444;">${r.id_inventario_erp}</td>
                    <td style="padding: 0.6rem 1rem;" title="${r.almoxarifadoDesc}">${r.almoxarifadoDesc}</td>
                    <td style="padding: 0.6rem 1rem;" title="${r.almoxarifadoDestinoDesc}">${r.almoxarifadoDestinoDesc}</td>
                    <td style="padding: 0.6rem 1rem; font-weight: 700; text-align: center;">${r.qtdEquips}</td>
                    <td style="padding: 0.6rem 1rem; font-size: 0.8rem;">${r.supervisorNome}</td>
                    <td style="padding: 0.6rem 1rem; text-align: center; display: flex; justify-content: center; gap: 8px;">${btnHtml}</td>
                </tr>
            `;
        }).join('');
        lucide.createIcons();
    }

    // ================= CONTROLE DE LINHAS (ENTRADA / SAÍDA) =================
    function atualizarEstadoLinhaMac(tr, focarErp = false) {
        const chkEnt = tr.querySelector('.chk-mac-entrada');
        const chkSai = tr.querySelector('.chk-mac-saida');
        const inErp = tr.querySelector('.in-erp-id');
        if (!chkEnt || !chkSai || !inErp) return;

        const entMarcada = chkEnt.checked;
        const saiMarcada = chkSai.checked;
        const algumMarcado = entMarcada || saiMarcada;

        inErp.disabled = !algumMarcado;
        if (!algumMarcado) {
            if (modoForm === 'novo') inErp.value = '';
            tr.style.background = 'transparent';
        } else if (entMarcada && saiMarcada) {
            tr.style.background = '#f0fdf4'; // Verde claro: entrada e saída conferidas
        } else {
            tr.style.background = '#fffbeb'; // Amarelo bem leve: apenas uma conferida
        }

        if (focarErp && algumMarcado && modoForm === 'novo' && !inErp.value.trim()) {
            inErp.focus();
        }
    }

    function obterLinhasSelecionadas() {
        return Array.from(tbodyMacs.querySelectorAll('tr[data-coleta-id]')).filter(tr => {
            const ent = tr.querySelector('.chk-mac-entrada')?.checked;
            const sai = tr.querySelector('.chk-mac-saida')?.checked;
            return ent || sai;
        });
    }

    function atualizarContadorSelecao() {
        const entCount = tbodyMacs.querySelectorAll('.chk-mac-entrada:checked').length;
        const saiCount = tbodyMacs.querySelectorAll('.chk-mac-saida:checked').length;
        const selCount = obterLinhasSelecionadas().length;

        if (lblTotalMacsEnt) lblTotalMacsEnt.innerText = entCount;
        if (lblTotalMacsSai) lblTotalMacsSai.innerText = saiCount;
        if (lblTotalMacsSel) lblTotalMacsSel.innerText = selCount;
        formFoiAlterado = true;
    }

    // ================= EVENTOS GLOBAIS DA TELA =================
    if (window.configurarOrdenacaoTabela) { window.configurarOrdenacaoTabela(moduloContent, sortConfig, aplicarFiltrosEOrdenar); }

    moduloContent.addEventListener('click', async (e) => {
        const btnAcao = e.target.closest('.btn-acao');
        if (btnAcao) {
            const id = btnAcao.dataset.id;
            if (btnAcao.classList.contains('btn-ver')) {
                abrirFormulario('visualizar', id);
            } else if (btnAcao.classList.contains('btn-editar')) {
                abrirFormulario('editar', id);
            } else if (btnAcao.classList.contains('btn-excluir')) {
                if (!permissoesAcesso.delete) {
                    window.appAlert('Acesso Negado', 'Você não tem permissão para excluir lotes de ajuste.', 'error');
                    return;
                }
                const conf = await window.appConfirm('Excluir Lote de Ajuste', 'Deseja realmente apagar este Lote? Atenção: Os equipamentos dentro dele voltarão para a fila de PENDENTES.', 'danger');
                if (conf) {
                    await window.db.from('coletas_mac').update({ ajuste_estoque_id: null, produto_patrimonio_erp: null, status: 'PENDENTE' }).eq('ajuste_estoque_id', id);
                    await window.db.from('ajustes_estoque').delete().eq('id', id);
                    window.appAlert('Sucesso', 'Ajuste excluído e MACs revertidos.', 'success'); 
                    buscarAjustes();
                }
            } else if (btnAcao.classList.contains('btn-historico')) { 
                if(window.abrirHistorico) window.abrirHistorico('ajustes_estoque', id); 
            }
            return;
        }

        const cardAlmox = e.target.closest('.card-almox-pendente');
        if (cardAlmox && modoForm === 'novo') {
            selecionarAlmoxarifadoPendente(cardAlmox.dataset.origemId, cardAlmox.dataset.destinoId, cardAlmox.dataset.pairKey);
            return;
        }
        
        const chkItem = e.target.closest('.chk-mac-entrada, .chk-mac-saida');
        if (chkItem) {
            const tr = chkItem.closest('tr');
            atualizarEstadoLinhaMac(tr, chkItem.checked);
            atualizarContadorSelecao();
        }
    });

    // Dois cliques no card já seleciona e abre a Aba 2 com os MACs pendentes
    moduloContent.addEventListener('dblclick', (e) => {
        const cardAlmox = e.target.closest('.card-almox-pendente');
        if (cardAlmox && modoForm === 'novo') {
            selecionarAlmoxarifadoPendente(cardAlmox.dataset.origemId, cardAlmox.dataset.destinoId, cardAlmox.dataset.pairKey);
            tabBtns[1].click();
        }
    });

    moduloContent.addEventListener('input', (e) => {
        if (e.target.closest('#modal-ajuste') && !e.target.classList.contains('filter-input')) formFoiAlterado = true;
    });

    chkAllEntrada.addEventListener('change', () => {
        const isChecked = chkAllEntrada.checked;
        tbodyMacs.querySelectorAll('.chk-mac-entrada').forEach(chk => {
            chk.checked = isChecked;
            atualizarEstadoLinhaMac(chk.closest('tr'), false);
        });
        atualizarContadorSelecao();
    });

    chkAllSaida.addEventListener('change', () => {
        const isChecked = chkAllSaida.checked;
        tbodyMacs.querySelectorAll('.chk-mac-saida').forEach(chk => {
            chk.checked = isChecked;
            atualizarEstadoLinhaMac(chk.closest('tr'), false);
        });
        atualizarContadorSelecao();
    });

    // ================= NAVEGAÇÃO DE ABAS =================
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            tabBtns.forEach(b => { b.classList.remove('active'); b.style.borderBottomColor = 'transparent'; b.style.color = '#64748b'; });
            tabContents.forEach(c => c.style.display = 'none');
            const target = e.currentTarget;
            target.classList.add('active');
            target.style.borderBottomColor = 'var(--cnx-orange)';
            target.style.color = 'var(--cnx-blue)';
            moduloContent.querySelector(`#${target.dataset.target}`).style.display = 'block';
        });
    });

    // ================= LISTA AUTOMÁTICA DE ALMOXARIFADOS COM PENDÊNCIAS (ORIGEM + DESTINO) =================
    async function carregarAlmoxarifadosComPendencias(autoConfig = null) {
        listaAlmoxPendentesEl.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding: 1rem; color:#64748b;"><i data-lucide="loader-2" class="lucide-spin" style="width:18px;"></i> Buscando almoxarifados com MACs pendentes...</div>`;
        lucide.createIcons();

        let q = window.db
            .from('coletas_mac')
            .select(`
                id,
                almoxarifado_id,
                almoxarifado_destino_id,
                almoxarifado_origem:almoxarifados!almoxarifado_id(id, codigo, descricao),
                almoxarifado_destino:almoxarifados!almoxarifado_destino_id(id, codigo, descricao)
            `)
            .eq('status', 'PENDENTE');

        if (!acessoTodos && meusAlmoxarifadosIds.length > 0) {
            const idsFmt = meusAlmoxarifadosIds.join(',');
            q = q.or(`almoxarifado_destino_id.in.(${idsFmt}),almoxarifado_id.in.(${idsFmt})`);
        } else if (!acessoTodos) {
            listaAlmoxPendentesEl.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding: 1rem; color:#64748b;">Nenhum almoxarifado vinculado.</div>`;
            return;
        }

        const { data, error } = await q;
        if (error) {
            console.error('Erro ao buscar almoxarifados pendentes:', error);
            listaAlmoxPendentesEl.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding: 1rem; color:#ef4444;">Erro ao carregar pendências.</div>`;
            return;
        }

        // Agrupa somente MACs com o mesmo Almoxarifado de Coleta (Origem) E mesmo Almoxarifado de Destino
        const mapa = {};
        (data || []).forEach(m => {
            const origemId = String(m.almoxarifado_id || '');
            const destinoId = String(m.almoxarifado_destino_id || m.almoxarifado_id || '');
            if (!destinoId) return;

            const chave = `${origemId}|${destinoId}`;
            if (!mapa[chave]) {
                const origObj = m.almoxarifado_origem;
                const destObj = m.almoxarifado_destino || m.almoxarifado_origem;
                const descOrigem = origObj
                    ? `${window.fmtCod(origObj.codigo)} - ${origObj.descricao}`
                    : 'Não identificado';
                const descDestino = destObj
                    ? `${window.fmtCod(destObj.codigo)} - ${destObj.descricao}`
                    : 'Não identificado';

                mapa[chave] = {
                    pairKey: chave,
                    origemId,
                    destinoId,
                    descOrigem,
                    descDestino,
                    qtd: 0
                };
            }
            mapa[chave].qtd += 1;
        });

        const grupos = Object.values(mapa).sort((a, b) => {
            const cmpDest = a.descDestino.localeCompare(b.descDestino, 'pt-BR', { sensitivity: 'base' });
            if (cmpDest !== 0) return cmpDest;
            return a.descOrigem.localeCompare(b.descOrigem, 'pt-BR', { sensitivity: 'base' });
        });

        if (grupos.length === 0) {
            listaAlmoxPendentesEl.innerHTML = `<div style="grid-column: 1 / -1; text-align:center; padding: 1rem; color:#10b981; font-weight:700;">Nenhum almoxarifado possui MACs pendentes de ajuste no momento!</div>`;
            tbodyMacs.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #10b981; font-weight:700;">Nenhum MAC pendente encontrado.</td></tr>`;
            return;
        }

        listaAlmoxPendentesEl.innerHTML = grupos.map(g => {
            const labelQtd = g.qtd === 1 ? '1 MAC' : `${g.qtd} MACs`;
            const hintTexto = `Coleta (Origem): ${g.descOrigem} | Destino: ${g.descDestino}`;
            return `
                <button type="button" class="card-almox-pendente" data-pair-key="${g.pairKey}" data-origem-id="${g.origemId}" data-destino-id="${g.destinoId}" title="${hintTexto}" style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:8px 10px; background:white; border:1px solid #cbd5e1; border-radius:6px; cursor:pointer; text-align:left; transition:all 0.15s;">
                    <span style="font-size:0.76rem; font-weight:700; color:var(--cnx-blue); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${g.descDestino}</span>
                    <span style="background:#fff7ed; color:#c2410c; border:1px solid #fed7aa; padding:2px 8px; border-radius:99px; font-size:0.66rem; font-weight:800; flex-shrink:0;">${labelQtd}</span>
                </button>
            `;
        }).join('');

        // Pré-seleciona automaticamente pelo par exato (Origem + Destino) vindo da Home, ou único card pendente
        let grupoPre = null;
        if (autoConfig && typeof autoConfig === 'object') {
            if (autoConfig.pairKey && mapa[autoConfig.pairKey]) {
                grupoPre = mapa[autoConfig.pairKey];
            } else if (autoConfig.destinoId) {
                grupoPre = grupos.find(g => g.destinoId === String(autoConfig.destinoId));
            }
        } else if (typeof autoConfig === 'string' && autoConfig) {
            grupoPre = grupos.find(g => g.destinoId === String(autoConfig));
        } else if (grupos.length === 1) {
            grupoPre = grupos[0];
        }

        if (grupoPre) {
            selecionarAlmoxarifadoPendente(grupoPre.origemId, grupoPre.destinoId, grupoPre.pairKey);
            if (autoConfig && typeof autoConfig === 'object' && autoConfig.abrirAbaMacs) {
                tabBtns[1].click();
            }
        }
    }

    function selecionarAlmoxarifadoPendente(origemId, destinoId, pairKey) {
        inAlmoxId.value = destinoId;
        inAlmoxOrigemId.value = origemId;

        listaAlmoxPendentesEl.querySelectorAll('.card-almox-pendente').forEach(btn => {
            const ativo = btn.dataset.pairKey === pairKey;
            btn.style.borderColor = ativo ? 'var(--cnx-orange)' : '#cbd5e1';
            btn.style.background = ativo ? '#fff7ed' : 'white';
            btn.style.boxShadow = ativo ? '0 0 0 2px rgba(242, 101, 34, 0.2)' : 'none';
        });

        chkAllEntrada.checked = false;
        chkAllSaida.checked = false;
        if (lblTotalMacsEnt) lblTotalMacsEnt.innerText = '0';
        if (lblTotalMacsSai) lblTotalMacsSai.innerText = '0';
        if (lblTotalMacsSel) lblTotalMacsSel.innerText = '0';

        carregarMacsPendentes(origemId, destinoId);
    }

    // ================= LÓGICA DO MODAL DE AJUSTE =================
    btnNovoAjuste.addEventListener('click', () => {
        if (!permissoesAcesso.create) {
            window.appAlert('Acesso Negado', 'Você não tem permissão para criar lotes de ajuste.', 'error');
            return;
        }
        abrirFormulario('novo', null);
    });
    
    async function fecharModalAjuste() {
        if (formFoiAlterado && modoForm !== 'visualizar') {
            const conf = await window.appConfirm('Atenção', 'As configurações não foram salvas. Deseja realmente sair?', 'warning');
            if(!conf) return;
        }
        modalAjuste.style.display = 'none';
        formFoiAlterado = false;
    }
    moduloContent.querySelector('#btn-fechar-ajuste').addEventListener('click', fecharModalAjuste);

    async function abrirFormulario(modo, id, almoxPreSelecionadoId = null) {
        const mapaModoPerm = { novo: 'create', editar: 'edit' };
        if (mapaModoPerm[modo] && !permissoesAcesso[mapaModoPerm[modo]]) {
            window.appAlert('Acesso Negado', 'Você não tem permissão para executar esta ação.', 'error');
            return;
        }

        modoForm = modo;
        registroEmEdicaoId = id;
        formFoiAlterado = false;
        macsDisponiveis = [];
        
        inAlmoxId.value = ''; inAlmoxOrigemId.value = ''; inAlmoxDesc.value = ''; 
        inIdEntrada.value = ''; inIdInventario.value = ''; inObs.value = '';
        inDataAjuste.value = new Date().toISOString().split('T')[0];
        
        chkAllEntrada.checked = false; chkAllEntrada.disabled = false;
        chkAllSaida.checked = false; chkAllSaida.disabled = false;
        if (lblTotalMacsEnt) lblTotalMacsEnt.innerText = '0';
        if (lblTotalMacsSai) lblTotalMacsSai.innerText = '0';
        if (lblTotalMacsSel) lblTotalMacsSel.innerText = '0';
        
        tabBtns[0].click(); 
        
        if (modo === 'novo') {
            modalTitulo.innerHTML = `<i data-lucide="layers" style="color: var(--cnx-orange); width: 20px;"></i> <span>Criar Lote de Ajuste</span>`;
            blocoAlmoxPendentes.style.display = 'block';
            blocoAlmoxReadonly.style.display = 'none';
            inIdEntrada.readOnly = false; inIdInventario.readOnly = false;
            inDataAjuste.readOnly = false; inObs.readOnly = false;
            montarFooterFormulario(true);
            tbodyMacs.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #94a3b8;">Selecione um Almoxarifado de Destino na Aba 1 para listar os MACs pendentes.</td></tr>`;
            modalAjuste.style.display = 'flex';
            lucide.createIcons();
            await carregarAlmoxarifadosComPendencias(almoxPreSelecionadoId);
            return;
        } else {
            const r = todosAjustes.find(x => x.id === id);
            if (!r) return;
            
            modalTitulo.innerHTML = `<i data-lucide="layers" style="color: var(--cnx-orange); width: 20px;"></i> <span>Detalhes do Ajuste de Estoque</span>`;
            blocoAlmoxPendentes.style.display = 'none';
            blocoAlmoxReadonly.style.display = 'block';
            
            inDataAjuste.value = r.data_ajuste ? r.data_ajuste.split('T')[0] : '';
            inAlmoxId.value = r.almoxarifado_id;
            inAlmoxDesc.value = r.almoxarifadoDestinoDesc;
            inIdEntrada.value = r.id_entrada_erp; inIdInventario.value = r.id_inventario_erp; inObs.value = r.observacoes || '';
            
            if (modo === 'visualizar') {
                inIdEntrada.readOnly = true; inIdInventario.readOnly = true;
                inDataAjuste.readOnly = true; inObs.readOnly = true;
                chkAllEntrada.disabled = true;
                chkAllSaida.disabled = true;
                montarFooterFormulario(false);
            } else if (modo === 'editar') {
                inIdEntrada.readOnly = false; inIdInventario.readOnly = false;
                inDataAjuste.readOnly = false; inObs.readOnly = false;
                chkAllEntrada.disabled = false;
                chkAllSaida.disabled = false;
                montarFooterFormulario(true);
            }
            await carregarMacsDoAjuste(id, modo);
        }
        
        modalAjuste.style.display = 'flex';
        lucide.createIcons();
    }

    function ordenarMacsPorProduto(lista) {
        return [...(lista || [])].sort((a, b) => {
            const codA = String(a.produto?.codigo ?? '');
            const codB = String(b.produto?.codigo ?? '');
            const cmp = codA.localeCompare(codB, 'pt-BR', { numeric: true, sensitivity: 'base' });
            if (cmp !== 0) return cmp;
            return String(a.mac ?? '').localeCompare(String(b.mac ?? ''), 'pt-BR', { sensitivity: 'base' });
        });
    }

    async function carregarMacsPendentes(origemId, destinoId) {
        tbodyMacs.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem;"><i data-lucide="loader-2" class="lucide-spin"></i> Buscando pendências...</td></tr>`;
        lucide.createIcons();
        
        let query = window.db
            .from('coletas_mac')
            .select(`
                *,
                produto:produtos(codigo, descricao),
                almoxarifado_origem:almoxarifados!almoxarifado_id(codigo, descricao),
                almoxarifado_destino:almoxarifados!almoxarifado_destino_id(codigo, descricao)
            `)
            .eq('status', 'PENDENTE');

        if (origemId) {
            query = query.eq('almoxarifado_id', origemId);
        }

        if (destinoId) {
            if (origemId === destinoId) {
                query = query.or(`almoxarifado_destino_id.eq.${destinoId},almoxarifado_destino_id.is.null`);
            } else {
                query = query.eq('almoxarifado_destino_id', destinoId);
            }
        }

        const { data, error } = await query;

        if (error) {
            console.error('Erro ao buscar MACs pendentes:', error);
            tbodyMacs.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: #ef4444;">Erro ao buscar pendências.</td></tr>`;
            return;
        }

        macsDisponiveis = ordenarMacsPorProduto(data || []);
        
        if (macsDisponiveis.length === 0) {
            tbodyMacs.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: #10b981; font-weight:700;"><i data-lucide="check-circle" style="width:24px; height:24px; margin-bottom:8px;"></i><br>Nenhum equipamento pendente de ajuste neste Almoxarifado!</td></tr>`;
            lucide.createIcons();
            return;
        }

        renderizarGridMacs(true, false);
    }

    async function carregarMacsDoAjuste(idAjuste, modo) {
        tbodyMacs.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem;"><i data-lucide="loader-2" class="lucide-spin"></i> Carregando equipamentos vinculados...</td></tr>`;
        lucide.createIcons();
        
        const { data, error } = await window.db
            .from('coletas_mac')
            .select(`
                *,
                produto:produtos(codigo, descricao),
                almoxarifado_origem:almoxarifados!almoxarifado_id(codigo, descricao),
                almoxarifado_destino:almoxarifados!almoxarifado_destino_id(codigo, descricao)
            `)
            .eq('ajuste_estoque_id', idAjuste);

        if (error) {
            console.error('Erro ao buscar MACs do ajuste:', error);
            tbodyMacs.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: #ef4444;">Erro ao carregar equipamentos vinculados.</td></tr>`;
            return;
        }

        macsDisponiveis = ordenarMacsPorProduto(data || []);
        if (lblTotalMacsEnt) lblTotalMacsEnt.innerText = macsDisponiveis.length;
        if (lblTotalMacsSai) lblTotalMacsSai.innerText = macsDisponiveis.length;
        if (lblTotalMacsSel) lblTotalMacsSel.innerText = macsDisponiveis.length;
        
        renderizarGridMacs(modo === 'editar', true);
    }

    function renderizarGridMacs(editavel, jaSalvos = false) {
        tbodyMacs.innerHTML = macsDisponiveis.map(m => {
            const pDesc = m.produto ? `${window.fmtCod(m.produto.codigo)} - ${m.produto.descricao}` : '-';
            const mDesc = `<div style="font-weight:800; color:var(--cnx-orange);">${m.mac}</div><div style="font-size:0.7rem; color:#64748b;">SN: ${m.numero_serie || '-'}</div>`;
            const origDesc = m.almoxarifado_origem
                ? `${window.fmtCod(m.almoxarifado_origem.codigo)} - ${m.almoxarifado_origem.descricao}`
                : '-';
            const destDesc = m.almoxarifado_destino
                ? `${window.fmtCod(m.almoxarifado_destino.codigo)} - ${m.almoxarifado_destino.descricao}`
                : origDesc;
            const dFmt = m.data_coleta ? new Date(m.data_coleta + 'T12:00:00').toLocaleDateString('pt-BR') : '-';
            const oDesc = `<div style="font-weight:700; color:var(--cnx-blue);">${m.numero_os || '-'}</div><div style="font-size:0.7rem; color:#64748b;">${dFmt}</div>`;
            
            if (editavel) {
                const checkedStr = jaSalvos ? 'checked' : '';
                const disabledStr = jaSalvos ? '' : 'disabled';
                const bgCor = jaSalvos ? 'background: #f0fdf4;' : '';
                const valErp = m.produto_patrimonio_erp || '';

                return `
                <tr data-coleta-id="${m.id}" style="border-bottom: 1px solid #f1f5f9; transition: background 0.2s; ${bgCor}">
                    <td style="padding: 0.5rem 0.35rem; text-align: center;">
                        <input type="checkbox" class="chk-mac-entrada" data-id="${m.id}" title="Entrada" ${checkedStr} style="cursor: pointer; accent-color: #16a34a;">
                    </td>
                    <td style="padding: 0.5rem 0.35rem; text-align: center; border-right: 1px solid #f1f5f9;">
                        <input type="checkbox" class="chk-mac-saida" data-id="${m.id}" title="Saída" ${checkedStr} style="cursor: pointer; accent-color: #2563eb;">
                    </td>
                    <td style="padding: 0.6rem; font-size: 0.76rem;">${pDesc}</td>
                    <td style="padding: 0.6rem;">${mDesc}</td>
                    <td style="padding: 0.6rem; font-size: 0.75rem; color: #334155;">${origDesc}</td>
                    <td style="padding: 0.6rem; font-size: 0.75rem; color: #334155;">${destDesc}</td>
                    <td style="padding: 0.6rem;">${oDesc}</td>
                    <td style="padding: 0.4rem; background: #f0f9ff; border-left: 1px solid #bae6fd;">
                        <input type="text" class="in-erp-id input-standard input-upper" placeholder="ID IXC..." value="${valErp}" ${disabledStr} style="width: 100%; border: 1px solid #7dd3fc; border-radius: 4px; padding: 4px 8px; font-weight: 800; color: var(--cnx-blue);">
                    </td>
                </tr>`;
            } else {
                return `
                <tr data-coleta-id="${m.id}" style="border-bottom: 1px solid #f1f5f9; background: #f8fafc;">
                    <td style="padding: 0.5rem 0.35rem; text-align: center;"><i data-lucide="check" style="color:#16a34a; width:15px;"></i></td>
                    <td style="padding: 0.5rem 0.35rem; text-align: center; border-right: 1px solid #f1f5f9;"><i data-lucide="check" style="color:#2563eb; width:15px;"></i></td>
                    <td style="padding: 0.6rem; font-size: 0.76rem;">${pDesc}</td>
                    <td style="padding: 0.6rem;">${mDesc}</td>
                    <td style="padding: 0.6rem; font-size: 0.75rem; color: #334155;">${origDesc}</td>
                    <td style="padding: 0.6rem; font-size: 0.75rem; color: #334155;">${destDesc}</td>
                    <td style="padding: 0.6rem;">${oDesc}</td>
                    <td style="padding: 0.6rem; background: #f0f9ff; border-left: 1px solid #bae6fd; font-weight: 800; color: var(--cnx-blue); text-align: center;">
                        ${m.produto_patrimonio_erp || '-'}
                    </td>
                </tr>`;
            }
        }).join('');
        lucide.createIcons();
    }

    function montarFooterFormulario(showSave) {
        if (!showSave) {
            footerAjuste.innerHTML = `<button class="btn-cancel" id="btn-fechar-visao">Fechar</button>`;
            footerAjuste.querySelector('#btn-fechar-visao').addEventListener('click', fecharModalAjuste);
        } else {
            footerAjuste.innerHTML = `
                <button class="btn-cancel" id="btn-cancel-form">Cancelar</button>
                <button class="btn-save" id="btn-salvar-form" style="background: var(--cnx-blue); color: white; border: none; padding: 0.5rem 1.5rem; border-radius: 6px; font-weight: 700; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <i data-lucide="check-square" style="width: 16px; color: white;"></i> <span>Confirmar Ajuste</span>
                </button>
            `;
            footerAjuste.querySelector('#btn-cancel-form').addEventListener('click', fecharModalAjuste);
            footerAjuste.querySelector('#btn-salvar-form').addEventListener('click', salvarAjuste);
        }
        lucide.createIcons();
    }

    async function salvarAjuste() {
        const idAlmoxDestino = inAlmoxId.value;
        const entErp = inIdEntrada.value.trim().toUpperCase();
        const invErp = inIdInventario.value.trim().toUpperCase();
        const dt = inDataAjuste.value;
        const linhasSel = obterLinhasSelecionadas();
        const estaNaAbaDados = moduloContent.querySelector('#form-tab-dados')?.style.display !== 'none';

        if (!idAlmoxDestino) {
            window.appAlert("Atenção", "Selecione um Almoxarifado de Destino na Aba 1.", "warning");
            tabBtns[0].click();
            return;
        }

        // Se está na Aba 1 com almoxarifado selecionado e ainda não escolheu os MACs, avança para a Aba 2
        if (modoForm === 'novo' && estaNaAbaDados && linhasSel.length === 0) {
            tabBtns[1].click();
            return;
        }

        if (!entErp || !invErp || !dt) {
            window.appAlert("Atenção", "Preencha ID Entrada IXC, ID Inventário IXC e Data do Ajuste na Aba 1.", "warning");
            tabBtns[0].click();
            if (!entErp) inIdEntrada.focus();
            else if (!invErp) inIdInventario.focus();
            else inDataAjuste.focus();
            return;
        }
        
        if (linhasSel.length === 0) {
            window.appAlert("Atenção", "Marque pelo menos um MAC (Entrada ou Saída) na Aba 2 para vincular ao lote.", "warning");
            tabBtns[1].click();
            return;
        }

        let macsParaAtualizar = [];
        for (let tr of linhasSel) {
            const inErp = tr.querySelector('.in-erp-id');
            const valErp = inErp.value.trim().toUpperCase();
            if (!valErp) {
                window.appAlert("Atenção", "Você marcou um MAC mas não informou o Novo ID Patrimônio (ERP) na frente dele.", "warning");
                inErp.focus(); return;
            }
            macsParaAtualizar.push({ id_coleta: tr.dataset.coletaId, novo_id_erp: valErp });
        }

        const idsSelecionados = new Set(macsParaAtualizar.map(i => i.id_coleta));
        const macsParaDesvincular = Array.from(tbodyMacs.querySelectorAll('tr[data-coleta-id]'))
            .map(tr => tr.dataset.coletaId)
            .filter(id => !idsSelecionados.has(id));

        const conf = await window.appConfirm('Salvar Ajuste', `Deseja consolidar o lote com ${macsParaAtualizar.length} equipamento(s)?`);
        if(!conf) return;

        const btnSave = footerAjuste.querySelector('#btn-salvar-form');
        btnSave.disabled = true; btnSave.innerHTML = `<i data-lucide="loader-2" class="lucide-spin" style="width:16px;"></i> Gravando...`;

        try {
            const payload = {
                almoxarifado_id: idAlmoxDestino,
                id_entrada_erp: entErp,
                id_inventario_erp: invErp,
                data_ajuste: dt,
                observacoes: inObs.value.trim().toUpperCase()
            };

            if (modoForm === 'novo') {
                payload.usuario_supervisor_id = usuarioLogadoId;
                
                const { data: newAjuste, error: errAjuste } = await window.db.from('ajustes_estoque').insert([payload]).select('id').single();
                if (errAjuste) throw errAjuste;

                for (let item of macsParaAtualizar) {
                    await window.db.from('coletas_mac').update({
                        produto_patrimonio_erp: item.novo_id_erp,
                        ajuste_estoque_id: newAjuste.id,
                        status: 'AJUSTADO'
                    }).eq('id', item.id_coleta);
                }
            } else {
                const { error: errAjuste } = await window.db.from('ajustes_estoque').update(payload).eq('id', registroEmEdicaoId);
                if (errAjuste) throw errAjuste;

                for (let item of macsParaAtualizar) {
                    await window.db.from('coletas_mac').update({
                        produto_patrimonio_erp: item.novo_id_erp,
                        ajuste_estoque_id: registroEmEdicaoId,
                        status: 'AJUSTADO'
                    }).eq('id', item.id_coleta);
                }

                if (macsParaDesvincular.length > 0) {
                    await window.db.from('coletas_mac').update({
                        produto_patrimonio_erp: null,
                        ajuste_estoque_id: null,
                        status: 'PENDENTE'
                    }).in('id', macsParaDesvincular);
                }
            }

            formFoiAlterado = false;
            window.appAlert("Sucesso", `Lote salvo e configurações aplicadas!`, "success");
            modalAjuste.style.display = 'none';
            await buscarAjustes();
        } catch (e) { console.error(e); window.appAlert("Erro", "Falha ao gravar o lote de ajuste.", "error"); } 
        finally { btnSave.disabled = false; btnSave.innerHTML = `<i data-lucide="check-square" style="width: 16px; color: white;"></i> <span>Confirmar Ajuste</span>`; lucide.createIcons(); }
    }

    // Prevenção Modal Global Esc
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (modalAjuste && modalAjuste.style.display !== 'none') {
                e.preventDefault();
                e.stopPropagation();
                fecharModalAjuste();
            }
        }
    }, true);

    carregarDadosIniciais();
})();