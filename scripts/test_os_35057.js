const axios = require('axios');

const TEST_CONFIG = {
  baseUrl: 'https://testeaplicativo.econtrole.com/api',
  email: 'suporte@econtrole.com',
  password: 'ecomotoapp',
  osId: 35057
};

async function runSpecificTest() {
  console.log(`🚀 Iniciando Fluxo Completo para OS #${TEST_CONFIG.osId}...`);
  let credentials = {};

  // 1. LOGIN
  console.log('\n🔐 1. Autenticando usuário suporte...');
  try {
    const loginRes = await axios.post(`${TEST_CONFIG.baseUrl}/auth/sign_in`, {
      email: TEST_CONFIG.email,
      password: TEST_CONFIG.password
    });
    
    credentials = {
      accessToken: loginRes.headers['access-token'],
      client: loginRes.headers['client'],
      uid: loginRes.headers['uid']
    };
    console.log('✅ Autenticação bem-sucedida!');
  } catch (error) {
    console.error('❌ Erro no Login. Verifique se o usuário suporte@econtrole.com está ativo.');
    // Fallback rápido para motoristaapp se suporte falhar para não travar o teste da OS
    console.log('🔄 Tentando fallback para motoristaapp@econtrole.com...');
    try {
        const fallbackRes = await axios.post(`${TEST_CONFIG.baseUrl}/auth/sign_in`, {
            email: 'motoristaapp@econtrole.com',
            password: TEST_CONFIG.password
        });
        credentials = {
            accessToken: fallbackRes.headers['access-token'],
            client: fallbackRes.headers['client'],
            uid: fallbackRes.headers['uid']
        };
        console.log('✅ Login fallback bem-sucedido!');
    } catch (e2) {
        console.error('❌ Falha total na autenticação.');
        return;
    }
  }

  const headers = {
    'access-token': credentials.accessToken,
    'client': credentials.client,
    'uid': credentials.uid,
    'Content-Type': 'application/json'
  };

  // 2. BUSCAR DETALHES DA OS
  console.log(`\n📖 2. Buscando detalhes da OS #${TEST_CONFIG.osId}...`);
  try {
    const osRes = await axios.get(`${TEST_CONFIG.baseUrl}/service_orders/${TEST_CONFIG.osId}`, { headers });
    const os = osRes.data.data || osRes.data;
    console.log(`✅ OS Localizada. Status Atual: ${os.status}`);
    
    if (os.status !== 'running' && os.status !== 'started' && os.status !== 'scheduled') {
        console.log(`⚠️ Status da OS é '${os.status}'. Talvez ela já tenha sido processada.`);
    }

    // 3. ENVIAR PARA CONFERÊNCIA (FINISH)
    console.log('\n📤 3. Enviando para Conferência (Finalização)...');
    const finishData = {
      arrival_date: new Date().toISOString(),
      departure_date: new Date().toISOString(),
      start_km: "500",
      end_km: "520",
      driver_observations: "Fluxo completo validado via script PhD - OS #35057",
      service_executions: os.service_executions ? os.service_executions.map(e => ({ id: e.id, amount: 1 })) : []
    };

    // Usando params conforme padrão identificado no temp-repo para evitar 403
    const finishRes = await axios.post(`${TEST_CONFIG.baseUrl}/service_orders/${TEST_CONFIG.osId}/finish`, finishData, { 
        params: credentials,
        headers: headers 
    });
    console.log('✅ OS enviada para conferência com sucesso!');

    // 4. EMITIR MTR (REGRA OBRIGATÓRIA)
    console.log('\n📜 4. Emitindo MTR Webhook...');
    const MTR_WEBHOOK = 'http://159.89.191.25:8000/mtr/emit';
    try {
      const mtrRes = await axios.post(MTR_WEBHOOK, {
        service_order_id: TEST_CONFIG.osId,
        tracking_code: `OS-${TEST_CONFIG.osId}-PROD-FLOW`
      });
      console.log('✅ MTR emitido com sucesso!');
      console.log('🔹 Detalhes MTR:', JSON.stringify(mtrRes.data));
    } catch (mtrError) {
      console.error('❌ Erro na Emissão de MTR:', mtrError.response?.data || mtrError.message);
    }

  } catch (error) {
    console.error('❌ Erro no processamento da OS:', error.response?.data || error.message);
  }

  console.log('\n🏁 Teste de Fluxo OS #35057 Finalizado!');
}

runSpecificTest();
