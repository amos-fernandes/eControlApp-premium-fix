const axios = require('axios');

const TEST_CONFIG = {
  baseUrl: 'https://testeaplicativo.econtrole.com/api', // Já contém /api
  email: 'motoristaapp@econtrole.com',
  password: 'ecomotoapp',
  osId: 35071
};

async function runSpecificTest() {
  console.log(`🚀 Iniciando Fluxo Completo (Padrão v1.7.0 PhD) para OS #${TEST_CONFIG.osId}...`);
  let credentials = {};

  // 1. LOGIN
  console.log('\n🔐 1. Autenticando usuário...');
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
    console.error('❌ Erro no Login. Tentando fallback...');
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
    // Nota: removemos o /api extra da URL
    const osRes = await axios.get(`${TEST_CONFIG.baseUrl}/service_orders/${TEST_CONFIG.osId}`, { headers });
    const os = osRes.data.data || osRes.data;
    console.log(`✅ OS Localizada. Status Atual: ${os.status}`);

  

    // 4. EMITIR MTR (WEBHOOK ECONTROLE)
    console.log('\n📜 4. Emitindo MTR Webhook...');
    const MTR_WEBHOOK = 'http://159.89.191.25:8000/mtr/emit/econtrol';
    try {
      const mtrRes = await axios.post(MTR_WEBHOOK, {
        service_order_id: TEST_CONFIG.osId,
        tracking_code: `OS-${TEST_CONFIG.osId}-PhD-VALIDATION`
      });
      console.log('✅ MTR emitido com sucesso!');
      console.log('🔹 Resultado:', JSON.stringify(mtrRes.data));
    } catch (mtrError) {
      console.error('❌ Erro na Emissão de MTR:', mtrError.response?.data || mtrError.message);
    }

  } catch (error) {
    console.error('❌ Erro no processamento:', error.response?.data || error.message);
  }

  console.log('\n🏁 Teste de Fluxo Finalizado!');
}

runSpecificTest();
