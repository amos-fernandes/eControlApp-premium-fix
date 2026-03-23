const axios = require('axios');

const TEST_CONFIG = {
  osId: 35057,
  mtrBaseUrl: 'http://159.89.191.25:8000',
  token: 'econtrol'
};

async function testMtrEmission() {
  console.log(`🚀 Testando Emissão de MTR para OS #${TEST_CONFIG.osId}...`);

  const endpoints = [
    { url: `${TEST_CONFIG.mtrBaseUrl}/mtr/emit/${TEST_CONFIG.token}`, useAuth: true },
    { url: `${TEST_CONFIG.mtrBaseUrl}/mtr/emit/${TEST_CONFIG.token}`, useAuth: false },
    { url: `${TEST_CONFIG.mtrBaseUrl}/mtr/emit`, useAuth: false }
  ];

  for (const item of endpoints) {
    const { url, useAuth } = item;
    console.log(`\n📡 Tentando endpoint: ${url} (Auth: ${useAuth})`);
    
    const headers = { "Content-Type": "application/json" };
    if (useAuth) {
      headers["Authorization"] = `Bearer ${TEST_CONFIG.token}`;
    }

    try {
      const response = await axios.post(url, {
        service_order_id: TEST_CONFIG.osId,
        tracking_code: `OS-${TEST_CONFIG.osId}-MANUAL-TEST`
      }, { headers, timeout: 15000 });

      console.log('✅ SUCESSO!');
      console.log('🔹 Resposta:', JSON.stringify(response.data, null, 2));
      return;
    } catch (error) {
      console.error(`❌ Erro: ${error.response?.status || 'N/A'}`);
      console.error('🔹 Detalhes:', error.response?.data || error.message);
    }
  }

  console.log('\n🏁 Teste finalizado sem sucesso nos endpoints conhecidos.');
}

testMtrEmission();
