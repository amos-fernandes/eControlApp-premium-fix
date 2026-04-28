/**
 * Script de Teste - Visão Supervisor/Suporte
 * Objetivo: Listar OS para o perfil suporte com filtros de data e status=all
 */

const BASE_URL = "https://testeaplicativo.econtrole.com/api";
const EMAIL = "suporte@econtrole.com";
const PASSWORD = "devprod123";

async function testSupervisorView() {
  console.log("🧪 [TESTE] Iniciando visão de SUPERVISOR/SUPORTE...\n");

  try {
    // 1. Login
    console.log(`🔐 [AUTH] Tentando login com ${EMAIL}...`);
    const loginRes = await fetch(`${BASE_URL}/auth/sign_in`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
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

    console.log("✅ [AUTH] Login bem-sucedido!\n");

    // 2. Requisição de OS com filtros de Supervisor
    const url = new URL(`${BASE_URL}/service_orders`);
    url.searchParams.set("status", "all");
    url.searchParams.set("start_date", "2026-04-21");
    url.searchParams.set("end_date", "2026-05-05");
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", "100");
    
    console.log(`📄 [GET] Buscando OS em: ${url.toString()}\n`);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...credentials,
      },
    });

    if (!res.ok) {
      throw new Error(`API retornou ${res.status}`);
    }

    const data = await res.json();
    const items = data?.items || data?.data || (Array.isArray(data) ? data : []);

    console.log(`📊 [TOTAL ENCONTRADO]: ${items.length}\n`);
    console.log("🆔 LISTA DE OS (ID | DRIVER_EMPLOYEE_ID | STATUS):");
    console.log("------------------------------------------------------------");
    
    items.forEach(os => {
      const driverId = os.driver_employee_id || os.employee_id || (os.user_auth?.employee_id) || 'N/A';
      console.log(`ID: ${String(os.id).padEnd(8)} | DriverID: ${String(driverId).padEnd(6)} | Status: ${os.status}`);
    });

    console.log("------------------------------------------------------------");
    console.log("\n✅ [TESTE] Concluído.");

  } catch (error) {
    console.error("\n❌ [ERRO]:", error.message);
  }
}

testSupervisorView();
