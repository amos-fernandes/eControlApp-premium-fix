const axios = require('axios');

const TEST_CONFIG = {
  baseUrl: 'https://testeaplicativo.econtrole.com/api',
  email: 'motoristaapp@econtrole.com',
  password: 'ecomotoapp',
  osId: 35103
};

async function getOSDetails() {
  console.log(`🚀 Buscando detalhes da OS #${TEST_CONFIG.osId}...`);
  
  try {
    const loginRes = await axios.post(`${TEST_CONFIG.baseUrl}/auth/sign_in`, {
      email: TEST_CONFIG.email,
      password: TEST_CONFIG.password
    });
    
    const headers = {
      'access-token': loginRes.headers['access-token'],
      'client': loginRes.headers['client'],
      'uid': loginRes.headers['uid'],
      'Content-Type': 'application/json'
    };

    const osRes = await axios.get(`${TEST_CONFIG.baseUrl}/service_orders/${TEST_CONFIG.osId}`, { headers });
    const os = osRes.data.data || osRes.data;
    
    console.log('✅ OS Recuperada!');
    console.log(`🔹 Status: ${os.status}`);
    console.log(`🔹 OS: ${JSON.stringify(os)}`);
    console.log(`🔹 MTR ID: ${os.mtr_id || 'Não emitido'}`);
    console.log(`🔹 Identifier: ${os.identifier || 'N/A'}`);
    
    if (os.mtr_id) {
        console.log('\n💡 Esta OS já tem um MTR! Podemos testar o download.');
    } else {
        console.log('\n⚠️ Esta OS ainda não tem MTR emitido.');
    }
  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

getOSDetails();
