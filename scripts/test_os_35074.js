#!/usr/bin/env node
/**
 * Teste Específico OS 35074 - testeaplicativo.econtrole.com
 * 
 * Verifica status atual da OS e tenta enviar para conferência
 */

const axios = require('axios');

const CONFIG = {
  baseUrl: 'https://testeaplicativo.econtrole.com/api',
  email: 'motoristaapp@econtrole.com',
  password: 'ecomotoapp',
  osId: 35075,
  osIdentifier: null, // Será preenchido com OS disponível
};

let credentials = null;

async function login() {
  console.log('🔐 1. Fazendo login...\n');
  
  const response = await axios.post(
    `${CONFIG.baseUrl}/auth/sign_in`,
    { email: CONFIG.email, password: CONFIG.password },
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  credentials = {
    accessToken: response.headers['access-token'] || response.headers['Access-Token'],
    client: response.headers['client'] || response.headers['Client'],
    uid: response.headers['uid'] || response.headers['Uid'],
  };
  
  console.log('✅ Login realizado!\n');
  return credentials;
}

async function findAvailableOS() {
  console.log('🔍 1. Buscando OS disponível para conferência...\n');
  
  try {
    const now = new Date();
    const twentyDaysAgo = new Date(now);
    twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
    
    const startDate = twentyDaysAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];
    
    const response = await axios.get(
      `${CONFIG.baseUrl}/service_orders?start_date=${startDate}&end_date=${endDate}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'access-token': credentials.accessToken,
          client: credentials.client,
          uid: credentials.uid,
        }
      }
    );
    
    const items = response.data?.items || response.data?.data || [];
    
    // Busca OS com status 'running' ou 'scheduled'
    const availableOS = items.find(os => 
      (os.status === 'running' ) &&
      os.service_executions && os.service_executions.length > 0
    );
    
    if (!availableOS) {
      console.log('❌ Nenhuma OS disponível encontrada (running/scheduled)\n');
      console.log('📊 OS encontradas:');
      items.slice(0, 5).forEach(os => {
        console.log(`   - ${os.identifier || os.id}: ${os.status} (${os.customer?.name || 'N/A'})`);
      });
      return null;
    }
    
    console.log(`✅ OS encontrada: ${availableOS.identifier || availableOS.id}`);
    console.log(`   Status: ${availableOS.status}`);
    console.log(`   Customer: ${availableOS.customer?.name || 'N/A'}`);
    console.log(`   Service Executions: ${availableOS.service_executions?.length || 0}\n`);
    
    CONFIG.osIdentifier = availableOS.identifier || availableOS.id;
    return availableOS;
  } catch (error) {
    console.error('❌ Erro ao buscar OS:', error.response?.status, error.response?.data || error.message);
    return null;
  }
}

async function checkOSStatus(osId) {
  console.log(`🔍 2. Verificando status atual da OS ${osId}...\n`);
  
  try {
    const response = await axios.get(
      `${CONFIG.baseUrl}/service_orders?identifier=${osId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'access-token': credentials.accessToken,
          client: credentials.client,
          uid: credentials.uid,
        }
      }
    );
    
    const os = response.data?.items?.[0] || response.data?.data?.[0];
    
    if (!os) {
      console.log('❌ OS não encontrada\n');
      return null;
    }
    
    console.log('📊 Status atual da OS:');
    console.log(`   ID: ${os.id}`);
    console.log(`   Identifier: ${os.identifier}`);
    console.log(`   Status: ${os.status}`);
    console.log(`   Customer: ${os.customer?.name || 'N/A'}`);
    console.log(`   Service Executions: ${os.service_executions?.length || 0} itens\n`);
    
    // Verifica status dos itens
    if (os.service_executions && os.service_executions.length > 0) {
      console.log('📋 Status dos itens:');
      os.service_executions.forEach(item => {
        console.log(`   - Item ${item.id}: ${item.status || 'N/A'}`);
      });
      console.log('');
    }
    
    return os;
  } catch (error) {
    console.error('❌ Erro ao buscar OS:', error.response?.status, error.response?.data || error.message);
    return null;
  }
}

