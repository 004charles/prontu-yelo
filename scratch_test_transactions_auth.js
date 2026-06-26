const devToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJkYXRhIjp7ImNsaWVudF9pZCI6Ijc4NmMzNjRiLTQ4ZjgtNDg5My1iNzUzLWYyMzY1ZjVlMWZmZiIsInRva2VuX2lkIjoiOTcyNzRlM2YtYWRkYi00YWVhLWEwNDYtZWRkYTYxYmM4MThiIiwidHlwZSI6InBheW1lbnQiLCJleHAiOiIyMDMwLTEyLTMwIDIzOjAwOjAwIn19._X6cSAht3AVgCDoJcKE5Sv5iDC6hjYX9cjsJATE3UmM";
const sessionToken =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhY2NvdW50X2lkIjoiNDMwOTkwMGQtM2U0Mi00ZDQzLThiOTEtOGRkOGU5YWQzYWQwIiwiZXhwIjoyMzgyNDIyMDI3fQ.YqiRkAgMxmBk82763OCqJfZF_lPxofaKsn8-tp24IF8";

async function testAuth(authValue) {
  const url = "https://api.prontu.io/v1/merchants/transactions";
  console.log(
    `Testing GET /merchants/transactions with Authorization: "${authValue.substring(0, 20)}..."`,
  );
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: authValue,
        Accept: "application/json",
      },
    });
    console.log(`Status: ${response.status} ${response.statusText}`);
    const text = await response.text();
    console.log(`Response: ${text.substring(0, 1000)}\n`);
  } catch (error) {
    console.log("Error:", error.message);
  }
}

async function main() {
  await testAuth(`Bearer ${devToken}`);
  await testAuth(devToken);
  await testAuth(`Bearer ${sessionToken}`);
  await testAuth(sessionToken);
}

main();
