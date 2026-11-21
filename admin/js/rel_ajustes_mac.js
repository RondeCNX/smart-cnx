// js/rel_ajustes_mac.js
(async function initModuloRelAjustesMac() {
    console.log("Módulo Relatório de Ajustes de MAC carregado.");
    lucide.createIcons();

    const moduloContent = document.querySelector('#janela-rel_ajustes_mac .modulo-container');
    if (!moduloContent) return;

    // Filtros
    const comboCampo = moduloContent.querySelector('#filtro-campo');
    const wrapperData = moduloContent.querySelector('#wrapper-data-intervalo');
    const inDataIni = moduloContent.querySelector('#filtro-data-ini');
    const inDataFim = moduloContent.querySelector('#filtro-data-fim');
    const wrapperTexto = moduloContent.querySelector('#wrapper-texto');
    const inTexto = moduloContent.querySelector('#filtro-valor-texto');
    const chkExato = moduloContent.querySelector('#filtro-exato');
    const selAlmox = moduloContent.querySelector('#filtro-valor-almox');
    const selStatus = moduloContent.querySelector('#filtro-valor-status');

    const btnAddFiltro = moduloContent.querySelector('#btn-add-filtro');
    const btnAplicarFiltro = moduloContent.querySelector('#btn-aplicar-filtro');
    const btnLimparFiltros = moduloContent.querySelector('#btn-limpar-filtros');
    const btnRefresh = moduloContent.querySelector('#btn-refresh-rel');

    // Tags e Contadores
    const lblTotalAjustes = moduloContent.querySelector('#lbl-total-ajustes');
    const lblTotalMacs = moduloContent.querySelector('#lbl-total-macs');
    const lblFiltrosAtivos = moduloContent.querySelector('#lbl-filtros-ativos');
    const containerTagsInline = moduloContent.querySelector('#container-tags-inline');

    // KPIs
    const kpiAjustes = moduloContent.querySelector('#kpi-mac-ajustes');
    const kpiTotalMacs = moduloContent.querySelector('#kpi-mac-total');
    const kpiConcluidos = moduloContent.querySelector('#kpi-mac-concluidos');
    const kpiPendentes = moduloContent.querySelector('#kpi-mac-pendentes');

    // Exportação
    const btnGerarRelatorio = moduloContent.querySelector('#btn-gerar-relatorio');
    const modalExport = moduloContent.querySelector('#modal-exportar-rel-mac');
    const btnFecharExport = moduloContent.querySelector('#btn-fechar-modal-export');
    const lblQtdModalExport = moduloContent.querySelector('#lbl-qtd-modal-export');
    const lblQtdMacsExport = moduloContent.querySelector('#lbl-qtd-macs-export');
    const btnConfirmarPdf = moduloContent.querySelector('#btn-confirmar-pdf');
    const btnConfirmarExcel = moduloContent.querySelector('#btn-confirmar-excel');

    // Estado
    let usuarioLogadoId = null;
    let nomeUsuarioLogado = '';
    let isAdmin = false;
    let acessoTodos = false;
    let permissoesAcesso = { view: false, export: false };

    let almoxarifadosPermitidos = [];
    let dadosCompletos = [];
    let dadosFiltrados = [];
    let filtrosAtivos = [];

    // ================= PERMISSÕES E CARGA INICIAL =================
    async function carregarPermissoes() {
        try {
            const { data: { session } } = await window.db.auth.getSession();
            if (!session) return false;
            usuarioLogadoId = session.user.id;

            const { data: user } = await window.db
                .from('usuarios')
                .select('nome_completo, acesso_todos_almoxarifados, cargos(nome)')
                .eq('id', usuarioLogadoId)
                .single();

            nomeUsuarioLogado = user?.nome_completo || '';
            const cargoUpper = user?.cargos?.nome?.toUpperCase() || '';
            isAdmin = cargoUpper === 'ADMINISTRADOR';
            acessoTodos = isAdmin || !!user?.acesso_todos_almoxarifados;

            permissoesAcesso = {
                view: window.temPermissao('rel_ajustes_mac', 'view'),
                export: window.temPermissao('rel_ajustes_mac', 'export')
            };

            if (!permissoesAcesso.view) {
                moduloContent.innerHTML = `<div style="text-align: center; padding: 4rem; color: #ef4444;"><i data-lucide="shield-alert" style="width: 48px; height: 48px; margin-bottom: 1rem;"></i><h2 style="font-weight: 800;">Acesso Negado</h2><p>Você não tem permissão para visualizar o Relatório de Ajustes de MAC.</p></div>`;
                lucide.createIcons();
                return false;
            }

            if (!permissoesAcesso.export && btnGerarRelatorio) {
                btnGerarRelatorio.style.display = 'none';
            }

            return true;
        } catch (err) {
            console.error('Erro ao carregar permissões:', err);
            return false;
        }
    }

    async function carregarDados() {
        try {
            const [resAlmox, resVincs] = await Promise.all([
                window.db.from('almoxarifados').select('id, codigo, descricao').eq('status', 'ATIVO'),
                window.db.from('usuario_almoxarifados').select('almoxarifado_id').eq('usuario_id', usuarioLogadoId)
            ]);

            const todosAtivos = (resAlmox.data || []).sort((a, b) =>
                (a.descricao || '').localeCompare(b.descricao || '', 'pt-BR', { sensitivity: 'base' })
            );
            const idsVinc = (resVincs.data || []).map(v => String(v.almoxarifado_id));

            almoxarifadosPermitidos = acessoTodos
                ? todosAtivos
                : todosAtivos.filter(a => idsVinc.includes(String(a.id)));

            selAlmox.innerHTML = '<option value="">Selecione o Almoxarifado...</option>' +
                almoxarifadosPermitidos.map(a => `<option value="${a.id}">${a.codigo} - ${a.descricao}</option>`).join('');

            let query = window.db
                .from('ajustes_estoque')
                .select(`
                    *,
                    usuarios(nome_completo),
                    almoxarifado:almoxarifados(id, codigo, descricao),
                    coletas:coletas_mac(id, mac, numero_serie, produto_patrimonio_erp, status, produtos(codigo, descricao))
                `);

            if (!acessoTodos) {
                const idsPermitidos = almoxarifadosPermitidos.map(a => a.id);
                if (idsPermitidos.length > 0) query = query.in('almoxarifado_id', idsPermitidos);
                else {
                    dadosCompletos = [];
                    aplicarFiltros();
                    return;
                }
            }

            const { data, error } = await query;
            if (error) throw error;

            dadosCompletos = (data || []).map(r => {
                const coletasArr = r.coletas || [];
                const dataRef = r.data_ajuste || r.created_at || r.criado_em || '';

                return {
                    ...r,
                    dataRef,
                    codigoFormatado: r.codigo ? String(r.codigo).padStart(6, '0') : String(r.id || '').slice(0, 8).toUpperCase(),
                    almoxNome: r.almoxarifado ? `${r.almoxarifado.codigo} - ${r.almoxarifado.descricao}` : 'Desconhecido',
                    criadorNome: r.usuarios ? r.usuarios.nome_completo : 'Sistema',
                    statusUpper: String(r.status || 'PENDENTE').toUpperCase(),
                    coletasLista: coletasArr,
                    qtdMacs: coletasArr.length,
                    macsBusca: coletasArr.map(c => c.mac || '').join(' ').toUpperCase(),
                    seriesBusca: coletasArr.map(c => c.numero_serie || '').join(' ').toUpperCase(),
                    patrimoniosBusca: coletasArr.map(c => c.produto_patrimonio_erp || '').join(' ').toUpperCase()
                };
            }).sort((a, b) => new Date(b.dataRef || 0) - new Date(a.dataRef || 0));

            aplicarFiltros();
        } catch (err) {
            console.error('Erro ao carregar dados do relatório de ajustes MAC:', err);
            window.appAlert('Erro', 'Não foi possível carregar os dados de ajustes de MAC.', 'error');
        }
    }

    // ================= LÓGICA DE FILTROS ANINHADOS =================
    function formatarDataBR(dataStr) {
        if (!dataStr) return '-';
        const parte = dataStr.split('T')[0];
        const [ano, mes, dia] = parte.split('-');
        return (ano && mes && dia) ? `${dia}/${mes}/${ano}` : dataStr;
    }

    comboCampo.addEventListener('change', () => {
        const val = comboCampo.value;
        moduloContent.querySelectorAll('.filtro-input-dinamico').forEach(el => el.style.display = 'none');

        if (val === 'criado_em') {
            wrapperData.style.display = 'flex';
            inDataIni.value = '';
            inDataFim.value = '';
        } else if (val === 'almoxarifado_id') {
            selAlmox.style.display = 'block';
        } else if (val === 'status') {
            selStatus.style.display = 'block';
        } else {
            wrapperTexto.style.display = 'flex';
            inTexto.value = '';
            chkExato.checked = false;
        }
    });

    function adicionarFiltro() {
        const campo = comboCampo.value;
        const labelCampo = comboCampo.options[comboCampo.selectedIndex].text.replace(' (Intervalo)', '');
        let valor = null, labelValor = '', exato = false;

        if (campo === 'criado_em') {
            const ini = inDataIni.value;
            const fim = inDataFim.value;
            if (!ini && !fim) return;
            valor = { ini, fim };
            if (ini && fim) labelValor = `${formatarDataBR(ini)} até ${formatarDataBR(fim)}`;
            else if (ini) labelValor = `A partir de ${formatarDataBR(ini)}`;
            else labelValor = `Até ${formatarDataBR(fim)}`;
            exato = true;
            inDataIni.value = '';
            inDataFim.value = '';
        } else if (campo === 'almoxarifado_id') {
            valor = selAlmox.value;
            if (!valor) return;
            labelValor = selAlmox.options[selAlmox.selectedIndex].text;
            exato = true;
        } else if (campo === 'status') {
            valor = selStatus.value;
            labelValor = selStatus.options[selStatus.selectedIndex].text;
            exato = true;
        } else {
            valor = inTexto.value.trim().toUpperCase();
            if (!valor) return;
            labelValor = valor;
            exato = chkExato.checked;
            inTexto.value = '';
        }

        filtrosAtivos.push({ id: Date.now(), campo, labelCampo, valor, labelValor, exato });
        renderizarTagsFiltros();
        aplicarFiltros();
    }

    window.removerFiltroRelMac = function(idFiltro) {
        filtrosAtivos = filtrosAtivos.filter(f => f.id !== idFiltro);
        renderizarTagsFiltros();
        aplicarFiltros();
    };

    function renderizarTagsFiltros() {
        containerTagsInline.style.display = 'flex';
        containerTagsInline.style.gap = '4px';
        containerTagsInline.style.alignItems = 'center';
        containerTagsInline.innerHTML = '';

        if (filtrosAtivos.length === 0) {
            lblFiltrosAtivos.style.display = 'inline';
            return;
        }

        lblFiltrosAtivos.style.display = 'none';

        const firstFiltro = filtrosAtivos[0];
        const isExato = firstFiltro.exato && ['mac', 'numero_serie', 'patrimonio', 'codigo'].includes(firstFiltro.campo) ? ' (Exato)' : '';

        let htmlInline = `
            <div style="background: white; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px; font-size: 0.65rem;">
                <span style="color: #64748b;">${firstFiltro.labelCampo}${isExato}:</span>
                <strong style="color: var(--cnx-blue);">${firstFiltro.labelValor}</strong>
                <button style="background:none; border:none; margin-left: 4px; display:flex; align-items:center;" onclick="window.removerFiltroRelMac(${firstFiltro.id})">
                    <i data-lucide="trash-2" style="width: 12px; height: 12px; color: #ef4444; cursor: pointer;"></i>
                </button>
            </div>
        `;

        if (filtrosAtivos.length > 1) {
            const extraCount = filtrosAtivos.length - 1;
            htmlInline += `
                <div class="dropdown-filters" style="position: relative;">
                    <button id="btn-toggle-filters-drop" style="background: white; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; color: var(--cnx-blue); cursor: pointer; display: flex; align-items: center; gap: 4px;">
                        +${extraCount} <i data-lucide="chevron-down" style="width:12px; height:12px;"></i>
                    </button>
                    <div id="drop-filters-menu" style="display: none; position: absolute; top: 100%; right: 0; margin-top: 4px; background: white; border: 1px solid #cbd5e1; border-radius: 6px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); width: 290px; z-index: 50;">
                        <div style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-radius: 6px 6px 0 0;">
                            <strong style="color: var(--cnx-blue); font-size: 0.75rem;">Filtros Ativos</strong>
                            <button id="btn-close-filters-drop" style="background:none; border:none; cursor:pointer; color:#64748b; display:flex;"><i data-lucide="x" style="width:14px; height:14px;"></i></button>
                        </div>
                        <div style="padding: 8px; display: flex; flex-direction: column; gap: 6px; max-height: 250px; overflow-y: auto;">
            `;

            filtrosAtivos.forEach(f => {
                const fExato = f.exato && ['mac', 'numero_serie', 'patrimonio', 'codigo'].includes(f.campo) ? ' (Exato)' : '';
                htmlInline += `
                    <div style="border: 1px solid #e2e8f0; padding: 6px 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 0.65rem;">
                        <div style="flex:1;">
                            <span style="color: #64748b;">${f.labelCampo}${fExato}:</span>
                            <strong style="color: var(--cnx-blue); margin-left:4px;">${f.labelValor}</strong>
                        </div>
                        <button style="background: #fef2f2; border: none; padding: 4px; border-radius: 4px; cursor: pointer; display: flex; align-items: center;" onclick="window.removerFiltroRelMac(${f.id})">
                            <i data-lucide="trash-2" style="width: 14px; height: 14px; color: #ef4444;"></i>
                        </button>
                    </div>
                `;
            });

            htmlInline += `</div></div></div>`;
        }

        containerTagsInline.innerHTML = htmlInline;
        lucide.createIcons();

        const btnToggle = containerTagsInline.querySelector('#btn-toggle-filters-drop');
        const dropMenu = containerTagsInline.querySelector('#drop-filters-menu');
        const btnClose = containerTagsInline.querySelector('#btn-close-filters-drop');

        if (btnToggle && dropMenu) {
            btnToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                dropMenu.style.display = dropMenu.style.display === 'none' ? 'block' : 'none';
            });
            btnClose.addEventListener('click', (e) => {
                e.stopPropagation();
                dropMenu.style.display = 'none';
            });
            document.addEventListener('click', function closeDrop(e) {
                if (!dropMenu.contains(e.target) && e.target !== btnToggle && !btnToggle.contains(e.target)) {
                    dropMenu.style.display = 'none';
                    document.removeEventListener('click', closeDrop);
                }
            });
        }
    }

    function aplicarFiltros() {
        let lista = [...dadosCompletos];

        const temFiltroAlmoxExplicito = filtrosAtivos.some(f => f.campo === 'almoxarifado_id');
        const selecionadosRodape = Array.isArray(window.almoxarifadosSelecionados) && window.almoxarifadosSelecionados.length > 0
            ? window.almoxarifadosSelecionados.map(String)
            : null;

        if (!temFiltroAlmoxExplicito && selecionadosRodape) {
            lista = lista.filter(r => !r.almoxarifado_id || selecionadosRodape.includes(String(r.almoxarifado_id)));
        }

        filtrosAtivos.forEach(f => {
            lista = lista.filter(item => {
                if (f.campo === 'criado_em') {
                    const dtItem = item.dataRef ? item.dataRef.split('T')[0] : null;
                    if (!dtItem) return false;
                    if (f.valor.ini && dtItem < f.valor.ini) return false;
                    if (f.valor.fim && dtItem > f.valor.fim) return false;
                    return true;
                }
                if (f.campo === 'almoxarifado_id') {
                    return String(item.almoxarifado_id) === String(f.valor);
                }
                if (f.campo === 'status') {
                    return item.statusUpper === String(f.valor).toUpperCase();
                }
                if (f.campo === 'codigo') {
                    const val = item.codigoFormatado;
                    return f.exato ? val === f.valor : val.includes(f.valor);
                }
                if (f.campo === 'mac') {
                    if (f.exato) return item.coletasLista.some(c => String(c.mac || '').toUpperCase() === f.valor);
                    return item.macsBusca.includes(f.valor);
                }
                if (f.campo === 'numero_serie') {
                    if (f.exato) return item.coletasLista.some(c => String(c.numero_serie || '').toUpperCase() === f.valor);
                    return item.seriesBusca.includes(f.valor);
                }
                if (f.campo === 'patrimonio') {
                    if (f.exato) return item.coletasLista.some(c => String(c.produto_patrimonio_erp || '').toUpperCase() === f.valor);
                    return item.patrimoniosBusca.includes(f.valor);
                }
                return true;
            });
        });

        dadosFiltrados = lista;

        const totalMacs = lista.reduce((acc, r) => acc + (r.qtdMacs || 0), 0);
        const totalConcluidos = lista.filter(r => r.statusUpper === 'CONCLUIDO' || r.statusUpper === 'CONCLUÍDO').length;
        const totalPendentes = lista.filter(r => r.statusUpper === 'PENDENTE').length;

        if (lblTotalAjustes) lblTotalAjustes.innerText = lista.length;
        if (lblTotalMacs) lblTotalMacs.innerText = totalMacs;
        if (kpiAjustes) kpiAjustes.innerText = lista.length;
        if (kpiTotalMacs) kpiTotalMacs.innerText = totalMacs;
        if (kpiConcluidos) kpiConcluidos.innerText = totalConcluidos;
        if (kpiPendentes) kpiPendentes.innerText = totalPendentes;
    }

    // Expande cada ajuste em linhas por MAC coletado (ou 1 linha se não houver MAC vinculado)
    function montarLinhasExportacao() {
        const linhas = [];
        dadosFiltrados.forEach(r => {
            if (r.coletasLista.length === 0) {
                linhas.push({
                    codigo: r.codigoFormatado,
                    data: formatarDataBR(r.dataRef),
                    almox: r.almoxNome,
                    produto: '-',
                    mac: '-',
                    serie: '-',
                    patrimonio: '-',
                    status: r.statusUpper,
                    usuario: r.criadorNome,
                    obs: r.observacoes || ''
                });
            } else {
                r.coletasLista.forEach(c => {
                    linhas.push({
                        codigo: r.codigoFormatado,
                        data: formatarDataBR(r.dataRef),
                        almox: r.almoxNome,
                        produto: c.produtos ? `${c.produtos.codigo} - ${c.produtos.descricao}` : '-',
                        mac: c.mac || '-',
                        serie: c.numero_serie || '-',
                        patrimonio: c.produto_patrimonio_erp || '-',
                        status: r.statusUpper,
                        usuario: r.criadorNome,
                        obs: r.observacoes || ''
                    });
                });
            }
        });
        return linhas;
    }

    // ================= EXPORTAÇÃO PDF =================
    async function exportarPDF() {

        if (!permissoesAcesso.export) {
            window.appAlert('Acesso Negado', 'Você não tem permissão para exportar este relatório.', 'error');
            return;
        }

        modalExport.style.display = 'none';
        if (!window.jspdf) {
            window.appAlert('Erro', 'Biblioteca PDF indisponível.', 'error');
            return;
        }

        if (!document.getElementById('pdf-frame-modal')) {
            document.body.insertAdjacentHTML('beforeend', `
                <div class="modal-overlay" id="pdf-frame-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); z-index: 11000; align-items: center; justify-content: center; padding: 1rem;">
                    <div class="modal-box" style="background: white; border-radius: 8px; width: 100%; max-width: 1100px; height: 90vh; display: flex; flex-direction: column; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); overflow: hidden;">
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

        try {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF('l', 'pt', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margemEsq = 35;
            const margemDir = pageWidth - 35;

            try {
                const img = new Image();
                img.src = '../assets/imagens/Logo.png';
                await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
                doc.addImage(img, 'PNG', margemEsq, 22, 42, 42);
            } catch (err) {
                doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(242, 101, 34);
                doc.text("CNX TELECOM", margemEsq, 45);
            }

            doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(0, 43, 91);
            doc.text("CNX TELECOM LTDA", 88, 36);
            doc.setFontSize(8); doc.setTextColor(100, 100, 100); doc.setFont("helvetica", "normal");
            doc.text("Fone: (64) 3404-8181    Email: atendimento@cnx.net.br", 88, 48);
            doc.text("RUA DIVINÓPOLIS - Itumbiara - GO - 75513-150", 88, 60);

            doc.setFontSize(13); doc.setTextColor(242, 101, 34); doc.setFont("helvetica", "bold");
            doc.text("RELATÓRIO DE AJUSTES DE MAC", margemDir, 42, { align: 'right' });

            const resumoFiltros = filtrosAtivos.length > 0
                ? filtrosAtivos.map(f => `${f.labelCampo}: ${f.labelValor}`).join('  |  ')
                : 'Nenhum filtro aplicado';

            const linhasExport = montarLinhasExportacao();
            doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(70, 70, 70);
            doc.text(`Filtros: ${resumoFiltros}   |   Ajustes: ${dadosFiltrados.length}   |   MACs: ${linhasExport.length}`, margemEsq, 82);

            const colunas = [["Ajuste", "Data", "Almoxarifado", "Equipamento", "MAC (GPON)", "Nº Série", "Patrimônio ERP", "Status"]];
            const linhas = linhasExport.map(l => [
                l.codigo,
                l.data,
                l.almox,
                l.produto,
                l.mac,
                l.serie,
                l.patrimonio,
                l.status
            ]);

            doc.autoTable({
                startY: 92,
                head: colunas,
                body: linhas,
                theme: 'grid',
                styles: { fontSize: 7.5, cellPadding: 4, valign: 'middle' },
                headStyles: { fillColor: [0, 43, 91], textColor: [255, 255, 255], fontStyle: 'bold' },
                columnStyles: {
                    0: { cellWidth: 52, halign: 'center' },
                    1: { cellWidth: 58, halign: 'center' },
                    2: { cellWidth: 125 },
                    3: { cellWidth: 'auto' },
                    4: { cellWidth: 95, halign: 'center' },
                    5: { cellWidth: 90, halign: 'center' },
                    6: { cellWidth: 75, halign: 'center' },
                    7: { cellWidth: 65, halign: 'center', fontStyle: 'bold' }
                },
                margin: { left: margemEsq, right: 35, bottom: 35 },
                didDrawPage: () => {
                    const horaAtual = new Date().toLocaleString('pt-BR');
                    doc.setFontSize(7); doc.setTextColor(140, 140, 140); doc.setFont("helvetica", "normal");
                    doc.text(`Emitido em: ${horaAtual} por ${nomeUsuarioLogado}`, margemEsq, pageHeight - 15);
                    doc.text(`Página ${doc.internal.getNumberOfPages()}`, margemDir, pageHeight - 15, { align: 'right' });
                }
            });

            const iframe = document.getElementById('pdf-iframe');
            const frameModal = document.getElementById('pdf-frame-modal');
            if (iframe && frameModal) {
                iframe.src = doc.output('bloburl');
                frameModal.style.display = 'flex';
            }
        } catch (err) {
            console.error('Erro ao gerar PDF:', err);
            window.appAlert('Erro', 'Não foi possível gerar o PDF do relatório.', 'error');
        }
    }

    // ================= EXPORTAÇÃO EXCEL (CSV) =================
    function exportarCSV() {

        if (!permissoesAcesso.export) {
            window.appAlert('Acesso Negado', 'Você não tem permissão para exportar este relatório.', 'error');
            return;
        }

        modalExport.style.display = 'none';

        const cabecalho = ['Código Ajuste', 'Data', 'Almoxarifado', 'Equipamento', 'MAC (GPON)', 'Nº de Série', 'Patrimônio ERP', 'Status', 'Responsável Registro', 'Observações'];
        const escapar = (val) => `"${String(val || '').replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;

        const linhasExport = montarLinhasExportacao();
        const linhas = linhasExport.map(l => [
            l.codigo,
            l.data,
            l.almox,
            l.produto,
            l.mac,
            l.serie,
            l.patrimonio,
            l.status,
            l.usuario,
            l.obs
        ].map(escapar).join(';'));

        const csvContent = '\uFEFF' + [cabecalho.join(';'), ...linhas].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `relatorio_ajustes_mac_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    // ================= EVENTOS =================
    btnAddFiltro.addEventListener('click', adicionarFiltro);
    btnAplicarFiltro.addEventListener('click', adicionarFiltro);
    inTexto.addEventListener('keypress', (e) => { if (e.key === 'Enter') adicionarFiltro(); });

    btnLimparFiltros.addEventListener('click', () => {
        filtrosAtivos = [];
        inDataIni.value = '';
        inDataFim.value = '';
        inTexto.value = '';
        renderizarTagsFiltros();
        aplicarFiltros();
    });

    btnRefresh.addEventListener('click', () => {
        const icon = btnRefresh.querySelector('.refresh-icon');
        if (icon) icon.classList.add('lucide-spin');
        carregarDados().finally(() => { if (icon) icon.classList.remove('lucide-spin'); });
    });

    btnGerarRelatorio.addEventListener('click', () => {
        if (!permissoesAcesso.export) {
            window.appAlert('Acesso Negado', 'Você não tem permissão para exportar este relatório.', 'error');
            return;
        }
        if (dadosFiltrados.length === 0) {
            window.appAlert('Atenção', 'Nenhum ajuste encontrado para os filtros aplicados.', 'warning');
            return;
        }
        const totalMacs = dadosFiltrados.reduce((acc, r) => acc + (r.qtdMacs || 0), 0);
        if (lblQtdModalExport) lblQtdModalExport.innerText = dadosFiltrados.length;
        if (lblQtdMacsExport) lblQtdMacsExport.innerText = totalMacs;
        modalExport.style.display = 'flex';
        lucide.createIcons();
    });

    btnFecharExport.addEventListener('click', () => { modalExport.style.display = 'none'; });
    btnConfirmarPdf.addEventListener('click', exportarPDF);
    btnConfirmarExcel.addEventListener('click', exportarCSV);

    window.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;

        const pdfModal = document.getElementById('pdf-frame-modal');
        if (pdfModal && pdfModal.style.display !== 'none') {
            e.preventDefault();
            e.stopPropagation();
            pdfModal.style.display = 'none';
            return;
        }

        if (modalExport && modalExport.style.display !== 'none') {
            e.preventDefault();
            e.stopPropagation();
            modalExport.style.display = 'none';
        }
    }, true);

    document.addEventListener('filtroAlmoxarifadosAlterado', aplicarFiltros);

    // Inicia o módulo
    const autorizado = await carregarPermissoes();
    if (autorizado) {
        await carregarDados();
    }
})();