async function sendToConference(os) {
  console.log('📤 3. Enviando OS para conferência com status "checking"...\n');
  
  // Prepara service_executions com status checking
  const serviceExecutions = os.service_executions?.map(item => ({
    id: item.id,
    service_id: item.service?.id,
    amount: item.amount || 1,
    status: 'checking' // CRUCIAL
  })) || [];
  
  const payload = {
    status: 'checking', // Status da OS
    service_executions_attributes: serviceExecutions,
    start_km: '100',
    end_km: '150',
    arrival_date: new Date().toISOString(),
    departure_date: new Date().toISOString(),
    driver_observations: 'Teste via script - status checking',
  };
  
  console.log('📦 Payload enviado:');
  console.log(JSON.stringify(payload, null, 2));
  console.log('');
  
  try {
    const response = await axios.post(
      `${CONFIG.baseUrl}/service_orders/${os.id}/finish`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          'access-token': credentials.accessToken,
          client: credentials.client,
          uid: credentials.uid,
        }
      }
    );
    
    console.log('✅ OS enviada com sucesso!\n');
    console.log('📊 Status retornado pela API:');
    console.log(`   Status: ${response.data?.status || 'N/A'}`);
    console.log(`   ID: ${response.data?.id || 'N/A'}`);
    
    // Verifica se veio os dados atualizados
    if (response.data?.service_executions && response.data.service_executions.length > 0) {
      console.log('\n📋 Status dos itens após envio:');
      response.data.service_executions.forEach(item => {
        console.log(`   - Item ${item.id}: ${item.status || 'N/A'}`);
      });
    }
    
    console.log('');
    
    // Se status ainda for 'finished', a API está ignorando
    if (response.data?.status === 'finished') {
      console.log('⚠️  ATENÇÃO: API retornou status "finished" mesmo enviando "checking"');
      console.log('💡  Isso indica que a API Rails está ignorando o status no payload');
      console.log('💡  Possível solução: A API pode exigir um parâmetro específico ou ter validação customizada\n');
    } else if (response.data?.status === 'checking') {
      console.log('🎉 SUCESSO: Status foi alterado para "checking"!\n');
    } else {
      console.log(`⚠️  Status retornado: "${response.data?.status}"\n`);
    }
    
    return response.data;
  } catch (error) {
    console.error('❌ Erro ao enviar OS:', error.response?.status);
    console.error('📄 Resposta:', JSON.stringify(error.response?.data, null, 2));
    return null;
  }
}

async function verifyFinalStatus() {
  console.log('🔍 4. Verificando status final da OS...\n');
  
  await checkOSStatus();
}

async function main() {
  console.log('='.repeat(70));
  console.log('🧪 Teste - Envio para Conferência (Status Checking)');
  console.log('Servidor: testeaplicativo.econtrole.com');
  console.log('='.repeat(70));
  console.log('');
  
  // 1. Login
  await login();
  
  // 2. Busca OS disponível (running/scheduled)
  const availableOS = await findAvailableOS();
  if (!availableOS) {
    console.log('\n❌ Não foi possível encontrar uma OS disponível para teste');
    console.log('💡 Tente novamente mais tarde ou verifique o painel');
    return;
  }
  
  // 3. Verifica status atual
  const os = await checkOSStatus(CONFIG.osIdentifier);
  if (!os) {
    console.log('❌ Não foi possível localizar a OS');
    return;
  }
  
  // 4. Envia para conferência
  await sendToConference(os);
  
  // 5. Verifica status final
  await verifyFinalStatus();
  
  console.log('='.repeat(70));
  console.log('✅ Teste concluído!');
  console.log('='.repeat(70));
  console.log('');
}

main().catch(console.error);
