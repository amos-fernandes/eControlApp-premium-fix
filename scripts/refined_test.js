const axios = require('axios');

const TEST_CONFIG = {
  baseUrl: 'https://testeaplicativo.econtrole.com/api',
  email: 'suporte@econtrole.com',
  password: 'ecomotoapp',
};

async function runRefinedTest() {
  console.log('🚀 Iniciando Teste Refinado...');
  
  // 1. LOGIN
  let authHeaders = {};
  try {
    const res = await axios.post(`${TEST_CONFIG.baseUrl}/auth/sign_in`, {
      email: TEST_CONFIG.email,
      password: TEST_CONFIG.password
    });
    
    authHeaders = {
      'access-token': res.headers['access-token'],
      'client': res.headers['client'],
      'uid': res.headers['uid'],
      'expiry': res.headers['expiry'],
      'token-type': res.headers['token-type'] || 'Bearer'
    };
    
    console.log('✅ Login OK. Headers capturados:', Object.keys(authHeaders).filter(k => authHeaders[k]));
  } catch (error) {
    console.error('❌ Falha no Login:', error.message);
    return;
  }

  // 2. BUSCAR OS
  let osId = null;
  try {
    const res = await axios.get(`${TEST_CONFIG.baseUrl}/service_orders`, { headers: authHeaders });
    const os = (res.data.items || res.data.data || []).find(o => o.status === 'scheduled');
    if (os) {
      osId = os.id;
      console.log(`✅ OS encontrada para teste: #${osId}`);
    }
  } catch (error) {
    console.error('❌ Falha ao buscar OS:', error.message);
  }

  if (!osId) return;

  // 3. FINALIZAR OS
  console.log(`📝 Tentando finalizar OS #${osId}...`);
  try {
    const finishRes = await axios.post(`${TEST_CONFIG.baseUrl}/service_orders/${osId}/finish`, {
      arrival_date: new Date().toISOString(),
      departure_date: new Date().toISOString(),
      start_km: "100",
      driver_observations: "Teste PhD"
    }, { 
      headers: { ...authHeaders, 'Content-Type': 'application/json' }
    });
    console.log('✅ SUCESSO na Finalização!');
  } catch (error) {
    console.log('❌ Erro na Finalização:', error.response?.status, error.response?.data);
    
    // Tenta via params se falhar via headers
    console.log('🔄 Tentando via query params...');
    try {
        const finishRes2 = await axios.post(`${TEST_CONFIG.baseUrl}/service_orders/${osId}/finish`, {
            arrival_date: new Date().toISOString()
        }, { 
            params: authHeaders,
            headers: { 'Content-Type': 'application/json' }
        });
        console.log('✅ SUCESSO na Finalização via Params!');
    } catch (e2) {
        console.log('❌ Falha total na finalização.');
    }
  }
}

runRefinedTest();
