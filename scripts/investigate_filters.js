const BASE_URL = "https://testeaplicativo.econtrole.com/api";
const EMAIL = "motoristaapp@econtrole.com";
const PASSWORD = "ecomotoapp";

async function investigate() {
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

  const tests = [
    { name: "Filtro Original (status=acting + datas)", status: "acting", start_date: "2026-04-21", end_date: "2026-05-05" },
    { name: "Sem Status (só datas)", status: "all", start_date: "2026-04-21", end_date: "2026-05-05" },
    { name: "Sem Datas (só status=acting)", status: "acting", start_date: "", end_date: "" },
    { name: "Tudo Liberado (status=all, sem datas)", status: "all", start_date: "", end_date: "" }
  ];

  for (const t of tests) {
    const url = new URL(`${BASE_URL}/service_orders`);
    url.searchParams.set("page", "1");
    url.searchParams.set("per_page", "100");
    if (t.status) url.searchParams.set("status", t.status);
    if (t.start_date) url.searchParams.set("start_date", t.start_date);
    if (t.end_date) url.searchParams.set("end_date", t.end_date);

    const res = await fetch(url.toString(), { headers: credentials });
    const data = await res.json();
    const items = data.items || data.data || (Array.isArray(data) ? data : []);
    console.log(`\n🔍 ${t.name}: Encontradas ${items.length} OS`);
    if (items.length > 0) {
      console.log(`   Exemplo ID: ${items[0].id} | Status: ${items[0].status} | Date: ${items[0].service_date || items[0].scheduled_date}`);
    }
  }
}

investigate();
