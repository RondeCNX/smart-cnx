// js/admin.js
window.usuarioPermissoes = {};
window.isAdminSistema = false;
window.ajusteEstoqueAutoAbrirAlmoxId = null;

// Formatação visual padrão de 6 algarismos para códigos de Almoxarifados e Produtos
window.fmtCod = function(codigo) {
    if (codigo === null || codigo === undefined || codigo === '') return '-';
    const str = String(codigo).trim();
    return /^\d+$/.test(str) ? str.padStart(6, '0') : str;
};

window.temPermissao = function(modulo, acao = 'view') {
    if (window.isAdminSistema) return true;
    if (!modulo || modulo === 'dashboard') return true;

    if (modulo === 'configuracoes') {
        const modsCfg = ['cfg_conta', 'cfg_regras', 'cfg_buckets', 'cfg_cargos', 'cfg_auditoria', 'cfg_backup', 'cfg_sobre'];
        return modsCfg.some(m => {
            const p = window.usuarioPermissoes[m];
            return p && Object.values(p).some(v => v === true);
        });
    }

    return Boolean(window.usuarioPermissoes?.[modulo]?.[acao]);
};

async function carregarPermissoesUsuario(userId) {
    try {
        const { data } = await window.db
            .from('usuarios')
            .select('permissoes, cargos(nome, permissoes)')
            .eq('id', userId)
            .single();

        const cargoNome = (data?.cargos?.nome || '').toUpperCase();
        window.isAdminSistema = cargoNome === 'ADMINISTRADOR';

        const permsCargo = (data?.cargos?.permissoes && typeof data.cargos.permissoes === 'object') ? data.cargos.permissoes : {};
        const permsUser = (data?.permissoes && typeof data.permissoes === 'object') ? data.permissoes : {};

        const combinadas = { ...permsCargo };
        for (const [mod, acoes] of Object.entries(permsUser)) {
            combinadas[mod] = { ...(permsCargo[mod] || {}), ...(acoes || {}) };
        }

        window.usuarioPermissoes = combinadas;
    } catch (err) {
        console.error('Erro ao carregar permissões do usuário:', err);
        window.usuarioPermissoes = {};
        window.isAdminSistema = false;
    }
}

