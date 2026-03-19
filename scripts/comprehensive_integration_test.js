const axios = require('axios');
const fs = require('fs');

// Configurações do Ambiente de Teste fornecidas pelo usuário
const TEST_CONFIG = {
  baseUrl: 'https://testeaplicativo.econtrole.com/api',
  email: 'motoristaapp@econtrole.com',
  password: 'ecomotoapp',
};

async function runFullTest() {
  console.log('🚀 Iniciando Teste de Integração Completo...');
  let credentials = {};

  // 1. TESTE DE AUTENTICAÇÃO
  console.log('\n🔐 1. Testando Autenticação...');
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
    
    console.log('✅ Login bem-sucedido!');
    console.log(`👤 Usuário: ${loginRes.data.data.name} (ID: ${loginRes.data.data.id})`);
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

  // 2. TESTE DE CARGA E FILTROS (±20 DIAS)
  console.log('\n📅 2. Testando Carga de OS (±20 dias)...');
  const today = new Date();
  const startDate = new Date();
  startDate.setDate(today.getDate() - 20);
  const endDate = new Date();
  endDate.setDate(today.getDate() + 20);

  const filterUrl = `${TEST_CONFIG.baseUrl}/service_orders?start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}`;
  
  try {
    const osRes = await axios.get(filterUrl, { headers });
    const allItems = osRes.data.items || osRes.data.data || [];
    
    // Simulando a regra de filtragem local (excluir canceladas e finalizadas)
    const filtered = allItems.filter(o => {
        const s = (o.status || '').toLowerCase();
        return s !== 'finished' && s !== 'concluída' && s !== 'canceled' && s !== 'cancelada';
    });

    console.log(`📊 Recebidas ${allItems.length} OS da API.`);
    console.log(`🎯 Filtradas localmente: ${filtered.length} OS "atuando".`);
    
    if (filtered.length > 0) {
      const sample = filtered[0];
      console.log(`✅ Amostra validada: OS #${sample.id} - Status: ${sample.status}`);
    } else {
      console.log('⚠️ Nenhuma OS ativa encontrada no range de datas.');
    }
  } catch (error) {
    console.error('❌ Erro na Carga de OS:', error.response?.data || error.message);
  }

  // 3. TESTE DE ENVIO PARA CONFERÊNCIA
  console.log('\n📤 3. Testando Envio para Conferência (Finalização)...');
  try {
    // Buscamos uma OS pendente para testar
    const osRes = await axios.get(filterUrl, { headers });
    const osToFinish = (osRes.data.items || osRes.data.data || []).find(o => o.status === 'scheduled' || o.status === 'started' || o.status === 'running');

    if (!osToFinish) {
      console.log('⚠️ Nenhuma OS elegível para finalização encontrada nos testes.');
    } else {
      console.log(`📝 Finalizando OS #${osToFinish.id} (${osToFinish.identifier || 'N/A'})...`);
      
      const finishData = {
        arrival_date: new Date().toISOString(),
        departure_date: new Date().toISOString(),
        start_km: "100",
        end_km: "120",
        driver_observations: "Teste de integração automatizado PhD",
        service_executions: osToFinish.service_executions ? osToFinish.service_executions.map(e => ({ id: e.id, amount: 1 })) : []
      };

      const finishParams = {
        "access-token": credentials.accessToken,
        "client": credentials.client,
        "uid": credentials.uid,
      };

      const finishRes = await axios.post(`${TEST_CONFIG.baseUrl}/service_orders/${osToFinish.id}/finish`, finishData, { 
        params: finishParams,
        headers: headers 
      });
      console.log('✅ OS enviada para conferência com sucesso!');

      // 4. TESTE DE EMISSÃO DE MTR (REGRA OBRIGATÓRIA)
      console.log('\n📜 4. Emitindo MTR (Regra Pós-Conferência)...');
      const MTR_WEBHOOK = 'http://159.89.191.25:8000/mtr/webhook/econtrol/emit';
      try {
        const mtrRes = await axios.post(MTR_WEBHOOK, {
          service_order_id: osToFinish.id,
          tracking_code: `OS-${osToFinish.id}-TEST`
        });
        console.log('✅ MTR emitido com sucesso!');
        console.log('🔹 Resultado MTR:', JSON.stringify(mtrRes.data));
      } catch (mtrError) {
        console.error('❌ Erro na Emissão de MTR:', mtrError.response?.data || mtrError.message);
      }
    }
  } catch (error) {
    console.error('❌ Erro no Fluxo de Finalização:', error.response?.data || error.message);
  }

  console.log('\n🏁 Teste de Integração Finalizado!');
}

runFullTest();
