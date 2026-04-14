/**
 * Script de Diagnóstico de Conexão - testeaplicativo.econtrole.com
 */

const https = require('https');
const url = require('url');

const BASE_URL = "https://testeaplicativo.econtrole.com";
const EMAIL = "motoristaapp@econtrole.com";
const PASSWORD = "ecomotoapp";

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const fullUrl = new URL(path, BASE_URL);
    
    const requestOptions = {
      hostname: fullUrl.hostname,
      port: fullUrl.port || 443,
      path: fullUrl.pathname + fullUrl.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      rejectUnauthorized: false // Para teste
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      
      console.log(`\n📡 ${options.method || 'GET'} ${fullUrl.pathname}`);
      console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
      console.log(`   Headers:`);
      Object.entries(res.headers).forEach(([key, value]) => {
        if (['set-cookie', 'transfer-encoding'].includes(key.toLowerCase())) return;
        console.log(`     ${key}: ${value}`);
      });

      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, data: data.substring(0, 500) });
        }
      });
    });

    req.on('error', (e) => {
      reject(new Error(`Erro na requisição: ${e.message}`));
    });

    req.setTimeout(15000, () => {
      req.destroy();
      reject(new Error('Timeout (15s)'));
    });

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runDiagnostic() {
  console.log("🔍 ========== DIAGNÓSTICO DE CONEXÃO ==========");
  console.log(`🌐 Servidor: ${BASE_URL}`);
  console.log(`👤 Usuário: ${EMAIL}`);
  console.log("⏰ Data:", new Date().toISOString());

  try {
    // 1. Teste de conectividade básica
    console.log("\n\n📶 [TESTE 1] Conectividade básica (ping HTTPS)");
    try {
      const healthCheck = await makeRequest('/api/health');
      console.log("✅ Servidor está acessível");
    } catch (e) {
      console.log(`⚠️ Health check falhou (pode ser normal): ${e.message}`);
    }

    // 2. Login
    console.log("\n\n🔐 [TESTE 2] Login na API");
    const loginRes = await makeRequest('/api/auth/sign_in', {
      method: 'POST',
      body: { email: EMAIL, password: PASSWORD }
    });

    if (loginRes.status === 200 || loginRes.status === 302) {
      console.log("✅ Login realizado com sucesso!");
      
      // Extrair tokens dos headers
      const headers = loginRes.headers;
      const accessToken = headers['access-token'] || headers['Access-Token'];
      const client = headers['client'] || headers['Client'];
      const uid = headers['uid'] || headers['Uid'];

      console.log("\n🎫 Tokens recebidos:");
      console.log(`   access-token: ${accessToken ? accessToken.substring(0, 30) + '...' : 'NÃO RECEBIDO'}`);
      console.log(`   client: ${client || 'NÃO RECEBIDO'}`);
      console.log(`   uid: ${uid || 'NÃO RECEBIDO'}`);

      if (!accessToken || !client || !uid) {
        console.log("\n❌ ERRO: Tokens de autenticação incompletos!");
        console.log("   Isso impede requisições autenticadas.");
        return;
      }

      // 3. Testar busca de OS
      console.log("\n\n📦 [TESTE 3] Buscar ordens de serviço");
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const osUrl = `/api/service_orders?start_date=${startDate.toISOString().split('T')[0]}&end_date=${endDate.toISOString().split('T')[0]}&page=1&per_page=10`;
      
      const osRes = await makeRequest(osUrl, {
        method: 'GET',
        headers: {
          'access-token': accessToken,
          'client': client,
          'uid': uid
        }
      });

      if (osRes.status === 200) {
        console.log("✅ Busca de OS funcionou!");
        console.log("\n📊 Estrutura da resposta:");
        console.log(`   Keys: ${Object.keys(osRes.data).join(', ')}`);
        console.log(`   pagination: ${JSON.stringify(osRes.data?.pagination)}`);
        console.log(`   items.length: ${osRes.data?.items?.length ?? 'N/A'}`);
        console.log(`   data.length: ${osRes.data?.data?.length ?? 'N/A'}`);
        console.log(`   total_count: ${osRes.data?.total_count ?? 'N/A'}`);
        console.log(`   current_page: ${osRes.data?.current_page ?? 'N/A'}`);
        console.log(`   total_pages: ${osRes.data?.total_pages ?? 'N/A'}`);
        console.log(`   next_page: ${osRes.data?.next_page ?? 'N/A'}`);

        if (Array.isArray(osRes.data?.items)) {
          console.log(`\n📋 Primeiras OS recebidas:`);
          osRes.data.items.slice(0, 3).forEach((os, i) => {
            console.log(`   ${i + 1}. ID: ${os.id}, Status: ${os.status}, Identifier: ${os.identifier || 'N/A'}`);
          });
        }
      } else if (osRes.status === 401) {
        console.log("❌ ERRO 401: Não autorizado");
        console.log("   Token pode ter expirado ou estar inválido.");
      } else {
        console.log(`❌ ERRO: Status ${osRes.status}`);
        console.log(`   Resposta: ${JSON.stringify(osRes.data).substring(0, 300)}`);
      }

    } else if (loginRes.status === 401) {
      console.log("❌ ERRO 401: Credenciais inválidas");
      console.log("   Verifique email e senha.");
    } else {
      console.log(`❌ ERRO: Status ${loginRes.status}`);
      console.log(`   Resposta: ${JSON.stringify(loginRes.data).substring(0, 300)}`);
    }

  } catch (error) {
    console.error(`\n❌ ERRO FATAL: ${error.message}`);
    console.error("\nPossíveis causas:");
    console.error("   1. Servidor fora do ar");
    console.error("   2. DNS não resolvendo");
    console.error("   3. Firewall bloqueando");
    console.error("   4. Certificado SSL inválido");
  }

  console.log("\n\n✅ ========= FIM DO DIAGNÓSTICO ==========");
}

runDiagnostic();
