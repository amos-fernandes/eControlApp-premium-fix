const axios = require('axios');
const fs = require('fs');
const path = require('path');

const TEST_CONFIG = {
  baseUrl: 'https://testeaplicativo.econtrole.com/api',
  email: 'motoristaapp@econtrole.com',
  password: 'ecomotoapp',
  mtrBaseUrl: 'http://159.89.191.25:8000',
  token: 'econtrol'
};

async function runMtrTest() {
  console.log('🚀 Iniciando Teste de MTR (Emissão e Download)...');
  
  // 1. LOGIN
  console.log('\n🔐 1. Autenticando...');
  let credentials = {};
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
    console.error('❌ Erro no Login:', error.response?.data || error.message);
    return;
  }

  const headers = {
    'access-token': credentials.accessToken,
    'client': credentials.client,
    'uid': credentials.uid,
    'Content-Type': 'application/json'
  };

  // 2. BUSCAR UMA OS PARA TESTE
  console.log('\n📅 2. Buscando OS para teste de MTR...');
  let osToTest = null;
  try {
    const osRes = await axios.get(`${TEST_CONFIG.baseUrl}/service_orders`, { headers });
    const allItems = osRes.data.items || osRes.data.data || [];
    // Prefer OS that is already finished or scheduled
    osToTest = allItems.find(o => (o.status === 'finished' || o.status === 'concluída') || (o.status === 'scheduled' || o.status === 'running' || o.status === 'started'));
    
    if (!osToTest) {
      console.log('⚠️ Nenhuma OS encontrada para teste.');
      return;
    }
    console.log(`✅ OS #${osToTest.id} selecionada para teste. Status: ${osToTest.status}`);
  } catch (error) {
    console.error('❌ Erro ao buscar OS:', error.response?.data || error.message);
    return;
  }

  // 3. EMITIR MTR
  console.log('\n📜 3. Emitindo MTR...');
  // Tentando o endpoint padronizado do services/api.ts
  const EMIT_URL = `${TEST_CONFIG.mtrBaseUrl}/mtr/emit/${TEST_CONFIG.token}`;
  let mtrData = null;
  try {
    const mtrRes = await axios.post(EMIT_URL, {
      service_order_id: osToTest.id,
      tracking_code: `OS-${osToTest.id}-CLI-TEST`
    }, { timeout: 30000 });
    
    mtrData = mtrRes.data;
    console.log('✅ MTR emitido com sucesso!');
    console.log('🔹 Resultado:', JSON.stringify(mtrData, null, 2));
  } catch (error) {
    console.log(`❌ Erro na emissão em ${EMIT_URL}. Tentando fallback...`);
    // Fallback para o endpoint usado no scripts/test_os_35057.js
    const FALLBACK_URL = `${TEST_CONFIG.mtrBaseUrl}/mtr/emit`;
    try {
        const mtrRes2 = await axios.post(FALLBACK_URL, {
            service_order_id: osToTest.id,
            tracking_code: `OS-${osToTest.id}-CLI-TEST`
        });
        mtrData = mtrRes2.data;
        console.log('✅ MTR emitido com sucesso (fallback)!');
        console.log('🔹 Resultado:', JSON.stringify(mtrData, null, 2));
    } catch (e2) {
        console.error('❌ Falha total na emissão de MTR:', e2.response?.data || e2.message);
        // Se falhar a emissão, não podemos testar o download, mas vamos tentar com um PDF fixo se possível
        // ou avisar o usuário.
        return;
    }
  }

  // 4. TESTAR DOWNLOAD DO MTR
  if (mtrData && mtrData.pdf_url) {
    console.log('\n📄 4. Testando Download do MTR PDF...');
    console.log(`🔗 URL: ${mtrData.pdf_url}`);
    try {
      const downloadPath = path.join(__dirname, `mtr_${mtrData.mtr_id || osToTest.id}.pdf`);
      
      // Alguns PDFs de teste podem ser URLs que precisam de GET simples
      const response = await axios({
        url: mtrData.pdf_url,
        method: 'GET',
        responseType: 'stream'
      });

      const writer = fs.createWriteStream(downloadPath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });

      const stats = fs.statSync(downloadPath);
      console.log(`✅ Download realizado com sucesso! Arquivo salvo em: ${downloadPath}`);
      console.log(`📏 Tamanho do arquivo: ${stats.size} bytes`);
      
      // Validação básica do PDF (assinatura %PDF)
      const buffer = fs.readFileSync(downloadPath, { encoding: 'utf8', flag: 'r' });
      if (buffer.startsWith('%PDF')) {
          console.log('📎 Validação PDF: Assinatura %PDF encontrada. Arquivo íntegro.');
      } else {
          console.warn('⚠️ Validação PDF: Assinatura %PDF não encontrada no início do arquivo.');
      }
    } catch (error) {
      console.error('❌ Erro no Download do MTR:', error.message);
    }
  } else {
    console.log('\n⚠️ Download não disponível (pdf_url não retornado).');
  }

  console.log('\n🏁 Teste de Ciclo MTR Finalizado!');
}

runMtrTest();
