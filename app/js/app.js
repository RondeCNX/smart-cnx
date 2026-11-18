document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();

    // 1. VERIFICAÇÃO DE SESSÃO
    try {
        const { data: { session }, error } = await window.db.auth.getSession();
        if (error || !session) {
            window.location.replace('../index.html');
            return;
        }

        // 2. CARREGAR DADOS DO OPERADOR
        carregarPerfilMobile(session.user.id);

        // 3. CARREGAR TELA INICIAL MOBILE
        navegarApp('home', document.querySelector('.nav-item.active'));

    } catch (err) {
        console.error("Erro Crítico Mobile:", err);
        window.location.replace('../index.html');
    }
});

// Carrega o Avatar no Header Mobile
async function carregarPerfilMobile(userId) {
    try {
        const { data: userInfo } = await window.db
            .from('usuarios')
            .select('avatar_url')
            .eq('id', userId)
            .single();
            
        if (userInfo && userInfo.avatar_url) {
            const avatarContainer = document.getElementById('mobile-avatar');
            avatarContainer.innerHTML = `<img src="${userInfo.avatar_url}" alt="Avatar">`;
        }
    } catch (err) {
        console.error("Erro ao carregar perfil mobile:", err);
    }
}

// Logout
async function fazerLogout() {
    if(confirm("Deseja encerrar a sua sessão?")) {
        await window.db.auth.signOut();
        window.location.replace('../index.html');
    }
}

// ================= ROUTER MOBILE (SPA Moteur) =================
const appContent = document.getElementById('app-content');

async function navegarApp(rota, elementoAtivo = null) {
    // Atualiza a Bottom Navigation Bar
    if (elementoAtivo) {
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        elementoAtivo.classList.add('active');
    }

    // Exibe Loader
    appContent.innerHTML = `
        <div class="loader-inicial">
            <i data-lucide="loader-2" class="lucide-spin" style="width: 32px; height: 32px; color: var(--cnx-orange);"></i>
            A carregar...
        </div>
    `;
    lucide.createIcons();

    try {
        // As telas mobile ficarão na pasta pages_app/ na raiz para separar do desktop
        // ou podemos usar a mesma pasta pages/ (ex: pages/mobile_home.html)
        // Vamos usar a mesma pasta 'pages' mas com prefixo 'app_'
        const response = await fetch(`../pages/app_${rota}.html`);
        
        if (!response.ok) {
            // Se a tela ainda não existir (desenvolvimento)
            appContent.innerHTML = `
                <div style="text-align: center; margin-top: 3rem; color: #64748b;">
                    <i data-lucide="wrench" style="width: 48px; height: 48px; color: #cbd5e1; margin-bottom: 1rem;"></i>
                    <h3>Módulo em Desenvolvimento</h3>
                    <p style="font-size: 0.85rem; margin-top: 0.5rem;">A tela '${rota}' estará disponível em breve.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }
        
        const html = await response.text();
        appContent.innerHTML = html;
        lucide.createIcons();

        // Executa o JS correspondente à página
        const scriptId = `script-app-${rota}`;
        const scriptAntigo = document.getElementById(scriptId);
        if (scriptAntigo) scriptAntigo.remove();

        const scriptTag = document.createElement('script');
        scriptTag.id = scriptId;
        scriptTag.src = `../js/app_${rota}.js?v=${Date.now()}`; 
        document.body.appendChild(scriptTag);

    } catch (error) {
        console.error("Erro ao navegar no app:", error);
    }
}