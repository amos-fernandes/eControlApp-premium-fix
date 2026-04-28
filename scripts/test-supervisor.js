/**
 * Script de Teste - Carga de OS Supervisor
 * Objetivo: Verificar volume de dados e paginação para conta de supervisor
 * Execução: node scripts/test-supervisor.js
 */

const BASE_URL = "https://testeaplicativo.econtrole.com/api";
const EMAIL = "supervisor@econtrole.com";
const PASSWORD = "devprod123";

async function testSupervisorLoad() {
  console.log("🧪 [TESTE-SUPERVISOR] Iniciando carga de dados...\n");

  try {
    // 1. Login
    console.log(`🔐 [AUTH] Tentando login com ${EMAIL}...`);
    const loginRes = await fetch(`${BASE_URL}/auth/sign_in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });

    if (!loginRes.ok) {
      const errBody = await loginRes.text();
      throw new Error(`Login falhou (${loginRes.status}): ${errBody}`);
    }

    const credentials = {
      "access-token": loginRes.headers.get("access-token"),
      client: loginRes.headers.get("client"),
      uid: loginRes.headers.get("uid"),
    };

    const loginData = await loginRes.json();
    console.log("✅ [AUTH] Login bem-sucedido!");
    console.log("👤 [USER] Dados do Usuário:", JSON.stringify(loginData.data.user, null, 2));

    const driverId = loginData?.data?.user?.employee_id;
    const userId = loginData?.data?.user?.id;

    // 2. Busca com Paginação (Simulando o que o App faz agora)
    let allOrders = [];
    let currentPage = 1;
    let hasMorePages = true;
    const MAX_PAGES = 20;

    console.log("\n📄 [PAGINAÇÃO] Iniciando busca de todas as páginas (status=all)...");

    while (hasMorePages && currentPage <= MAX_PAGES) {
      const url = new URL(`${BASE_URL}/service_orders`);
      url.searchParams.set("status", "all");
      url.searchParams.set("page", String(currentPage));
      url.searchParams.set("per_page", "100");

      console.log(`🌐 [GET] Página ${currentPage}...`);

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...credentials,
        },
      });

      if (!res.ok) {
        throw new Error(`Erro na página ${currentPage}: ${res.status}`);
      }

      const data = await res.json();
      const items = data.items || data.data || [];
      
      console.log(`📥 [DATA] Recebidos ${items.length} itens nesta página.`);
      
      if (items.length > 0 && currentPage === 1) {
        console.log("🔍 [SAMPLE] Exemplo da 1ª OS (id):", items[0].id);
        console.log("🔍 [SAMPLE] Exemplo da 1ª OS (identifier):", items[0].identifier);
        console.log("🔍 [SAMPLE] Exemplo da 1ª OS (driver_employee_id):", items[0].driver_employee_id);
      }

      allOrders = allOrders.concat(items);

      // Lógica de próxima página baseada no que descobrimos (se veio 20 ou mais, tenta a próxima)
      hasMorePages = items.length >= 20; 
      currentPage++;
    }

    console.log("\n📊 [RESULTADO FINAL]");
    console.log(`✅ Total de OS carregadas: ${allOrders.length}`);
    
    // Teste de filtro local
    if (allOrders.length > 0) {
        const filteredByDriver = allOrders.filter(o => String(o.driver_employee_id) === String(driverId));
        const filteredByUser = allOrders.filter(o => o.user_auth?.id === userId);
        console.log(`🎯 Filtradas por Driver ID (${driverId}): ${filteredByDriver.length}`);
        console.log(`🎯 Filtradas por User ID (${userId}): ${filteredByUser.length}`);
    }

    console.log("\n🚀 Teste concluído com sucesso!");

  } catch (error) {
    console.error("\n❌ [ERRO CRÍTICO]:", error.message);
  }
}

testSupervisorLoad();
