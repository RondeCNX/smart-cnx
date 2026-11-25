// admin/js/rel_requisicoes.js
(async function initRelatorioRequisicoes() {
    lucide.createIcons();

    const moduloContent = document.querySelector('#janela-rel_requisicoes .modulo-container');
    if (!moduloContent) return;

    // Filtros
    const comboCampo = moduloContent.querySelector('#filtro-campo');
    const wrapperPeriodo = moduloContent.querySelector('#wrapper-periodo');
    const inDataIni = moduloContent.querySelector('#filtro-data-ini');
    const inDataFim = moduloContent.querySelector('#filtro-data-fim');
    const wrapperTexto = moduloContent.querySelector('#wrapper-texto');
    const inputTexto = moduloContent.querySelector('#filtro-valor-texto');
    const chkExato = moduloContent.querySelector('#filtro-exato');
    const inputStatus = moduloContent.querySelector('#filtro-valor-status');
    const inputDivergencia = moduloContent.querySelector('#filtro-valor-divergencia');

    const btnAddFiltro = moduloContent.querySelector('#btn-add-filtro');
    const btnAplicarFiltro = moduloContent.querySelector('#btn-aplicar-filtro');
    const btnLimparFiltros = moduloContent.querySelector('#btn-limpar-filtros');
    const btnRefresh = moduloContent.querySelector('#btn-refresh-rel-req');
    const btnsAgrupamento = moduloContent.querySelectorAll('.btn-agrupamento-rel-req');

    // KPIs e Status
    const lblTotalReqs = moduloContent.querySelector('#lbl-total-reqs');
    const lblTotalItens = moduloContent.querySelector('#lbl-total-itens');
    const kpiTotal = moduloContent.querySelector('#kpi-rel-req-total');
    const kpiItens = moduloContent.querySelector('#kpi-rel-req-itens');
    const kpiQtd = moduloContent.querySelector('#kpi-rel-req-qtd');
    const kpiDiv = moduloContent.querySelector('#kpi-rel-req-div');

    // Modal Exportação
    const btnAbrirExport = moduloContent.querySelector('#btn-abrir-export-rel-req');
    const modalExport = moduloContent.querySelector('#modal-export-rel-req');
    const btnFecharExport = moduloContent.querySelector('#btn-fechar-export-rel-req');
    const btnExportPdf = moduloContent.querySelector('#btn-export-pdf-rel-req');
    const btnExportCsv = moduloContent.querySelector('#btn-export-csv-rel-req');

    let permissoesAcesso = { view: false, export: false };
    let usuarioLogadoId = null;
    let nomeUsuarioLogado = '';
    let isGestor = false;
    let meusAlmoxIds = [];
    let linhasBase = [];
    let linhasFiltradas = [];
    let filtrosAtivos = [];
    let agrupamentoAtual = 'nenhum'; // 'nenhum' | 'requisitante' | 'produto'

    const fmtCod = (cod) => {
        if (typeof window.fmtCod === 'function') return window.fmtCod(cod);
        if (cod === null || cod === undefined || cod === '') return '-';
        const str = String(cod).trim();
        return /^\d+$/.test(str) ? str.padStart(6, '0') : str;
    };

    const extrairNomeOrdenacao = (texto) => {
        const s = String(texto || '').trim();
        const idx = s.indexOf(' - ');
        return idx !== -1 ? s.slice(idx + 3).trim() : s;
    };

    const cmpAlfa = (a, b) => extrairNomeOrdenacao(a).localeCompare(extrairNomeOrdenacao(b), 'pt-BR', { sensitivity: 'base', numeric: true });

    function obterLinhasOrdenadas() {
        const lista = [...linhasFiltradas];
        if (agrupamentoAtual === 'requisitante') {
            lista.sort((a, b) =>
                cmpAlfa(a.destino, b.destino) ||
                cmpAlfa(a.produto, b.produto) ||
                String(b.codigo).localeCompare(String(a.codigo))
            );
        } else if (agrupamentoAtual === 'produto') {
            lista.sort((a, b) =>
                cmpAlfa(a.produto, b.produto) ||
                cmpAlfa(a.destino, b.destino) ||
                String(b.codigo).localeCompare(String(a.codigo))
            );
        }
        return lista;
    }

    function obterLabelAgrupamento() {
        if (agrupamentoAtual === 'requisitante') return 'Por Requisitante (A–Z)';
        if (agrupamentoAtual === 'produto') return 'Por Produto (A–Z)';
        return 'Sem Agrupamento';
    }

    btnsAgrupamento.forEach(btn => {
        btn.addEventListener('click', () => {
            agrupamentoAtual = btn.dataset.grupo || 'nenhum';
            btnsAgrupamento.forEach(b => {
                const ativo = b === btn;
                b.classList.toggle('active', ativo);
                b.style.background = ativo ? 'var(--cnx-blue)' : '#f8fafc';
                b.style.color = ativo ? 'white' : '#475569';
                b.style.borderColor = ativo ? 'var(--cnx-blue)' : '#cbd5e1';
            });
        });
    });

    // ================= CARGA DE DADOS =================
    async function inicializar() {
        try {
            const { data: { session } } = await window.db.auth.getSession();
            if (!session) return;
            usuarioLogadoId = session.user.id;

            const { data: user } = await window.db.from('usuarios')
                .select('nome_completo, acesso_todos_almoxarifados, cargos(nome)')
                .eq('id', usuarioLogadoId).single();

            nomeUsuarioLogado = user?.nome_completo || 'Usuário';
            const cargo = user?.cargos?.nome?.toUpperCase() || '';
            const isAdmin = cargo === 'ADMINISTRADOR';
            isGestor = isAdmin || cargo.includes('SUPERVISOR') || !!user?.acesso_todos_almoxarifados;

            permissoesAcesso = {
                view: isAdmin || (typeof window.temPermissao === 'function' && window.temPermissao('rel_requisicoes', 'view')),
                export: isAdmin || (typeof window.temPermissao === 'function' && window.temPermissao('rel_requisicoes', 'export'))
            };

            if (!permissoesAcesso.view) {
                moduloContent.innerHTML = `<div style="text-align: center; padding: 4rem; color: #ef4444;"><i data-lucide="shield-alert" style="width: 48px; height: 48px; margin-bottom: 1rem;"></i><h2 style="font-weight: 800;">Acesso Negado</h2><p>Você não tem permissão para visualizar o Relatório de Requisições.</p></div>`;
                lucide.createIcons();
                return;
            }

            if (btnAbrirExport) {
                btnAbrirExport.style.display = permissoesAcesso.export ? 'flex' : 'none';
            }

            const { data: vincs } = await window.db.from('usuario_almoxarifados')
                .select('almoxarifado_id').eq('usuario_id', usuarioLogadoId);
            meusAlmoxIds = (vincs || []).map(v => v.almoxarifado_id);

            await carregarBase();
        } catch (e) {
            console.error('Erro ao iniciar relatório de requisições:', e);
        }
    }

    async function carregarBase() {
        let query = window.db.from('requisicoes')
            .select(`
                id, codigo, criado_em, status, numero_pedido,
                almoxarifado_requisitante_id, almoxarifado_abastecedor_id, usuario_solicitante_id,
                almoxarifado_requisitante_snapshot, almoxarifado_abastecedor_snapshot,
                requisitante:almoxarifados!almoxarifado_requisitante_id(codigo, descricao),
                abastecedor:almoxarifados!almoxarifado_abastecedor_id(codigo, descricao),
                user_solic:usuarios!usuario_solicitante_id(nome_completo),
                itens:requisicao_itens(
                    id, produto_id, produto_snapshot, qtd_solicitada, qtd_aprovada, qtd_enviada, qtd_recebida,
                    produtos(codigo, descricao)
                )
            `)
            .order('codigo', { ascending: false });

        if (!isGestor) {
            if (meusAlmoxIds.length > 0) {
                const idsFmt = meusAlmoxIds.join(',');
                query = query.or(`almoxarifado_requisitante_id.in.(${idsFmt}),almoxarifado_abastecedor_id.in.(${idsFmt})`);
            } else {
                linhasBase = [];
                aplicarFiltros();
                return;
            }
        }

        const { data, error } = await query;
        if (error) {
            console.error(error);
            window.appAlert('Erro', 'Falha ao consultar requisições.', 'error');
            return;
        }

        linhasBase = [];
        (data || []).forEach(r => {
            const codigoFmt = String(r.codigo).padStart(6, '0');
            const dataIso = r.criado_em ? r.criado_em.split('T')[0] : '';
            const dataBr = r.criado_em ? new Date(r.criado_em).toLocaleDateString('pt-BR') : '-';
            const origem = r.almoxarifado_abastecedor_snapshot || (r.abastecedor ? `${fmtCod(r.abastecedor.codigo)} - ${r.abastecedor.descricao}` : '-');
            const destino = r.almoxarifado_requisitante_snapshot || (r.requisitante ? `${fmtCod(r.requisitante.codigo)} - ${r.requisitante.descricao}` : '-');
            const solicitante = r.user_solic ? r.user_solic.nome_completo : '-';
            const itens = r.itens && r.itens.length > 0 ? r.itens : [null];

            itens.forEach(item => {
                const prodCod = item?.produtos?.codigo ? fmtCod(item.produtos.codigo) : '';
                const prodDesc = item?.produtos?.descricao || '-';
                const produtoCompleto = item?.produto_snapshot || (prodCod ? `${prodCod} - ${prodDesc}` : prodDesc);
                const qtdSolic = item?.qtd_solicitada ?? 0;
                const qtdEnv = item?.qtd_enviada ?? item?.qtd_aprovada ?? null;
                const qtdRec = item?.qtd_recebida ?? null;
                const temDivergencia = (qtdEnv !== null && qtdRec !== null && Number(qtdEnv) !== Number(qtdRec));
                const dif = temDivergencia ? (Number(qtdRec) - Number(qtdEnv)) : 0;

                linhasBase.push({
                    reqId: r.id,
                    codigo: codigoFmt,
                    dataIso,
                    dataBr,
                    solicitante,
                    origem,
                    destino,
                    produto: produtoCompleto,
                    qtdSolic,
                    qtdEnv,
                    qtdRec,
                    temDivergencia,
                    dif,
                    status: r.status
                });
            });
        });

        aplicarFiltros();
    }

    // ================= FILTROS DINÂMICOS =================
    comboCampo.addEventListener('change', () => {
        const val = comboCampo.value;
        moduloContent.querySelectorAll('.filtro-input-dinamico').forEach(el => el.style.display = 'none');
        if (val === 'periodo') {
            wrapperPeriodo.style.display = 'flex';
        } else if (val === 'status') {
            inputStatus.style.display = 'block';
        } else if (val === 'divergencia') {
            inputDivergencia.style.display = 'block';
        } else {
            wrapperTexto.style.display = 'flex';
            inputTexto.value = '';
            chkExato.checked = false;
            inputTexto.focus();
        }
    });

    function adicionarFiltro() {
        const campo = comboCampo.value;
        const labelCampo = comboCampo.options[comboCampo.selectedIndex].text;
        let valor = '', labelValor = '', exato = false;

        if (campo === 'periodo') {
            const ini = inDataIni.value;
            const fim = inDataFim.value;
            if (!ini && !fim) return;
            const iniBr = ini ? new Date(ini + 'T12:00:00').toLocaleDateString('pt-BR') : '...';
            const fimBr = fim ? new Date(fim + 'T12:00:00').toLocaleDateString('pt-BR') : '...';
            valor = { ini, fim };
            labelValor = `${iniBr} até ${fimBr}`;
            exato = true;
            filtrosAtivos = filtrosAtivos.filter(f => f.campo !== 'periodo');
            inDataIni.value = '';
            inDataFim.value = '';
        } else if (campo === 'status') {
            valor = inputStatus.value;
            labelValor = inputStatus.options[inputStatus.selectedIndex].text;
            exato = true;
        } else if (campo === 'divergencia') {
            valor = inputDivergencia.value;
            labelValor = inputDivergencia.options[inputDivergencia.selectedIndex].text;
            exato = true;
            filtrosAtivos = filtrosAtivos.filter(f => f.campo !== 'divergencia');
        } else {
            valor = inputTexto.value.trim().toUpperCase();
            if (!valor) return;
            labelValor = valor;
            exato = chkExato.checked;
            inputTexto.value = '';
        }

        filtrosAtivos.push({ id: Date.now(), campo, labelCampo, valor, labelValor, exato });
        renderizarTagsFiltros();
        aplicarFiltros();
    }

    window.removerFiltroRelReq = function(idFiltro) {
        filtrosAtivos = filtrosAtivos.filter(f => f.id !== idFiltro);
        renderizarTagsFiltros();
        aplicarFiltros();
    };

    function renderizarTagsFiltros() {
        const containerTagsInline = moduloContent.querySelector('#container-tags-inline');
        const lblFiltrosAtivos = moduloContent.querySelector('#lbl-filtros-ativos');

        containerTagsInline.innerHTML = '';
        if (filtrosAtivos.length === 0) {
            lblFiltrosAtivos.style.display = 'inline';
            return;
        }
        lblFiltrosAtivos.style.display = 'none';

        const firstFiltro = filtrosAtivos[0];
        const isExato = firstFiltro.exato && !['periodo', 'status', 'divergencia'].includes(firstFiltro.campo) ? ' (Exato)' : '';
        let htmlInline = `
            <div style="background: white; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px; font-size: 0.65rem;">
                <span style="color: #64748b;">${firstFiltro.labelCampo}${isExato}:</span><strong style="color: var(--cnx-blue);">${firstFiltro.labelValor}</strong>
                <button style="background:none; border:none; margin-left: 4px; display:flex; align-items:center;" onclick="window.removerFiltroRelReq(${firstFiltro.id})">
                    <i data-lucide="trash-2" style="width: 12px; height: 12px; color: #ef4444; cursor: pointer;"></i>
                </button>
            </div>
        `;

        if (filtrosAtivos.length > 1) {
            const extraCount = filtrosAtivos.length - 1;
            htmlInline += `
                <div class="dropdown-filters" style="position: relative;">
                    <button id="btn-toggle-filters-drop-rel-req" style="background: white; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; color: var(--cnx-blue); cursor: pointer; display: flex; align-items: center; gap: 4px;">
                        +${extraCount} <i data-lucide="chevron-down" style="width:12px; height:12px;"></i>
                    </button>
                    <div id="drop-filters-menu-rel-req" style="display: none; position: absolute; top: 100%; right: 0; margin-top: 4px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); width: 300px; z-index: 50;">
                        <div style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-radius: 6px 6px 0 0;">
                            <strong style="color: var(--cnx-blue); font-size: 0.75rem;">Filtros Ativos</strong>
                            <button id="btn-close-filters-drop-rel-req" style="background:none; border:none; cursor:pointer; color:#64748b; display:flex;"><i data-lucide="x" style="width:14px; height:14px;"></i></button>
                        </div>
                        <div style="padding: 8px; display: flex; flex-direction: column; gap: 6px; max-height: 250px; overflow-y: auto;">
            `;
            filtrosAtivos.forEach(f => {
                const fExato = f.exato && !['periodo', 'status', 'divergencia'].includes(f.campo) ? ' (Exato)' : '';
                htmlInline += `
                    <div style="border: 1px solid #e2e8f0; padding: 6px 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem;">
                        <div style="flex:1;"><span style="color: #64748b;">${f.labelCampo}${fExato}:</span> <strong style="color: var(--cnx-blue); margin-left:4px;">${f.labelValor}</strong></div>
                        <button style="background: #fef2f2; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" onclick="window.removerFiltroRelReq(${f.id})">
                            <i data-lucide="trash-2" style="width: 14px; height: 14px; color: #ef4444;"></i>
                        </button>
                    </div>`;
            });
            htmlInline += `</div></div></div>`;
        }

        containerTagsInline.innerHTML = htmlInline;
        lucide.createIcons();

        const btnToggle = containerTagsInline.querySelector('#btn-toggle-filters-drop-rel-req');
        const dropMenu = containerTagsInline.querySelector('#drop-filters-menu-rel-req');
        const btnClose = containerTagsInline.querySelector('#btn-close-filters-drop-rel-req');
        if (btnToggle && dropMenu) {
            btnToggle.addEventListener('click', (e) => { e.stopPropagation(); dropMenu.style.display = dropMenu.style.display === 'none' ? 'block' : 'none'; });
            btnClose.addEventListener('click', (e) => { e.stopPropagation(); dropMenu.style.display = 'none'; });
            document.addEventListener('click', function closeDrop(e) {
                if (!dropMenu.contains(e.target) && e.target !== btnToggle && !btnToggle.contains(e.target)) {
                    dropMenu.style.display = 'none';
                    document.removeEventListener('click', closeDrop);
                }
            });
        }
    }

    function aplicarFiltros() {
        linhasFiltradas = linhasBase.filter(l => {
            return filtrosAtivos.every(f => {
                if (f.campo === 'periodo') {
                    if (f.valor.ini && l.dataIso < f.valor.ini) return false;
                    if (f.valor.fim && l.dataIso > f.valor.fim) return false;
                    return true;
                }
                if (f.campo === 'status') return String(l.status) === f.valor;
                if (f.campo === 'divergencia') return f.valor === 'COM' ? l.temDivergencia : !l.temDivergencia;
                const v = String(l[f.campo] || '').toUpperCase();
                return f.exato ? v === f.valor : v.includes(f.valor);
            });
        });

        const reqsUnicas = new Set(linhasFiltradas.map(l => l.reqId)).size;
        const somaEnv = linhasFiltradas.reduce((acc, l) => acc + (Number(l.qtdEnv) || 0), 0);
        const totalDiv = linhasFiltradas.filter(l => l.temDivergencia).length;

        lblTotalReqs.innerText = reqsUnicas;
        lblTotalItens.innerText = linhasFiltradas.length;
        kpiTotal.innerText = reqsUnicas;
        kpiItens.innerText = linhasFiltradas.length;
        kpiQtd.innerText = somaEnv;
        kpiDiv.innerText = totalDiv;
    }

    // ================= EXPORTAÇÕES =================
    function exportarCSV() {
        if (!permissoesAcesso.export) {
            window.appAlert('Acesso Negado', 'Você não tem permissão para exportar este relatório.', 'error');
            return;
        }

        modalExport.style.display = 'none';
        if (linhasFiltradas.length === 0) {
            window.appAlert('Atenção', 'Não há dados para exportar com os filtros atuais.', 'warning');
            return;
        }

        const linhasOrdenadas = obterLinhasOrdenadas();
        const headers = ['Req', 'Data', 'Quem Pediu', 'Origem', 'Destino', 'Produto', 'Qtd Solicitada', 'Qtd Enviada', 'Qtd Recebida', 'Divergencia', 'Status'];
        const rows = linhasOrdenadas.map(l => [
            l.codigo, l.dataBr, l.solicitante, l.origem, l.destino, l.produto,
            l.qtdSolic, l.qtdEnv ?? '', l.qtdRec ?? '', l.temDivergencia ? l.dif : '0', l.status
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'));

        const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        const sufixoGrupo = agrupamentoAtual !== 'nenhum' ? `_por_${agrupamentoAtual}` : '';
        link.download = `relatorio_requisicoes${sufixoGrupo}_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    }

    async function exportarPDF() {
        if (!permissoesAcesso.export) {
            window.appAlert('Acesso Negado', 'Você não tem permissão para exportar este relatório.', 'error');
            return;
        }

        modalExport.style.display = 'none';
        if (!window.jspdf) { window.appAlert('Erro', 'Biblioteca PDF indisponível.', 'error'); return; }
        if (linhasFiltradas.length === 0) { window.appAlert('Atenção', 'Não há dados para gerar o PDF.', 'warning'); return; }

        if (!document.getElementById('pdf-frame-modal')) {
            document.body.insertAdjacentHTML('beforeend', `
                <div class="modal-overlay" id="pdf-frame-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); z-index: 11000; align-items: center; justify-content: center; padding: 1rem;">
                    <div class="modal-box" style="background: white; border-radius: 8px; width: 100%; max-width: 1100px; height: 90vh; display: flex; flex-direction: column; overflow: hidden;">
                        <div style="background: #334155; padding: 0.8rem 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="margin: 0; color: white; font-size: 1rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
                                <i data-lucide="file-text" style="color: #cbd5e1; width: 18px;"></i> Visualizador de Documento
                            </h3>
                            <button onclick="document.getElementById('pdf-frame-modal').style.display='none'" style="background: none; border: none; color: white; cursor: pointer;"><i data-lucide="x"></i></button>
                        </div>
                        <iframe id="pdf-iframe" style="flex: 1; width: 100%; border: none; background: #e2e8f0;"></iframe>
                    </div>
                </div>
            `);
            lucide.createIcons();
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('l', 'pt', 'a4');
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margemEsq = 40;

        try {
            const img = new Image();
            img.src = '../assets/imagens/Logo.png';
            await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
            doc.addImage(img, 'PNG', margemEsq, 20, 42, 42);
        } catch (err) {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(242, 101, 34);
            doc.text('CNX', margemEsq, 45); doc.setTextColor(0, 43, 91); doc.text('TELECOM', 75, 45);
        }

        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(0, 43, 91);
        doc.text('CNX TELECOM LTDA', 95, 34);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 100, 100);
        doc.text('Fone: (64) 3404-8181    Email: atendimento@cnx.net.br', 95, 46);
        doc.text('RUA DIVINÓPOLIS - Itumbiara - GO - 75513-150', 95, 58);

        doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(242, 101, 34);
        doc.text('RELATÓRIO DE REQUISIÇÕES DE MATERIAIS', pageWidth / 2, 85, { align: 'center' });

        const resumoFiltros = filtrosAtivos.length > 0
            ? filtrosAtivos.map(f => `${f.labelCampo}: ${f.labelValor}`).join(' | ')
            : 'Todos os registros';
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(70, 70, 70);
        doc.text(`Filtros: ${resumoFiltros}`, margemEsq, 103, { maxWidth: pageWidth - 80 });
        doc.text(`Agrupamento: ${obterLabelAgrupamento()}  |  Requisições: ${kpiTotal.innerText}  |  Itens: ${kpiItens.innerText}  |  Qtd. Enviada: ${kpiQtd.innerText}  |  Divergências: ${kpiDiv.innerText}`, margemEsq, 116);

        const linhasOrdenadas = obterLinhasOrdenadas();
        const montarLinhaTabela = (l) => [
            l.codigo, l.dataBr, l.solicitante, l.origem, l.destino, l.produto,
            l.qtdSolic, l.qtdEnv ?? '-', l.qtdRec ?? '-', l.temDivergencia ? (l.dif > 0 ? `+${l.dif}` : l.dif) : '-', l.status
        ];

        let body = [];

        if (agrupamentoAtual === 'nenhum') {
            body = linhasOrdenadas.map(montarLinhaTabela);
        } else {
            const campoGrupo = agrupamentoAtual === 'requisitante' ? 'destino' : 'produto';
            const rotuloGrupo = agrupamentoAtual === 'requisitante' ? 'REQUISITANTE' : 'PRODUTO';
            const gruposMap = new Map();

            linhasOrdenadas.forEach(l => {
                const chave = l[campoGrupo] || '-';
                if (!gruposMap.has(chave)) gruposMap.set(chave, []);
                gruposMap.get(chave).push(l);
            });

            const chavesOrdenadas = Array.from(gruposMap.keys()).sort(cmpAlfa);

            chavesOrdenadas.forEach(chave => {
                const itensGrupo = gruposMap.get(chave);
                const somaSolic = itensGrupo.reduce((acc, i) => acc + (Number(i.qtdSolic) || 0), 0);
                const somaEnv = itensGrupo.reduce((acc, i) => acc + (Number(i.qtdEnv) || 0), 0);
                const somaRec = itensGrupo.reduce((acc, i) => acc + (Number(i.qtdRec) || 0), 0);

                body.push([{
                    content: `${rotuloGrupo}: ${chave}   (${itensGrupo.length} ${itensGrupo.length === 1 ? 'item' : 'itens'}  |  Solic.: ${somaSolic}  |  Env.: ${somaEnv}  |  Rec.: ${somaRec})`,
                    colSpan: 11,
                    styles: {
                        fillColor: [241, 245, 249],
                        textColor: [0, 43, 91],
                        fontStyle: 'bold',
                        fontSize: 7.5,
                        cellPadding: 5
                    }
                }]);

                itensGrupo.forEach(l => body.push(montarLinhaTabela(l)));
            });
        }

        const horaAtual = new Date().toLocaleString('pt-BR');

        doc.autoTable({
            startY: 126,
            head: [['Req', 'Data', 'Quem Pediu', 'Origem', 'Destino', 'Produto', 'Solic.', 'Env.', 'Rec.', 'Div.', 'Status']],
            body,
            theme: 'grid',
            styles: { fontSize: 7, cellPadding: 4 },
            headStyles: { fillColor: [0, 43, 91], textColor: [255, 255, 255], fontStyle: 'bold' },
            columnStyles: {
                0: { cellWidth: 46 },
                1: { cellWidth: 50 },
                6: { cellWidth: 34, halign: 'center' },
                7: { cellWidth: 34, halign: 'center' },
                8: { cellWidth: 34, halign: 'center' },
                9: { cellWidth: 32, halign: 'center' },
                10: { cellWidth: 62, halign: 'center' }
            },
            margin: { bottom: 35 },
            didDrawPage: (data) => {
                doc.setFontSize(7); doc.setTextColor(150, 150, 150); doc.setFont('helvetica', 'normal');
                doc.text(`Impresso em: ${horaAtual} por ${nomeUsuarioLogado}`, margemEsq, pageHeight - 15);
                doc.text(`Página ${data.pageNumber}`, pageWidth - 40, pageHeight - 15, { align: 'right' });
            }
        });

        document.getElementById('pdf-iframe').src = doc.output('bloburl');
        document.getElementById('pdf-frame-modal').style.display = 'flex';
    }

    // ================= EVENTOS =================
    btnAddFiltro.addEventListener('click', adicionarFiltro);
    btnAplicarFiltro.addEventListener('click', adicionarFiltro);
    inputTexto.addEventListener('keypress', e => { if (e.key === 'Enter') adicionarFiltro(); });
    btnLimparFiltros.addEventListener('click', () => {
        filtrosAtivos = [];
        inDataIni.value = ''; inDataFim.value = ''; inputTexto.value = '';
        renderizarTagsFiltros();
        aplicarFiltros();
    });
    btnRefresh.addEventListener('click', async () => {
        const icon = btnRefresh.querySelector('.refresh-icon');
        icon.classList.add('lucide-spin');
        await carregarBase();
        icon.classList.remove('lucide-spin');
    });

    if (btnAbrirExport) {
        btnAbrirExport.addEventListener('click', () => {
            if (!permissoesAcesso.export) {
                window.appAlert('Acesso Negado', 'Você não tem permissão para exportar este relatório.', 'error');
                return;
            }
            modalExport.style.display = 'flex';
            lucide.createIcons();
        });
    }
    btnFecharExport.addEventListener('click', () => { modalExport.style.display = 'none'; });
    btnExportPdf.addEventListener('click', exportarPDF);
    btnExportCsv.addEventListener('click', exportarCSV);

    inicializar();
})();