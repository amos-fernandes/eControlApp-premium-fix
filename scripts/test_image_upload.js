/**
 * Script de teste para upload de imagem para AWS S3
 * Testa o endpoint /service_orders/:id/photos
 * 
 * Uso: node scripts/test_image_upload.js <order_id> <image_path>
 * Exemplo: node scripts/test_image_upload.js 35102 ./test_photo.jpg
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const http = require('http');
const https = require('https');

// Configurações - AJUSTAR CONFORME NECESSÁRIO
const BASE_URL = 'https://gsambientais.econtrole.com/api'; // OU testeaplicativo
const ORDER_ID = process.argv[2] || 35102;
const IMAGE_PATH = process.argv[3] || './test_photo.jpg';

// Credenciais - OBTER VIA LOGIN
const EMAIL = 'suporte@econtrole.com';
const PASSWORD = 'ecomotoapp';

async function login() {
  console.log('🔐 Fazendo login...');
  
  const response = await fetch(`${BASE_URL}/auth/sign_in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status} ${response.statusText}`);
  }

  const headers = {
    'access-token': response.headers.get('access-token'),
    'client': response.headers.get('client'),
    'uid': response.headers.get('uid'),
  };

  console.log('✅ Login successful!');
  console.log(`   Token: ${headers['access-token']?.substring(0, 20)}...`);
  return headers;
}

async function uploadImage(authHeaders, orderId, imagePath) {
  console.log(`\n📸 Iniciando upload de imagem...`);
  console.log(`   Order ID: ${orderId}`);
  console.log(`   Image: ${imagePath}`);

  // Verifica se arquivo existe
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Arquivo não encontrado: ${imagePath}`);
  }

  const stats = fs.statSync(imagePath);
  console.log(`   File size: ${(stats.size / 1024).toFixed(2)} KB`);

  // Cria FormData
  const form = new FormData();
  const fileStream = fs.createReadStream(imagePath);
  const filename = `test_upload_${Date.now()}.jpg`;
  
  form.append('photo', fileStream, {
    filename,
    contentType: 'image/jpeg',
  });

  // URL do endpoint
  const url = `${BASE_URL}/service_orders/${orderId}/photos`;
  console.log(`\n📤 Enviando para: ${url}`);

  // Extrai host para decidir http/https
  const urlObj = new URL(url);
  const transport = urlObj.protocol === 'https:' ? https : http;

  return new Promise((resolve, reject) => {
    const request = transport.request(urlObj, {
      method: 'POST',
      headers: {
        ...authHeaders,
        ...form.getHeaders(),
        'Accept': 'application/json',
      },
    }, (response) => {
      let data = '';
      
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        console.log(`\n📊 Response: ${response.statusCode} ${response.statusMessage}`);
        
        try {
          const parsed = JSON.parse(data);
          console.log('\n✅ Upload successful!');
          console.log(JSON.stringify(parsed, null, 2));
          resolve(parsed);
        } catch (e) {
          console.log('\n⚠️  Response não é JSON:');
          console.log(data.substring(0, 500));
          resolve(data);
        }
      });
    });

    request.on('error', (error) => {
      console.error('\n❌ Erro na requisição:');
      console.error(error.message);
      reject(error);
    });

    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timeout (40s)'));
    });

    request.setTimeout(40000);
    form.pipe(request);
  });
}

async function runTest() {
  console.log('\n========== TESTE DE UPLOAD DE IMAGEM ==========');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Order ID: ${ORDER_ID}`);
  console.log(`Image: ${IMAGE_PATH}`);
  console.log('===============================================\n');

  try {
    // 1. Login
    const authHeaders = await login();

    // 2. Upload
    const result = await uploadImage(authHeaders, ORDER_ID, IMAGE_PATH);

    console.log('\n===============================================');
    console.log('✅ Teste finalizado com SUCESSO!');
    console.log('===============================================\n');
    
  } catch (error) {
    console.error('\n===============================================');
    console.error('❌ ERRO no teste:');
    console.error(error.message);
    console.error('===============================================\n');
    process.exit(1);
  }
}

// Executa teste
runTest().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
