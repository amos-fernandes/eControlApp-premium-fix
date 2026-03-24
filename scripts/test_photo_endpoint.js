const axios = require('axios');

const CONFIG = {
  baseUrl: 'https://testeaplicativo.econtrole.com/api',
  email: 'motoristaapp@econtrole.com',
  password: 'ecomotoapp',
  osId: 35070
};

async function testEndpoints() {
  console.log('🚀 Autenticando...');
  let credentials = {};
  try {
    const loginRes = await axios.post(`${CONFIG.baseUrl}/auth/sign_in`, {
      email: CONFIG.email,
      password: CONFIG.password
    });
    credentials = {
      'access-token': loginRes.headers['access-token'],
      'client': loginRes.headers['client'],
      'uid': loginRes.headers['uid']
    };
    console.log('✅ Logado!');
  } catch (error) {
    console.error('❌ Erro login:', error.message);
    return;
  }

  const paths = [
    `${CONFIG.baseUrl}/service_order_images`,
    `${CONFIG.baseUrl}/photos`,
    `${CONFIG.baseUrl}/service_orders/${CONFIG.osId}/finish`
  ];

  for (const path of paths) {
    console.log(`\n🔍 Testando POST em: ${path}`);
    try {
      const res = await axios.post(path, {}, { headers: credentials });
      console.log(`✅ Status: ${res.status}`);
    } catch (error) {
      if (error.response) {
        console.log(`ℹ️ Status: ${error.response.status}`);
        if (error.response.status !== 404) {
          console.log(`✨ ROTA EXISTE (recebeu ${error.response.status})`);
        } else {
          console.log(`❌ ROTA NÃO EXISTE (404)`);
        }
      } else {
        console.log(`❌ Erro: ${error.message}`);
      }
    }
  }
}

testEndpoints();
