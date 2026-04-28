/**
 * Script de Teste de Comparação de Visões (v3 - Filtro no Servidor)
 */

const BASE_URL = "https://testeaplicativo.econtrole.com/api";

const USERS = [
  { name: "MOTORISTA", email: "motoristaapp@econtrole.com", password: "ecomotoapp", expected: 1 },
  { name: "SUPERVISOR", email: "supervisor@econtrole.com", password: "devprod123", expected: 22 }
];

async function runTest() {
  console.log("🧪 [TESTE] Iniciando Comparação v3 (Testando Dialetos do Servidor)...\n");

  for (const user of USERS) {
    console.log(`--- 👤 TESTANDO: ${user.name} (${user.email}) ---`);
    
    try {
      // 1. Login
      const loginRes = await fetch(`${BASE_URL}/auth/sign_in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: user.email, password: user.password }),
      });

      if (!loginRes.ok) {
        console.error(`❌ Falha no login: ${loginRes.status}`);
        continue;
      }

      const loginData = await loginRes.json();
      const credentials = {
        "access-token": loginRes.headers.get("access-token"),
        client: loginRes.headers.get("client"),
        uid: loginRes.headers.get("uid"),
        userId: loginData?.data?.user?.id,
        driver_employee_id: loginData?.data?.user?.employee_id
      };

      console.log(`✅ Login OK! DriverID=${credentials.driver_employee_id || 'NULL'}`);

      // 2. Busca de OS - Testando os dois formatos
      const formats = [
        { label: "SEM FILTRO", params: {} },
        { label: "FILTRO ANINHADO", params: { "service_order[driver_employee_id]": credentials.driver_employee_id } }
      ];

      for (const format of formats) {
        if (format.label === "FILTRO ANINHADO" && !credentials.driver_employee_id) continue;

        const url = new URL(`${BASE_URL}/service_orders`);
        url.searchParams.set("status", "all");
        
        // Aplica os parâmetros do formato de teste
        Object.entries(format.params).forEach(([k, v]) => url.searchParams.set(k, v));

        const res = await fetch(url.toString(), {
          method: "GET",
          headers: { 
            "Content-Type": "application/json", 
            "access-token": credentials["access-token"],
            "client": credentials.client,
            "uid": credentials.uid
          },
        });

        const data = await res.json();
        const items = data.items || data.data || [];
        
        console.log(`📊 [${format.label}] Encontradas: ${items.length} OS (TotalItems: ${data.pagination?.total_items})`);
        
        if (items.length > 0 && format.label === "SEM FILTRO") {
            // Analisa a 1ª OS para ver se ela tem o ID do motorista nela
            console.log(`🔍 Amostra OS ${items[0].identifier}: DriverID=${items[0].driver_employee_id}`);
        }
      }

    } catch (error) {
      console.error(`🚨 Erro: ${error.message}`);
    }
    console.log("\n");
  }
}

runTest();
