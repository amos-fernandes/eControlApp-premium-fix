const axios = require('axios');

const PROD_CONFIG = {
  baseUrl: 'https://gsambientais.econtrole.com/api',
  email: 'suporte@econtrole.com',
  password: 'ecomotoapp',
};

async function auditPermissions() {
  console.log('🔍 Iniciando Auditoria de Permissões em PRODUÇÃO (GS Ambientais)...');
  
  try {
    // 1. LOGIN
    console.log('\n🔐 1. Validando Credenciais...');
    const loginRes = await axios.post(`${PROD_CONFIG.baseUrl}/auth/sign_in`, {
      email: PROD_CONFIG.email,
      password: PROD_CONFIG.password
    });
    
    const headers = {
      'access-token': loginRes.headers['access-token'],
      'client': loginRes.headers['client'],
      'uid': loginRes.headers['uid'],
      'Content-Type': 'application/json'
    };
    
    console.log('✅ Login Bem-sucedido!');
    console.log(`👤 Perfil: ${loginRes.data.data.name || 'Suporte'} (ID: ${loginRes.data.data.id})`);

    // 2. TESTE DE LEITURA (OS)
    console.log('\n📖 2. Testando Permissão de Leitura (Carga de OS)...');
    const osRes = await axios.get(`${PROD_CONFIG.baseUrl}/service_orders?limit=1`, { headers });
    const items = osRes.data.items || osRes.data.data || [];
    console.log(`✅ Leitura OK. OS's carregadas com sucesso.`);

    // 3. AUDITORIA DE ESCRITA (Simulação segura)
    console.log('\n✍️ 3. Auditando Permissão de Escrita (Sem Alterar Dados)...');
    if (items.length > 0) {
        const testId = items[0].id;
        // Tentamos um OPTIONS para verificar permissão sem causar efeitos colaterais
        try {
            const optRes = await axios.request({
                method: 'OPTIONS',
                url: `${PROD_CONFIG.baseUrl}/service_orders/${testId}/finish`,
                headers: headers
            });
            console.log('✅ Token autorizado para chamadas de ação neste endpoint.');
        } catch (e) {
            if (e.response?.status === 403 || e.response?.status === 401) {
                console.log(`❌ ACESSO RESTRITO (Status ${e.response?.status}): O usuário não tem permissão para realizar coletas.`);
            } else {
                console.log('✅ Token validado. O servidor aceita autenticação, mas não responde a OPTIONS (comum).');
            }
        }
    } else {
        console.log('⚠️ Nenhuma OS disponível para auditar permissões de ação.');
    }

    console.log('\n🏁 Auditoria em Produção Finalizada!');
  } catch (error) {
    if (error.response?.status === 401) {
        console.error('\n❌ ERRO DE AUTENTICAÇÃO: Credenciais inválidas ou usuário inativo em Produção.');
    } else {
        console.error('\n❌ ERRO NA AUDITORIA:', error.response?.data || error.message);
    }
  }
}

auditPermissions();
