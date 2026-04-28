const EMAIL = "supervisor@econtrole.com";
const PASSWORD = "devprod123";
const HOST = "https://testeaplicativo.econtrole.com";

const paths = [
  "/api/auth/sign_in",
  "/auth/sign_in",
  "/api/v1/auth/sign_in",
  "/v1/auth/sign_in",
  "/api/proxy/auth/sign_in"
];

async function test() {
  for (const path of paths) {
    console.log(`Testing ${HOST}${path}...`);
    try {
      const res = await fetch(`${HOST}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: EMAIL, password: PASSWORD })
      });
      console.log(`Result: ${res.status}`);
      if (res.ok) {
        console.log("✅ SUCCESS at " + path);
        const data = await res.json();
        console.log(JSON.stringify(data, null, 2));
        break;
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
  }
}

test();
