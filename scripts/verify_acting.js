const BASE_URL = "https://testeaplicativo.econtrole.com/api";
const EMAIL = "motoristaapp@econtrole.com";
const PASSWORD = "ecomotoapp";

async function verifyActingStatus() {
  console.log("🧪 [VERIFICAÇÃO] Analisando status 'acting'...\n");

  const loginRes = await fetch(`${BASE_URL}/auth/sign_in`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });

  const credentials = {
    "access-token": loginRes.headers.get("access-token"),
    client: loginRes.headers.get("client"),
    uid: loginRes.headers.get("uid"),
  };

  // Buscando com status=acting SEM filtro de data para ver o que a API considera "acting"
  const url = new URL(`${BASE_URL}/service_orders`);
  url.searchParams.set("status", "acting");
  url.searchParams.set("page", "1");
  url.searchParams.set("per_page", "100");

  const res = await fetch(url.toString(), { headers: credentials });
  const data = await res.json();
  const items = data.items || data.data || (Array.isArray(data) ? data : []);

  console.log(`📊 Total de OS com status=acting: ${items.length}\n`);
  console.log("🆔 DETALHES DAS OS:");
  console.log("------------------------------------------------------------");
  console.log("ID       | Identifier       | Status      | Data");
  console.log("------------------------------------------------------------");

  items.forEach(os => {
    const date = os.service_date || os.scheduled_date || "N/A";
    console.log(`${String(os.id).padEnd(8)} | ${String(os.identifier || 'N/A').padEnd(16)} | ${String(os.status).padEnd(11)} | ${date}`);
  });
  console.log("------------------------------------------------------------");
}

verifyActingStatus();
