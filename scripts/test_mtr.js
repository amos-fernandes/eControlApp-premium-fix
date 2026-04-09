/**
 * Script de teste para emissão de MTR
 * Testa a integração com o webhook eControle
 * 
 * Uso: node scripts/test_mtr.js
 */

const crypto = require('crypto');

// Configurações
const MTR_URL = 'http://159.89.191.25:8000/mtr/emit';
const WEBHOOK_TOKEN = 'token_m4anJe5wLJKUrFI6XBAycXINq3p5T9YK';
const WEBHOOK_SECRET = '8fa082ac39c3de192acc8df4327b278d555d50826d78537748c35a252443a738';

// OS de teste (ajuste conforme necessário)
const TEST_ORDER_ID = 35102;
const TRACKING_CODE = `OS-${TEST_ORDER_ID}`;

function sha256(message) {
  return crypto.createHash('sha256').update(message).digest('hex');
}

async function testMTR() {
  console.log('\n========== TESTE DE EMISSÃO DE MTR ==========');
  console.log(`Order ID: ${TEST_ORDER_ID}`);
  console.log(`Tracking Code: ${TRACKING_CODE}`);
  console.log(`MTR URL: ${MTR_URL}`);
  console.log('============================================\n');

  // Gera timestamp atual
  const timestamp = Math.floor(Date.now() / 1000).toString();
  console.log(`📅 Timestamp: ${timestamp}`);

  // Gera assinatura SHA256
  const signatureData = `${WEBHOOK_SECRET}${timestamp}${TEST_ORDER_ID}`;
  const signature = sha256(signatureData);
  console.log(`🔐 Signature (SHA256): ${signature.substring(0, 32)}...`);
  console.log(`📝 Signature Data: ${signatureData}\n`);

  // Headers
  const headers = {
    'Content-Type': 'application/json',
    'x-econtrol-webhook-token': WEBHOOK_TOKEN,
    'x-econtrol-timestamp': timestamp,
    'x-econtrol-signature': signature,
  };

  console.log('📤 Enviando requisição...');
  console.log('Headers:', {
    'x-econtrol-webhook-token': WEBHOOK_TOKEN,
    'x-econtrol-timestamp': timestamp,
    'x-econtrol-signature': signature.substring(0, 16) + '...',
  });

  try {
    const response = await fetch(MTR_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        service_order_id: TEST_ORDER_ID,
        tracking_code: TRACKING_CODE,
      }),
      timeout: 30000,
    });

    console.log(`\n📊 Resposta recebida: ${response.status} ${response.statusText}`);

    const data = await response.json();
    console.log('\n✅ SUCESSO! MTR emitido:');
    console.log(JSON.stringify(data, null, 2));

    if (data.mtr_id) {
      console.log(`\n🎉 MTR ID: ${data.mtr_id}`);
    }
    if (data.numero_mtr) {
      console.log(`📋 Número MTR: ${data.numero_mtr}`);
    }
    if (data.pdf_url) {
      console.log(`📄 PDF URL: ${data.pdf_url}`);
    }

  } catch (error) {
    console.error('\n❌ ERRO ao emitir MTR:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Data:', error.response.data);
    } else {
      console.error(error.message);
    }
  }

  console.log('\n============================================');
  console.log('Teste finalizado!');
  console.log('============================================\n');
}

// Executa teste
testMTR().catch(console.error);
