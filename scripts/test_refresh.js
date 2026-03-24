#!/usr/bin/env node
/**
 * Teste de Refresh de Token - eControlApp
 * 
 * Testa o endpoint /auth/validate_token para verificar se o servidor está aceitando as credenciais
 * 
 * Uso: node scripts/test_refresh.js
 */

const axios = require('axios');

// Configuração
const CONFIG = {
  baseUrl: 'https://testeaplicativo.econtrole.com/api',
  // Credenciais de teste
  email: 'motoristaapp@econtrole.com',
  password: 'ecomotoapp',
};

async function testLogin() {
  console.log('🔐 Testando Login...\n');
  
  try {
    const response = await axios.post(
      `${CONFIG.baseUrl}/auth/sign_in`,
      { email: CONFIG.email, password: CONFIG.password },
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    console.log('✅ Login bem-sucedido!\n');
    
    // Extrai headers de autenticação
    const accessToken = response.headers['access-token'] || response.headers['Access-Token'];
    const client = response.headers['client'] || response.headers['Client'];
    const uid = response.headers['uid'] || response.headers['Uid'];
    
    console.log('📋 Credenciais obtidas:');
    console.log('  access-token:', accessToken ? `${accessToken.substring(0, 10)}...` : 'N/A');
    console.log('  client:', client ? `${client.substring(0, 10)}...` : 'N/A');
    console.log('  uid:', uid || 'N/A');
    console.log('');
    
    return { accessToken, client, uid };
  } catch (error) {
    console.error('❌ Erro no login:', error.response?.data || error.message);
    return null;
  }
}

async function testRefresh(credentials) {
  console.log('🔄 Testando Refresh de Token...\n');
  
  if (!credentials) {
    console.log('⚠️  Sem credenciais para testar refresh\n');
    return false;
  }
  
  try {
    const response = await axios.get(
      `${CONFIG.baseUrl}/auth/validate_token`,
      {
        headers: {
          'Content-Type': 'application/json',
          'access-token': credentials.accessToken,
          client: credentials.client,
          uid: credentials.uid,
        }
      }
    );
    
    console.log('✅ Refresh bem-sucedido! Status:', response.status);
    
    // Verifica se vieram novos headers
    const newAccessToken = response.headers['access-token'] || response.headers['Access-Token'];
    const newClient = response.headers['client'] || response.headers['Client'];
    
    if (newAccessToken || newClient) {
      console.log('📋 Novos headers recebidos:');
      console.log('  access-token:', newAccessToken ? `${newAccessToken.substring(0, 10)}...` : '(mesmo)');
      console.log('  client:', newClient ? `${newClient.substring(0, 10)}...` : '(mesmo)');
    } else {
      console.log('ℹ️  Headers não foram renovados (comportamento normal em alguns servidores)');
    }
    
    return true;
  } catch (error) {
    console.error('❌ Erro no refresh:', error.response?.status, error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('\n⚠️  Token expirado ou inválido');
      console.log('💡 Possíveis causas:');
      console.log('   • Token expirou (tempo limite atingido)');
      console.log('   • Servidor reiniciou e perdeu sessão');
      console.log('   • Servidor de teste está instável');
    }
    
    return false;
  }
}

async function testFinishOrder(credentials, orderId = 35070) {
  console.log('\n📤 Testando Enviar para Conferência...\n');
  
  if (!credentials) {
    console.log('⚠️  Sem credenciais para testar\n');
    return false;
  }
  
  const payload = {
    service_order: {
      status: 'checking',
      start_km: '100',
      end_km: '150',
      arrival_date: new Date().toISOString(),
      departure_date: new Date().toISOString(),
      driver_observations: 'Teste via script',
      service_executions_attributes: [
        { id: 76406, service_id: 5, amount: 100, status: 'checking' },
        { id: 76405, service_id: 55, amount: 100, status: 'checking' }
      ]
    }
  };
  
  try {
    const response = await axios.put(
      `${CONFIG.baseUrl}/service_orders/${orderId}`,
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
    
    console.log('✅ OS enviada com sucesso! Status:', response.status);
    console.log('📋 Resposta:', JSON.stringify(response.data, null, 2));
    
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar OS:', error.response?.status);
    console.error('📄 Resposta:', JSON.stringify(error.response?.data, null, 2));
    
    if (error.response?.status === 401) {
      console.log('\n⚠️  Servidor rejeitou as credenciais');
      console.log('💡 Isso confirma que o servidor está com problema de autenticação');
    }
    
    return false;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 Teste de Autenticação - eControlApp');
  console.log('Servidor:', CONFIG.baseUrl);
  console.log('='.repeat(60));
  console.log('');
  
  // Teste 1: Login
  const credentials = await testLogin();
  if (!credentials) {
    console.log('\n❌ Falha no login - não é possível continuar os testes');
    return;
  }
  
  // Aguarda 1 segundo
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Teste 2: Refresh
  const refreshSuccess = await testRefresh(credentials);
  
  // Aguarda 1 segundo
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Teste 3: Enviar OS
  const finishSuccess = await testFinishOrder(credentials);
  
  // Resumo
  console.log('\n' + '='.repeat(60));
  console.log('📊 Resumo dos Testes');
  console.log('='.repeat(60));
  console.log('✅ Login:', credentials ? 'OK' : 'FALHOU');
  console.log(`${refreshSuccess ? '✅' : '❌'} Refresh:`, refreshSuccess ? 'OK' : 'FALHOU');
  console.log(`${finishSuccess ? '✅' : '❌'} Enviar OS:`, finishSuccess ? 'OK' : 'FALHOU');
  console.log('');
  
  if (!refreshSuccess || !finishSuccess) {
    console.log('⚠️  Conclusão: Servidor de teste está com problemas de autenticação');
    console.log('💡 Recomendações:');
    console.log('   1. Testar em produção (gsambientais.econtrole.com)');
    console.log('   2. Aguardar estabilização do servidor de teste');
    console.log('   3. Verificar logs do servidor Rails');
    console.log('');
  }
}

// Executa
main().catch(console.error);
