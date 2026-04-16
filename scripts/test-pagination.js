/**
 * Script de Teste - Paginação Automática
 * Objetivo: Verificar se a API retorna dados de paginação
 * Execução: node scripts/test-pagination.js
 */

const BASE_URL = "https://testeaplicativo.econtrole.com/api";
const EMAIL = "motoristaapp@econtrole.com";
const PASSWORD = "ecomotoapp";

async function testPagination() {
  console.log("🧪 [TESTE] Iniciando teste de paginação...\n");

  try {
    // 1. Login
    console.log("🔐 [TESTE] Fazendo login...");
    const loginRes = await fetch(`${BASE_URL}/auth/sign_in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });

    if (!loginRes.ok) {
      throw new Error(`Login falhou: ${loginRes.status}`);
    }

    const credentials = {
      "access-token": loginRes.headers.get("access-token"),
      client: loginRes.headers.get("client"),
      uid: loginRes.headers.get("uid"),
    };

    console.log("✅ [TESTE] Login realizado\n");

    // 2. Primeira requisição com paginação
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);

    const url = new URL(`${BASE_URL}/service_orders`);
    url.searchParams.set("start_date", startDate.toISOString().split("T")[0]);
    url.searchParams.set("end_date", endDate.toISOString().split("T")[0]);
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", "100");

    console.log("📄 [TESTE] Buscando página 1...");
    console.log(`📄 [TESTE] URL: ${url.toString()}\n`);

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

    // 3. Analisar headers e corpo da resposta
    console.log("🔍 [TESTE] ========== ANÁLISE DA RESPOSTA ==========");
    console.log("\n📋 [TESTE] HEADERS DE PAGINAÇÃO:");
    console.log("  X-Total:", res.headers.get("X-Total"));
    console.log("  X-Per-Page:", res.headers.get("X-Per-Page"));
    console.log("  X-Page:", res.headers.get("X-Page"));
    console.log("  X-Total-Pages:", res.headers.get("X-Total-Pages"));
    console.log("  Link:", res.headers.get("Link"));

    const data = await res.json();

    console.log("\n📦 [TESTE] ESTRUTURA DO CORPO:");
    console.log("  Keys:", Object.keys(data));
    console.log("  pagination:", JSON.stringify(data?.pagination, null, 2));
    console.log("  meta:", JSON.stringify(data?.meta, null, 2));
    console.log("  links:", JSON.stringify(data?.links, null, 2));
    console.log("  current_page:", data?.current_page);
    console.log("  total_pages:", data?.total_pages);
    console.log("  next_page:", data?.next_page);
    console.log("  prev_page:", data?.prev_page);
    console.log("  total_count:", data?.total_count);

    console.log("\n📊 [TESTE] DADOS:");
    console.log("  items.length:", data?.items?.length ?? "N/A");
    console.log("  data.length:", data?.data?.length ?? "N/A");

    if (Array.isArray(data?.items)) {
      console.log("  ✅ Formato detectado: data.items");
      console.log("  Primeira OS ID:", data.items[0]?.id);
      console.log("  Última OS ID:", data.items[data.items.length - 1]?.id);
    } else if (Array.isArray(data?.data)) {
      console.log("  ✅ Formato detectado: data.data");
    } else if (Array.isArray(data)) {
      console.log("  ✅ Formato detectado: array direto");
    }

    console.log("\n💡 [TESTE] ========== CONCLUSÃO ==========");
    
    // Determinar qual parâmetro de paginação usar
    if (data?.pagination?.next_page !== undefined) {
      console.log("✅ USAR: data.pagination.next_page");
      console.log("   Detectado: Rails Kaminari/WillPaginate");
    } else if (data?.meta?.total_pages !== undefined) {
      console.log("✅ USAR: data.meta.total_pages");
      console.log("   Detectado: JSON:API ou similar");
    } else if (data?.total_pages !== undefined) {
      console.log("✅ USAR: data.total_pages");
      console.log("   Detectado: Paginação customizada");
    } else if (res.headers.get("X-Total-Pages")) {
      console.log("✅ USAR: Header X-Total-Pages");
      console.log("   Detectado: Paginação via headers HTTP");
    } else {
      console.log("⚠️ NENHUM PADRÃO DETECTADO!");
      console.log("   Fallback: Usar contagem de items (< 100 = acabou)");
    }

    console.log("\n✅ [TESTE] Teste concluído!\n");

  } catch (error) {
    console.error("❌ [TESTE] Erro:", error.message);
    process.exit(1);
  }
}

testPagination();