function aplicarPermissoesMenu() {
    if (window.isAdminSistema) return;

    const itensMenu = document.querySelectorAll('.top-header [onclick*="navegarPara("]');
    itensMenu.forEach(el => {
        const attr = el.getAttribute('onclick') || '';
        const match = attr.match(/navegarPara\(\s*['"]([^'"]+)['"]\s*\)/);
        if (!match) return;

        const rota = match[1];
        if (!window.temPermissao(rota, 'view')) {
            el.style.display = 'none';
        }
    });

    // Oculta menus dropdown que ficaram sem nenhuma opção visível
    document.querySelectorAll('.top-header .has-dropdown').forEach(drop => {
        const menu = drop.querySelector('.dropdown-menu');
        if (!menu) return;
        const opcoes = Array.from(menu.querySelectorAll('[onclick*="navegarPara("]'));
        if (opcoes.length > 0 && opcoes.every(op => op.style.display === 'none')) {
            drop.style.display = 'none';
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    try {
        const { data: { session }, error } = await window.db.auth.getSession();
        if (error || !session) { window.location.replace('../index.html'); return; }
        await carregarPermissoesUsuario(session.user.id);
        aplicarPermissoesMenu();
        carregarPerfilRodape(session.user.id);
        await carregarFiltroAlmoxarifados(session.user.id);
        iniciarMonitorSessao(session.user.id);
        navegarPara('dashboard');
    } catch (err) {
        console.error('Erro na inicialização do painel:', err);
        window.location.replace('../index.html');
    }
});

function toggleDropdown(id) {
    document.querySelectorAll('.dropdown-menu').forEach(el => { if (el.id !== id) el.classList.remove('show'); });
    const menu = document.getElementById(id);
    if (menu) {
        menu.classList.toggle('show');
        if (menu.classList.contains('show') && menu.closest('.top-header')) {
            menu.style.left = '';
            menu.style.right = '';
            const rect = menu.getBoundingClientRect();
            if (rect.right > window.innerWidth - 10) {
                menu.style.left = 'auto';
                menu.style.right = '0';
            }
        }
    }
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

window.almoxarifadosSelecionados = [];

async function carregarFiltroAlmoxarifados(userId) {
    const btnFiltro = document.getElementById('btn-filtro-almox');
    const lblFiltro = document.getElementById('label-filtro-almox');
    const listaEl = document.getElementById('lista-almoxarifados');
    const chkTodos = document.getElementById('chk-todos-almox');

    try {
        const [resUser, resVincs, resAlmox] = await Promise.all([
            window.db.from('usuarios').select('acesso_todos_almoxarifados, cargos(nome)').eq('id', userId).maybeSingle(),
            window.db.from('usuario_almoxarifados').select('almoxarifado_id').eq('usuario_id', userId),
            window.db.from('almoxarifados').select('id, codigo, descricao').eq('status', 'ATIVO')
        ]);

        if (resAlmox.error) throw resAlmox.error;

        const cargoNome = resUser.data?.cargos?.nome?.toUpperCase() || '';
        const acessoTodos = cargoNome === 'ADMINISTRADOR' || !!resUser.data?.acesso_todos_almoxarifados;
        const idsVinculados = (resVincs.data || []).map(v => String(v.almoxarifado_id));
        const todosAtivos = (resAlmox.data || []).sort((a, b) =>
            (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR', { sensitivity: 'base' })
        );

        const almoxPermitidos = acessoTodos
            ? todosAtivos
            : todosAtivos.filter(a => idsVinculados.includes(String(a.id)));

        // Caso 0: Nenhum almoxarifado vinculado
        if (almoxPermitidos.length === 0) {
            lblFiltro.innerText = 'Nenhum almoxarifado vinculado';
            window.almoxarifadosSelecionados = [];
            if (btnFiltro) {
                btnFiltro.onclick = null;
                btnFiltro.style.cursor = 'default';
            }
            listaEl.innerHTML = '';
            return;
        }

        // Caso 1: Apenas 1 almoxarifado vinculado -> exibe direto no rodapé sem dropdown
        if (almoxPermitidos.length === 1) {
            const unico = almoxPermitidos[0];
            lblFiltro.innerText = `${window.fmtCod(unico.codigo)} - ${unico.descricao}`;
            window.almoxarifadosSelecionados = [unico.id];
            if (btnFiltro) {
                btnFiltro.onclick = null;
                btnFiltro.style.cursor = 'default';
            }
            listaEl.innerHTML = `<input type="checkbox" class="chk-almox-item" value="${unico.id}" checked style="display:none;">`;
            return;
        }

        // Caso 2: Mais de 1 almoxarifado vinculado -> exibe lista rolável com checkboxes
        if (btnFiltro) {
            btnFiltro.onclick = () => toggleDropdown('menu-filtro-almox');
            btnFiltro.style.cursor = 'pointer';
        }

        listaEl.innerHTML = almoxPermitidos.map(almox => `
            <label style="position: static; display: flex; align-items: center; gap: 8px; padding: 6px 8px; min-height: 28px; border-radius: 4px; margin: 0; cursor: pointer; font-size: 0.75rem; color: #334155; box-sizing: border-box; width: 100%;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
                <input type="checkbox" class="chk-almox-item" value="${almox.id}" checked onchange="atualizarLabelFiltro()" style="cursor: pointer; flex-shrink: 0; margin: 0;">
                <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; text-align: left;" title="${window.fmtCod(almox.codigo)} - ${almox.descricao}">${window.fmtCod(almox.codigo)} - ${almox.descricao}</span>
            </label>
        `).join('');

        if (chkTodos) chkTodos.checked = true;
        atualizarLabelFiltro();
    } catch (err) {
        console.error('Erro ao carregar filtro de almoxarifados:', err);
        if (lblFiltro) lblFiltro.innerText = 'Erro ao carregar';
    }
}

function toggleTodosAlmoxarifados(checkbox) {
    const isChecked = checkbox.checked;
    document.querySelectorAll('.chk-almox-item').forEach(item => {
        item.checked = isChecked;
    });
    atualizarLabelFiltro();
}

function atualizarLabelFiltro() {
    const itens = Array.from(document.querySelectorAll('.chk-almox-item'));
    const marcados = itens.filter(i => i.checked);
    const chkTodos = document.getElementById('chk-todos-almox');
    const lblFiltro = document.getElementById('label-filtro-almox');

    window.almoxarifadosSelecionados = marcados.map(i => i.value);

    if (chkTodos) {
        chkTodos.checked = itens.length > 0 && marcados.length === itens.length;
    }

    if (marcados.length === 0) {
        lblFiltro.innerText = 'Nenhum selecionado';
    } else if (marcados.length === itens.length) {
        lblFiltro.innerText = 'Todos os Almoxarifados';
    } else if (marcados.length === 1) {
        const texto = marcados[0].parentElement?.querySelector('span')?.innerText;
        lblFiltro.innerText = texto || '1 almoxarifado';
    } else {
        lblFiltro.innerText = `${marcados.length} almoxarifado(s)`;
    }

    document.dispatchEvent(new CustomEvent('filtroAlmoxarifadosAlterado', {
        detail: { selecionados: window.almoxarifadosSelecionados }
    }));
}

// ================= PAINEL DE PENDÊNCIAS NA TELA INICIAL =================
async function carregarPainelPendenciasHome() {
    const welcome = document.getElementById('dashboard-welcome');
    if (!welcome || !window.db) return;

    const podeAjusteMac = window.temPermissao('ajuste_estoque', 'view');
    const podeRequisicoes = window.temPermissao('requisicoes', 'view');
    const podeEmprestimos = window.temPermissao('emprestimos', 'view');

    if (!podeAjusteMac && !podeRequisicoes && !podeEmprestimos) {
        document.getElementById('painel-pendencias-home')?.classList.remove('visivel');
        return;
    }

    // Injeta regras de layout (colunas paralelas, scroll acima de 3 itens e loading) uma única vez
    if (!document.getElementById('style-painel-pendencias-opt')) {
        const style = document.createElement('style');
        style.id = 'style-painel-pendencias-opt';
        style.textContent = `
            #painel-pendencias-home.multi-col {
                width: 630px !important;
                max-width: calc(100vw - 40px) !important;
            }
            #painel-pendencias-grid {
                display: flex;
                gap: 12px;
                align-items: flex-start;
                width: 100%;
            }
            .painel-pend-col {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }
            #painel-pendencias-home .painel-pend-lista {
                max-height: 178px;
                overflow-y: auto;
                padding-right: 2px;
            }
            .painel-pend-badge.vermelho {
                background: #fee2e2;
                color: #b91c1c;
            }
            .painel-pend-loading {
                width: 100%;
                padding: 26px 12px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 8px;
                color: #64748b;
                font-size: 0.78rem;
                font-weight: 700;
            }
            .painel-pend-loading svg {
                width: 22px;
                height: 22px;
                color: var(--cnx-orange);
            }
        `;
        document.head.appendChild(style);
    }

    let painel = document.getElementById('painel-pendencias-home');
    if (!painel) {
        welcome.insertAdjacentHTML('beforeend', `
            <aside id="painel-pendencias-home" class="painel-pendencias-esq" aria-label="Pendências Operacionais">
                <div class="painel-pend-topo">
                    <div class="painel-pend-titulo">
                        <i data-lucide="bell-ring"></i>
                        <span>Pendências Operacionais</span>
                    </div>
                    <button type="button" id="btn-refresh-pendencias-home" class="painel-pend-refresh" title="Atualizar pendências">
                        <i data-lucide="refresh-cw" class="refresh-icon"></i>
                    </button>
                </div>
                <div id="painel-pendencias-grid"></div>
            </aside>
        `);
        painel = document.getElementById('painel-pendencias-home');

        painel.querySelector('#btn-refresh-pendencias-home')?.addEventListener('click', (e) => {
            e.stopPropagation();
            carregarPainelPendenciasHome();
        });

        painel.addEventListener('click', (e) => {
            const card = e.target.closest('[data-abrir-modulo]');
            if (!card) return;
            const mod = card.dataset.abrirModulo;

            if (mod === 'ajuste_estoque') {
                window.ajusteEstoqueAutoAbrir = {
                    origemId: card.dataset.origemId || '',
                    destinoId: card.dataset.destinoId || '',
                    pairKey: card.dataset.pairKey || '',
                    abrirAbaMacs: true
                };
            }

            painel.classList.remove('visivel');
            navegarPara(mod);
        });
    }

    const gridEl = painel.querySelector('#painel-pendencias-grid');
    const btnRefresh = painel.querySelector('#btn-refresh-pendencias-home');
    const iconRefresh = btnRefresh?.querySelector('.refresh-icon');

    // Exibe animação de carregamento (tanto na abertura quanto ao atualizar)
    if (idAtual === 'dashboard') {
        painel.classList.remove('multi-col');
        painel.classList.add('visivel');
        if (btnRefresh) btnRefresh.disabled = true;
        if (iconRefresh) iconRefresh.classList.add('lucide-spin');
        gridEl.innerHTML = `
            <div class="painel-pend-loading">
                <i data-lucide="loader-2" class="lucide-spin"></i>
                <span>Carregando pendências...</span>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    }

    try {
        const { data: { session } } = await window.db.auth.getSession();
        if (!session) {
            painel.classList.remove('visivel');
            return;
        }

        const uid = session.user.id;
        const [{ data: user }, { data: vincs }] = await Promise.all([
            window.db.from('usuarios').select('acesso_todos_almoxarifados, cargos(nome)').eq('id', uid).single(),
            window.db.from('usuario_almoxarifados').select('almoxarifado_id').eq('usuario_id', uid)
        ]);

        const cargoUpper = String(user?.cargos?.nome || '').toUpperCase();
        const isGestor = cargoUpper === 'ADMINISTRADOR' || cargoUpper.includes('SUPERVISOR') || !!user?.acesso_todos_almoxarifados;

        let almoxIds = (vincs || []).map(v => String(v.almoxarifado_id));
        const temSelecaoRodape = Array.isArray(window.almoxarifadosSelecionados) && window.almoxarifadosSelecionados.length > 0;
        if (temSelecaoRodape) {
            const selRodape = window.almoxarifadosSelecionados.map(String);
            almoxIds = isGestor ? selRodape : almoxIds.filter(id => selRodape.includes(id));
        }

        const filtroRestrito = !isGestor || temSelecaoRodape;
        const categorias = [];

        // ================= 1. AJUSTES MAC PENDENTES (MESMA REGRA: ORIGEM + DESTINO) =================
        if (podeAjusteMac && (!filtroRestrito || almoxIds.length > 0)) {
            let qMac = window.db
                .from('coletas_mac')
                .select(`
                    id,
                    almoxarifado_id,
                    almoxarifado_destino_id,
                    almoxarifado_origem:almoxarifados!almoxarifado_id(codigo, descricao),
                    almoxarifado_destino:almoxarifados!almoxarifado_destino_id(codigo, descricao)
                `)
                .eq('status', 'PENDENTE');

            if (filtroRestrito) {
                const idsFmt = almoxIds.join(',');
                qMac = qMac.or(`almoxarifado_destino_id.in.(${idsFmt}),almoxarifado_id.in.(${idsFmt})`);
            }

            const { data: macs, error: errMac } = await qMac;
            if (errMac) console.error('Erro ao buscar MACs pendentes no painel:', errMac);

            const listaMac = macs || [];
            if (listaMac.length > 0) {
                const mapaAlmoxMac = {};
                listaMac.forEach(m => {
                    const origemId = String(m.almoxarifado_id || '');
                    const destinoId = String(m.almoxarifado_destino_id || m.almoxarifado_id || '');
                    if (!destinoId) return;

                    const pairKey = `${origemId}|${destinoId}`;
                    if (!mapaAlmoxMac[pairKey]) {
                        const origObj = m.almoxarifado_origem;
                        const destObj = m.almoxarifado_destino || m.almoxarifado_origem;
                        const descOrigem = origObj
                            ? `${window.fmtCod(origObj.codigo)} - ${origObj.descricao}`
                            : 'Não identificado';
                        const descDestino = destObj
                            ? `${window.fmtCod(destObj.codigo)} - ${destObj.descricao}`
                            : 'Não identificado';

                        mapaAlmoxMac[pairKey] = {
                            pairKey,
                            origemId,
                            destinoId,
                            descOrigem,
                            descDestino,
                            qtd: 0
                        };
                    }
                    mapaAlmoxMac[pairKey].qtd += 1;
                });

                const gruposMac = Object.values(mapaAlmoxMac).sort((a, b) =>
                    b.qtd - a.qtd ||
                    a.descDestino.localeCompare(b.descDestino, 'pt-BR', { sensitivity: 'base' }) ||
                    a.descOrigem.localeCompare(b.descOrigem, 'pt-BR', { sensitivity: 'base' })
                );

                categorias.push({
                    titulo: 'Ajustes MAC Pendentes',
                    badgeClass: 'laranja',
                    total: listaMac.length,
                    htmlItens: gruposMac.map(g => {
                        const rotuloQtd = g.qtd === 1 ? '1 REGISTRO' : `${g.qtd} REGISTROS`;
                        const hintTexto = `Coleta (Origem): ${g.descOrigem} | Destino: ${g.descDestino}`;
                        return `
                            <div class="painel-pend-item" data-abrir-modulo="ajuste_estoque" data-pair-key="${g.pairKey}" data-origem-id="${g.origemId}" data-destino-id="${g.destinoId}" title="${hintTexto}">
                                <div class="painel-pend-item-topo">
                                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:190px;">${g.descDestino}</span>
                                    <span style="color:#c2410c; flex-shrink:0;">${rotuloQtd}</span>
                                </div>
                                <div class="painel-pend-item-sub">Clique para abrir equipamentos do ajuste</div>
                            </div>
                        `;
                    }).join('')
                });
            }
        }

        // ================= 2. REQUISIÇÕES (POR ETAPA E RESPONSÁVEL) =================
        if (podeRequisicoes && (!filtroRestrito || almoxIds.length > 0)) {
            let qReq = window.db
                .from('requisicoes')
                .select(`
                    id, codigo, status, usuario_solicitante_id,
                    almoxarifado_requisitante_id, almoxarifado_abastecedor_id,
                    requisitante:almoxarifados!almoxarifado_requisitante_id(codigo, descricao),
                    abastecedor:almoxarifados!almoxarifado_abastecedor_id(codigo, descricao),
                    divergencias:requisicao_divergencias(id)
                `)
                .not('status', 'in', '(CANCELADA,REPROVADA)')
                .order('codigo', { ascending: false })
                .limit(60);

            if (filtroRestrito) {
                const idsFmt = almoxIds.map(id => `"${id}"`).join(',');
                qReq = qReq.or(`almoxarifado_requisitante_id.in.(${idsFmt}),almoxarifado_abastecedor_id.in.(${idsFmt})`);
            }

            const { data: reqs, error: errReq } = await qReq;
            if (errReq) console.error('Erro ao buscar requisições pendentes no painel:', errReq);

            const statusAguardandoReceb = ['ENVIADA', 'ENVIADO', 'EM TRANSITO', 'AGUARDANDO RECEBIMENTO'];
            const statusFechada = ['CONCLUIDA', 'CONCLUÍDA', 'RECEBIDA', 'CONCLUIDA COM DIVERGENCIA', 'CONCLUÍDA COM DIVERGÊNCIA'];

            const reqsFiltradas = [];
            (reqs || []).forEach(r => {
                const st = String(r.status || '').toUpperCase();
                const origId = String(r.almoxarifado_abastecedor_id || '');
                const destId = String(r.almoxarifado_requisitante_id || '');

                const pertenceOrigem = !filtroRestrito || almoxIds.includes(origId);
                const pertenceDestino = !filtroRestrito || almoxIds.includes(destId) || String(r.usuario_solicitante_id) === String(uid);

                const temDivergencia = st.includes('DIVERG') || (Array.isArray(r.divergencias) && r.divergencias.length > 0);
                const solicitanteDesc = r.requisitante ? `${window.fmtCod(r.requisitante.codigo)} - ${r.requisitante.descricao}` : '-';
                const origemDesc = r.abastecedor ? `${window.fmtCod(r.abastecedor.codigo)} - ${r.abastecedor.descricao}` : '-';

                if ((st === 'PENDENTE' || st === 'APROVADA') && pertenceOrigem) {
                    reqsFiltradas.push({
                        codigo: r.codigo,
                        etapa: st === 'PENDENTE' ? 'PENDENTE' : 'AGUARD. ENVIO',
                        cor: '#0369a1',
                        subtitulo: `Solicitante: ${solicitanteDesc}`
                    });
                    return;
                }

                if (statusAguardandoReceb.includes(st) && pertenceDestino) {
                    reqsFiltradas.push({
                        codigo: r.codigo,
                        etapa: 'AGUARD. RECEB.',
                        cor: '#6d28d9',
                        subtitulo: `Origem: ${origemDesc}`
                    });
                    return;
                }

                if (temDivergencia && statusFechada.includes(st) && pertenceOrigem) {
                    reqsFiltradas.push({
                        codigo: r.codigo,
                        etapa: 'COM DIVERGÊNCIA',
                        cor: '#dc2626',
                        subtitulo: `Solicitante: ${solicitanteDesc}`
                    });
                }
            });

            if (reqsFiltradas.length > 0) {
                categorias.push({
                    titulo: 'Requisições',
                    badgeClass: 'azul',
                    total: reqsFiltradas.length,
                    htmlItens: reqsFiltradas.map(r => {
                        const cod = String(r.codigo || '').padStart(6, '0');
                        return `
                            <div class="painel-pend-item" data-abrir-modulo="requisicoes">
                                <div class="painel-pend-item-topo">
                                    <span>REQ #${cod}</span>
                                    <span style="color:${r.cor}; font-weight:800;">${r.etapa}</span>
                                </div>
                                <div class="painel-pend-item-sub" title="${r.subtitulo}">${r.subtitulo}</div>
                            </div>
                        `;
                    }).join('')
                });
            }
        }

        // ================= 3. EMPRÉSTIMOS VENCIDOS =================
        if (podeEmprestimos && (!filtroRestrito || almoxIds.length > 0)) {
            const hojeIso = new Date().toISOString().split('T')[0];

            let qEmp = window.db
                .from('emprestimos')
                .select('id, codigo, responsavel, previsao_devolucao, status, almoxarifado_id, almoxarifado:almoxarifados(codigo, descricao)')
                .in('status', ['ATIVO', 'DEVOLUCAO PARCIAL', 'ATRASADO'])
                .lt('previsao_devolucao', hojeIso)
                .order('previsao_devolucao', { ascending: true })
                .limit(30);

            if (filtroRestrito) {
                qEmp = qEmp.in('almoxarifado_id', almoxIds);
            }

            const { data: emps, error: errEmp } = await qEmp;
            if (errEmp) console.error('Erro ao buscar empréstimos vencidos no painel:', errEmp);

            const listaEmp = emps || [];
            if (listaEmp.length > 0) {
                categorias.push({
                    titulo: 'Empréstimos Vencidos',
                    badgeClass: 'vermelho',
                    total: listaEmp.length,
                    htmlItens: listaEmp.map(emp => {
                        const cod = String(emp.codigo || '').padStart(6, '0');
                        const prevBr = emp.previsao_devolucao
                            ? new Date(emp.previsao_devolucao + 'T12:00:00').toLocaleDateString('pt-BR')
                            : '-';
                        const resp = emp.responsavel || 'Responsável não informado';
                        return `
                            <div class="painel-pend-item" data-abrir-modulo="emprestimos">
                                <div class="painel-pend-item-topo">
                                    <span>EMP #${cod}</span>
                                    <span style="color:#dc2626; font-weight:800;">VENC. ${prevBr}</span>
                                </div>
                                <div class="painel-pend-item-sub" title="${resp}">${resp}</div>
                            </div>
                        `;
                    }).join('')
                });
            }
        }

        if (categorias.length === 0 || idAtual !== 'dashboard') {
            painel.classList.remove('visivel');
            return;
        }

        const colunas = [];
        for (let i = 0; i < categorias.length; i += 2) {
            colunas.push(categorias.slice(i, i + 2));
        }

        painel.classList.toggle('multi-col', colunas.length > 1);

        gridEl.innerHTML = colunas.map(col => `
            <div class="painel-pend-col">
                ${col.map(cat => `
                    <div class="painel-pend-secao">
                        <div class="painel-pend-sub">
                            <span>${cat.titulo}</span>
                            <span class="painel-pend-badge ${cat.badgeClass}">${cat.total}</span>
                        </div>
                        <div class="painel-pend-lista">
                            ${cat.htmlItens}
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('');

        painel.classList.add('visivel');
        if (window.lucide) lucide.createIcons();
    } catch (err) {
        console.error('Erro ao carregar painel de pendências:', err);
        painel.classList.remove('visivel');
    } finally {
        if (btnRefresh) btnRefresh.disabled = false;
        if (iconRefresh) iconRefresh.classList.remove('lucide-spin');
    }
}

document.addEventListener('filtroAlmoxarifadosAlterado', () => {
    if (idAtual === 'dashboard') carregarPainelPendenciasHome();
});

async function fazerLogout() {
    const conf = await window.appConfirm(
        'Sair do Sistema',
        'Tem certeza que deseja encerrar a sua sessão?',
        'warning',
        'Sim, sair',
        'Cancelar'
    );
    if (!conf) return;
    await window.db.auth.signOut();
    window.location.replace('../index.html');
}

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
        if (resA.data) resA.data.forEach(a => window.almoxarifadosCacheMap[String(a.id).toLowerCase()] = `${window.fmtCod(a.codigo)} - ${a.descricao}`);
        if (resU.data) resU.data.forEach(u => window.usuariosCacheMap[String(u.id).toLowerCase()] = u.nome_completo);
        if (resP.data) resP.data.forEach(p => window.produtosCacheMap[String(p.id).toLowerCase()] = `${window.fmtCod(p.codigo)} - ${p.descricao}`);
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
    
    const chavesIgnoradas = ['id', 'created_at', 'modificado_em', 'atualizado_em', 'requisicao_id', 'emprestimo_id', 'ajuste_estoque_id', 'senha', 'avatar_url', 'qtd_devolvida'];
    
    if (tabelaOrigem === 'requisicao_itens' && antigos && novos && novos.qtd_enviada && antigos.qtd_enviada !== novos.qtd_enviada) {
        if (Number(novos.qtd_enviada) === Number(novos.qtd_aprovada)) chavesIgnoradas.push('qtd_enviada');
    }

    const rotulosAmigaveis = {
        'codigo': 'Código Interno', 'descricao': 'Descrição', 'status': 'Status', 'nome': 'Nome',
        'almoxarifado_abastecedor_id': 'Abastecedor (Origem)', 'almoxarifado_requisitante_id': 'Solicitante (Destino)',
        'usuario_atendente_id': 'Atendente', 'usuario_solicitante_id': 'Solicitante',
        'observacoes_solicitacao': 'Obs. Solicitação', 'dados_envio': 'Dados Envio', 'numero_pedido': 'Pedido ERP',
        'produto_id': 'Equipamento / Produto', 'qtd_solicitada': 'Qtd. Solicitada', 'qtd_aprovada': 'Qtd. Aprovada', 
        'qtd_enviada': 'Qtd. Enviada', 'qtd_recebida': 'Qtd. Conferida/Recebida', 'justificativa': 'Justificativa',
        'responsavel': 'Responsável Pelo Empréstimo', 'data_emprestimo': 'Data de Abertura', 
        'previsao_devolucao': 'Previsão de Devolução', 'data_devolucao': 'Devolução Efetiva',
        'qtd_emprestada': 'Qtd. de Saída (Emprestada)', 'observacoes': 'Observações Adicionais',
        'arquivo_assinatura': 'Documento de Assinatura (Ficha)',
        'produto_patrimonio_erp': 'Novo Patrimônio ERP',
        'mac': 'MAC (Gpon)',
        'numero_serie': 'Nº de Série',
        'nome_completo': 'Nome Completo',
        'ativo': 'Ativo',
        'acesso_todos_almoxarifados': 'Acesso a Todos os Almoxarifados',
        'historico_acessos': 'Acessos e Permissões',
        'permissoes': 'Permissões do Usuário'
    };

    const mapaTelas = { mobile: 'App Mobile (PWA)' };
    const mapaAcoes = {
        mobile: { acessar: 'Acessar App Mobile', coleta_mac: 'Coleta de MAC', requisicoes: 'Requisições' }
    };
    if (typeof menuEstrutura !== 'undefined') {
        Object.values(menuEstrutura).forEach(telas => {
            telas.forEach(t => {
                mapaTelas[t.id] = t.nome;
                mapaAcoes[t.id] = {};
                (t.acoes || []).forEach(a => { mapaAcoes[t.id][a.key] = a.label; });
            });
        });
    }

    const traduzirAcao = (mod, acao) => {
        if (mapaAcoes[mod] && mapaAcoes[mod][acao]) return mapaAcoes[mod][acao];
        const padrao = { view: 'Visualizar', create: 'Criar', edit: 'Editar', delete: 'Inativar/Excluir', approve: 'Aprovar/Reprovar', dispatch: 'Despachar', receive: 'Receber', return: 'Devolver', export: 'Exportar' };
        return padrao[acao] || acao.toUpperCase();
    };

    const parseJsonSeguro = (val) => {
        if (!val) return {};
        if (typeof val === 'object') return val;
        try { return JSON.parse(val); } catch { return {}; }
    };

    const renderBlocoDiff = (titulo, htmlAntigo, htmlNovo) => `
        <div style="background: white; border: 1px solid #e2e8f0; border-radius: 4px; overflow: hidden; margin-bottom: 4px;">
            <div style="background: #f8fafc; padding: 4px 8px; font-size: 0.6rem; font-weight: 800; color: var(--cnx-blue); border-bottom: 1px solid #e2e8f0; text-transform: uppercase;">Modificação em: ${titulo}</div>
            <div style="display: flex; flex-direction: row; width: 100%;">
                <div style="flex: 1; padding: 6px 8px; background: #fef2f2; color: #991b1b; border-right: 1px solid #e2e8f0; font-family: inherit; font-size: 0.7rem; text-align: left;">
                    <div style="text-decoration: line-through; opacity: 0.7; margin-bottom: 4px; font-size: 0.6rem; font-weight: 700;">ANTERIOR:</div>${htmlAntigo}
                </div>
                <div style="flex: 1; padding: 6px 8px; background: #ecfdf5; color: #065f46; font-family: inherit; font-size: 0.7rem; text-align: left;">
                    <div style="margin-bottom: 4px; font-size: 0.6rem; font-weight: 700;">NOVO:</div>${htmlNovo}
                </div>
            </div>
        </div>`;

    const renderDiffMatrizPermissoes = (antPerms, novPerms) => {
        let out = '';
        const todosMods = [...new Set([...Object.keys(antPerms || {}), ...Object.keys(novPerms || {})])]
            .filter(mod => Object.keys(mapaTelas).length === 0 || !!mapaTelas[mod]);

        todosMods.forEach(mod => {
            const pAnt = (antPerms && antPerms[mod]) || {};
            const pNov = (novPerms && novPerms[mod]) || {};
            const todasAcoes = [...new Set([...Object.keys(pAnt), ...Object.keys(pNov)])];

            let linhasAnt = [];
            let linhasNov = [];

            todasAcoes.forEach(acao => {
                const vAnt = !!pAnt[acao];
                const vNov = !!pNov[acao];
                if (vAnt !== vNov) {
                    const nomeAcao = traduzirAcao(mod, acao);
                    linhasAnt.push(`<div><strong>${nomeAcao}:</strong> ${vAnt ? 'SIM' : 'NÃO'}</div>`);
                    linhasNov.push(`<div><strong>${nomeAcao}:</strong> ${vNov ? 'SIM' : 'NÃO'}</div>`);
                }
            });

            if (linhasAnt.length > 0) {
                const nomeTela = mapaTelas[mod] || mod.toUpperCase();
                out += renderBlocoDiff(`Permissões — ${nomeTela}`, linhasAnt.join(''), linhasNov.join(''));
            }
        });
        return out;
    };

    const formatarValorAmigavel = (chave, valor) => {
        if (valor === null || valor === '' || valor === undefined || valor === 'NULO') return '<span style="color: #94a3b8; font-style: italic;">Nenhum</span>';
        if (typeof valor === 'boolean') return valor ? 'SIM' : 'NÃO';
        if (typeof valor === 'object') return JSON.stringify(valor);
        
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
        const sAnt = (typeof objAntigo === 'object' && objAntigo !== null) ? JSON.stringify(objAntigo) : String(objAntigo ?? '');
        const sNov = (typeof objNovo === 'object' && objNovo !== null) ? JSON.stringify(objNovo) : String(objNovo ?? '');

        if (sAnt !== sNov) {
            let vAntigo = chavePai ? formatarValorAmigavel(chavePai, objAntigo) : (objAntigo || 'Nenhum');
            let vNovo = chavePai ? formatarValorAmigavel(chavePai, objNovo) : (objNovo || 'Nenhum');
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
    else if (tabelaOrigem === 'coletas_mac') {
        const macInfo = (novos && novos.mac) || (antigos && antigos.mac) || null;
        if (macInfo) produtoDoContexto = `Equipamento MAC: ${macInfo}`;
    }

    if (antigos && novos) { // UPDATE
        let temAlteracao = false;
        let blocosDiff = '';
        for (const key in novos) {
            const labelKey = key.toLowerCase();
            if (chavesIgnoradas.includes(labelKey)) continue;

            if (labelKey === 'historico_acessos') {
                const antAcc = parseJsonSeguro(antigos[key]);
                const novAcc = parseJsonSeguro(novos[key]);

                if (String(antAcc.Cargo || '') !== String(novAcc.Cargo || '')) {
                    temAlteracao = true;
                    blocosDiff += renderBlocoDiff('Cargo', `<div>${antAcc.Cargo || 'Nenhum'}</div>`, `<div>${novAcc.Cargo || 'Nenhum'}</div>`);
                }
                if (String(antAcc.Almoxarifados || '') !== String(novAcc.Almoxarifados || '')) {
                    temAlteracao = true;
                    blocosDiff += renderBlocoDiff('Almoxarifados Vinculados', `<div>${antAcc.Almoxarifados || 'Nenhum'}</div>`, `<div>${novAcc.Almoxarifados || 'Nenhum'}</div>`);
                }
                const diffPerms = renderDiffMatrizPermissoes(antAcc.Permissoes, novAcc.Permissoes);
                if (diffPerms) { temAlteracao = true; blocosDiff += diffPerms; }
                continue;
            }

            if (labelKey === 'permissoes') {
                const diffPerms = renderDiffMatrizPermissoes(parseJsonSeguro(antigos[key]), parseJsonSeguro(novos[key]));
                if (diffPerms) { temAlteracao = true; blocosDiff += diffPerms; }
                continue;
            }

            const diffResult = renderObjectDiff(antigos[key], novos[key], key);
            if (diffResult.hasDiff) {
                temAlteracao = true;
                let keyLabel = rotulosAmigaveis[labelKey] || key.replace(/_/g, ' ');
                blocosDiff += renderBlocoDiff(keyLabel, diffResult.antigo, diffResult.novo);
            }
        }
        if (!temAlteracao) return ''; 
        if (produtoDoContexto) html += `<div style="font-size: 0.75rem; font-weight: 800; color: var(--cnx-orange); margin-bottom: 4px;">${produtoDoContexto}</div>`;
        html += blocosDiff;

    } else if (antigos && !novos) { // DELETE
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
            
            containerEl.querySelectorAll('.sort-col').forEach(el => {
                const icone = el.querySelector('i');
                if (icone) {
                    icone.setAttribute('data-lucide', 'chevron-down');
                    icone.style.opacity = '0.3';
                    icone.style.color = 'inherit';
                }
            });
            
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
        {
            id: 'produtos', nome: 'Produtos', icone: 'box',
            acoes: [
                { key: 'view', label: 'Visualizar' },
                { key: 'create', label: 'Criar' },
                { key: 'edit', label: 'Editar' },
                { key: 'delete', label: 'Inativar' }
            ]
        },
        {
            id: 'almoxarifados', nome: 'Almoxarifados', icone: 'warehouse',
            acoes: [
                { key: 'view', label: 'Visualizar' },
                { key: 'create', label: 'Criar' },
                { key: 'edit', label: 'Editar' },
                { key: 'delete', label: 'Inativar' }
            ]
        },
        {
            id: 'usuarios', nome: 'Usuários', icone: 'users',
            acoes: [
                { key: 'view', label: 'Visualizar' },
                { key: 'create', label: 'Criar' },
                { key: 'edit', label: 'Editar' },
                { key: 'delete', label: 'Inativar' }
            ]
        }
    ],
    'Movimentações': [
        {
            id: 'requisicoes', nome: 'Requisição e Envio', icone: 'truck',
            acoes: [
                { key: 'view', label: 'Visualizar' },
                { key: 'create', label: 'Criar' },
                { key: 'edit', label: 'Editar' },
                { key: 'delete', label: 'Excluir' },
                { key: 'approve', label: 'Aprovar/Reprovar' },
                { key: 'dispatch', label: 'Despachar' },
                { key: 'receive', label: 'Receber' }
            ]
        },
        {
            id: 'emprestimos', nome: 'Empréstimos', icone: 'wrench',
            acoes: [
                { key: 'view', label: 'Visualizar' },
                { key: 'create', label: 'Criar' },
                { key: 'edit', label: 'Editar' },
                { key: 'return', label: 'Devolver' },
                { key: 'delete', label: 'Cancelar' }
            ]
        },
        {
            id: 'coleta_mac', nome: 'Coleta de MAC', icone: 'cpu',
            acoes: [
                { key: 'view', label: 'Visualizar' },
                { key: 'create', label: 'Coletar' },
                { key: 'edit', label: 'Editar' },
                { key: 'delete', label: 'Excluir' }
            ]
        },
        {
            id: 'ajuste_estoque', nome: 'Ajuste de Estoque', icone: 'layers',
            acoes: [
                { key: 'view', label: 'Visualizar' },
                { key: 'create', label: 'Criar' },
                { key: 'edit', label: 'Editar' },
                { key: 'delete', label: 'Cancelar/Excluir' }
            ]
        }
    ],
    'Relatórios': [
        {
            id: 'rel_requisicoes', nome: 'Rel. Requisições', icone: 'file-spreadsheet',
            acoes: [
                { key: 'view', label: 'Visualizar' },
                { key: 'export', label: 'Exportar (PDF/CSV)' }
            ]
        },
        {
            id: 'rel_emprestimos', nome: 'Rel. Empréstimos', icone: 'clipboard-list',
            acoes: [
                { key: 'view', label: 'Visualizar' },
                { key: 'export', label: 'Exportar (PDF/CSV)' }
            ]
        },
        {
            id: 'rel_ajustes_mac', nome: 'Rel. Ajustes de MAC', icone: 'cpu',
            acoes: [
                { key: 'view', label: 'Visualizar' },
                { key: 'export', label: 'Exportar (PDF/CSV)' }
            ]
        }
    ],
    'Configurações': [
        {
            id: 'cfg_conta', nome: 'Minha Conta', icone: 'user-cog',
            acoes: [
                { key: 'view', label: 'Visualizar' },
                { key: 'edit', label: 'Alterar Foto/Senha' }
            ]
        },
        {
            id: 'cfg_regras', nome: 'Regras de Operação', icone: 'sliders',
            acoes: [
                { key: 'view', label: 'Visualizar' },
                { key: 'edit', label: 'Alterar' }
            ]
        },
        {
            id: 'cfg_buckets', nome: 'Retenção de Buckets', icone: 'hard-drive',
            acoes: [
                { key: 'view', label: 'Visualizar' },
                { key: 'edit', label: 'Alterar Prazo' },
                { key: 'delete', label: 'Executar Limpeza' }
            ]
        },
        {
            id: 'cfg_cargos', nome: 'Gestão de Cargos', icone: 'shield',
            acoes: [
                { key: 'view', label: 'Visualizar' },
                { key: 'create', label: 'Criar' },
                { key: 'edit', label: 'Editar' },
                { key: 'delete', label: 'Excluir' }
            ]
        },
        {
            id: 'cfg_auditoria', nome: 'Auditoria', icone: 'activity',
            acoes: [
                { key: 'view', label: 'Visualizar' },
                { key: 'export', label: 'Exportar (PDF/CSV)' }
            ]
        },
        {
            id: 'cfg_backup', nome: 'Backup e Importação', icone: 'database-backup',
            acoes: [
                { key: 'view', label: 'Exportar Tabelas' },
                { key: 'create', label: 'Importar Dados' }
            ]
        },
        {
            id: 'cfg_sobre', nome: 'Sobre (Link)', icone: 'info',
            acoes: [
                { key: 'edit', label: 'Alterar Link' }
            ]
        }
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

    if (janelasAbertas['configuracoes'] && idAtual !== 'configuracoes') {
        html += `
            <div class="sidebar-category">Sistema</div>
            <div class="sidebar-item">
                <div class="item-info" onclick="restaurarJanela('configuracoes')" style="flex:1;">
                    <i data-lucide="settings" class="item-icon"></i> Configurações
                </div>
                <button class="btn-close-sidebar" onclick="fecharJanelaPeloSidebar(event, 'configuracoes')" title="Fechar Tela">
                    <i data-lucide="x"></i>
                </button>
            </div>
        `;
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

    if (rota !== 'dashboard' && !window.temPermissao(rota, 'view')) {
        window.appAlert('Acesso Negado', 'Você não tem permissão para acessar esta tela.', 'error');
        return;
    }

    document.getElementById('painel-pendencias-home')?.classList.remove('visivel');

    if (idAtual && idAtual !== 'dashboard') {
        const frameAtual = document.getElementById('janela-' + idAtual);
        if (frameAtual) {
            frameAtual.classList.add('minimized');
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
            <div id="dashboard-welcome" style="position:relative; width:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#64748b;">
                <img src="../assets/imagens/Logo.png" alt="Logo" style="width:80px; margin-bottom:1rem; opacity:0.5; filter:grayscale(1);">
                <h2>Bem-vindo ao Smart CNX</h2>
                <p>Selecione uma opção no menu acima para começar.</p>
            </div>
        `;
        for (const r in janelasAbertas) {
            appContentInner.appendChild(janelasAbertas[r].node);
            janelasAbertas[r].node.style.display = 'none';
        }
        renderizarSidebar();
        carregarPainelPendenciasHome();
        return;
    }
    
    document.body.classList.add('compact-mode');
    
    const dashContent = document.getElementById('dashboard-welcome');
    if (dashContent) dashContent.remove();

    if (janelasAbertas[rota]) {
        if (timeoutJanelas[rota]) clearTimeout(timeoutJanelas[rota]);
        
        const f = janelasAbertas[rota].node;
        if (!f.parentNode) appContentInner.appendChild(f);
        
        f.style.display = 'flex'; 
        f.classList.remove('maximized');
        janelasAbertas[rota].isMaximized = false;
        
        setTimeout(() => { f.classList.remove('minimized'); }, 10);
        renderizarSidebar();
        
        const evt = new CustomEvent('telaRestaurada', { detail: { rota } });
        document.dispatchEvent(evt);
        return;
    }

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

// ================= MONITOR DE SESSÃO ATIVA (INATIVIDADE + CONTADOR 60s) =================
(function setupMonitorSessao() {
    let sessaoUserId = null;
    let tempoInatividadeMs = 15 * 60 * 1000;
    let ultimaInteracao = Date.now();
    let intervalChecagem = null;
    let intervalContagem = null;
    let segundosRestantes = 60;
    let avisoAberto = false;
    let eventosRegistrados = false;

    function garantirModalSessao() {
        if (document.getElementById('modal-sessao-expirando')) return;

        document.body.insertAdjacentHTML('beforeend', `
            <div id="modal-sessao-expirando" class="custom-popup-overlay" style="z-index: 20000;">
                <div class="custom-popup-box" style="max-width: 400px; padding: 1.75rem 1.5rem; text-align: center;">
                    <h3 style="margin: 0 0 6px 0; color: var(--cnx-blue); font-size: 1.05rem; font-weight: 800;">
                        Sessão Prestes a Expirar
                    </h3>
                    <p style="margin: 0 0 1.1rem 0; font-size: 0.8rem; color: #64748b; line-height: 1.4;">
                        Nenhuma interação foi detectada recentemente. Sua sessão será encerrada automaticamente em:
                    </p>

                    <!-- Relógio Analógico + Digital -->
                    <div style="position: relative; width: 132px; height: 132px; margin: 0 auto 1.25rem auto; display: flex; align-items: center; justify-content: center;">
                        <svg width="132" height="132" viewBox="0 0 132 132" style="transform: rotate(-90deg);">
                            <circle cx="66" cy="66" r="56" fill="#f8fafc" stroke="#e2e8f0" stroke-width="8"></circle>
                            <circle id="sessao-ring-progresso" cx="66" cy="66" r="56" fill="none" stroke="var(--cnx-orange)" stroke-width="8" stroke-linecap="round" stroke-dasharray="351.86" stroke-dashoffset="0" style="transition: stroke-dashoffset 0.9s linear, stroke 0.3s;"></circle>
                        </svg>
                        <div id="sessao-ponteiro" style="position: absolute; top: 14px; left: 50%; width: 3px; height: 52px; margin-left: -1.5px; background: var(--cnx-blue); border-radius: 99px; transform-origin: bottom center; transform: rotate(0deg); transition: transform 0.9s linear; opacity: 0.35;"></div>
                        <div style="position: absolute; display: flex; flex-direction: column; align-items: center; justify-content: center; background: white; width: 78px; height: 78px; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
                            <span id="sessao-contador-digital" style="font-size: 1.45rem; font-weight: 900; color: var(--cnx-blue); font-variant-numeric: tabular-nums; line-height: 1;">01:00</span>
                            <span style="font-size: 0.6rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-top: 2px;">segundos</span>
                        </div>
                    </div>

                    <div class="popup-actions" style="display: flex; gap: 10px; justify-content: center;">
                        <button type="button" id="btn-sessao-sair" class="popup-btn cancel" style="flex: 1; justify-content: center;">Sair Agora</button>
                        <button type="button" id="btn-sessao-continuar" class="popup-btn confirm" style="flex: 1; justify-content: center;">Continuar</button>
                    </div>
                </div>
            </div>
        `);

        document.getElementById('btn-sessao-continuar').addEventListener('click', () => {
            fecharAvisoSessao();
            ultimaInteracao = Date.now();
        });

        document.getElementById('btn-sessao-sair').addEventListener('click', () => {
            encerrarSessaoPorInatividade();
        });
    }

    async function carregarTempoSessao(userId) {
        try {
            const [resUser, resCfg] = await Promise.all([
                window.db.from('usuarios').select('tempo_sessao_minutos').eq('id', userId).maybeSingle(),
                window.db.from('configuracoes_sistema').select('valor').eq('chave', 'regras').maybeSingle()
            ]);

            if (resUser.error) console.warn('[Sessão] Erro ao ler tempo_sessao_minutos do usuário:', resUser.error.message);

            const tempoUser = Number(resUser.data?.tempo_sessao_minutos);
            const tempoPadrao = Number(resCfg.data?.valor?.tempo_sessao_minutos);

            const minutosFinais = (tempoUser > 0) ? tempoUser : ((tempoPadrao > 0) ? tempoPadrao : 15);
            tempoInatividadeMs = minutosFinais * 60 * 1000;
            console.log(`[Sessão] Monitor ativo: ${minutosFinais} min de inatividade.`);
        } catch (err) {
            console.warn('[Sessão] Usando padrão de 15 min:', err);
            tempoInatividadeMs = 15 * 60 * 1000;
        }
    }

    function atualizarVisorRelogio() {
        const digital = document.getElementById('sessao-contador-digital');
        const ring = document.getElementById('sessao-ring-progresso');
        const ponteiro = document.getElementById('sessao-ponteiro');

        const mins = String(Math.floor(segundosRestantes / 60)).padStart(2, '0');
        const segs = String(segundosRestantes % 60).padStart(2, '0');
        if (digital) {
            digital.innerText = `${mins}:${segs}`;
            digital.style.color = segundosRestantes <= 15 ? '#dc2626' : 'var(--cnx-blue)';
        }

        const circunferencia = 351.86;
        const fracao = (60 - segundosRestantes) / 60;
        if (ring) {
            ring.style.strokeDashoffset = String(circunferencia * fracao);
            ring.style.stroke = segundosRestantes <= 15 ? '#dc2626' : 'var(--cnx-orange)';
        }

        if (ponteiro) {
            const graus = (60 - segundosRestantes) * 6;
            ponteiro.style.transform = `rotate(${graus}deg)`;
        }
    }

    function abrirAvisoSessao() {
        if (avisoAberto) return;
        garantirModalSessao();
        avisoAberto = true;
        segundosRestantes = 60;
        atualizarVisorRelogio();

        const modal = document.getElementById('modal-sessao-expirando');
        if (modal) modal.classList.add('show');

        if (intervalContagem) clearInterval(intervalContagem);
        intervalContagem = setInterval(() => {
            segundosRestantes -= 1;
            if (segundosRestantes <= 0) {
                segundosRestantes = 0;
                atualizarVisorRelogio();
                encerrarSessaoPorInatividade();
                return;
            }
            atualizarVisorRelogio();
        }, 1000);
    }

    function fecharAvisoSessao() {
        avisoAberto = false;
        if (intervalContagem) {
            clearInterval(intervalContagem);
            intervalContagem = null;
        }
        document.getElementById('modal-sessao-expirando')?.classList.remove('show');
    }

    async function encerrarSessaoPorInatividade() {
        fecharAvisoSessao();
        if (intervalChecagem) clearInterval(intervalChecagem);
        try {
            await window.db.auth.signOut();
        } finally {
            window.location.replace('../index.html');
        }
    }

    function registrarInteracao() {
        if (avisoAberto) return;
        ultimaInteracao = Date.now();
    }

    function iniciarLoopChecagem() {
        if (!eventosRegistrados) {
            eventosRegistrados = true;
            ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'].forEach(evt => {
                document.addEventListener(evt, registrarInteracao, { passive: true });
            });
        }

        ultimaInteracao = Date.now();
        if (intervalChecagem) clearInterval(intervalChecagem);
        intervalChecagem = setInterval(() => {
            if (avisoAberto) return;
            if (Date.now() - ultimaInteracao >= tempoInatividadeMs) {
                abrirAvisoSessao();
            }
        }, 1000);
    }

    window.iniciarMonitorSessao = async function(userId) {
        if (!userId) {
            const { data: { session } } = await window.db.auth.getSession();
            userId = session?.user?.id || null;
        }
        if (!userId) return;

        sessaoUserId = userId;
        await carregarTempoSessao(userId);
        iniciarLoopChecagem();
    };

    window.atualizarMonitorSessao = async function() {
        if (!sessaoUserId) {
            const { data: { session } } = await window.db.auth.getSession();
            sessaoUserId = session?.user?.id || null;
        }
        if (!sessaoUserId) return;

        fecharAvisoSessao();
        await carregarTempoSessao(sessaoUserId);
        iniciarLoopChecagem();
    };
})();

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