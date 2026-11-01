const assert = require("node:assert/strict");
const express = require("express");
const configureCors = require("./config/cors");
const eventRoutes = require("./routes/eventRoutes");

const frontendOrigin = "https://event-booking-system-xi-two.vercel.app";
const app = express();

configureCors(app, {
  nodeEnv: "production",
  clientUrl: frontendOrigin,
});

app.use("/api/events", eventRoutes);

const server = app.listen(0, "127.0.0.1");

const run = async () => {
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    const preflight = await fetch(
      `${baseUrl}/api/events/000000000000000000000000/register`,
      {
        method: "OPTIONS",
        headers: {
          Origin: frontendOrigin,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization,content-type",
        },
      },
    );

    assert.equal(preflight.status, 204);
    assert.equal(
      preflight.headers.get("access-control-allow-origin"),
      frontendOrigin,
    );
    assert.match(preflight.headers.get("access-control-allow-methods"), /POST/);
    assert.match(
      preflight.headers.get("access-control-allow-headers"),
      /Authorization/i,
    );
    assert.equal(preflight.headers.get("access-control-allow-credentials"), null);

    const registration = await fetch(
      `${baseUrl}/api/events/000000000000000000000000/register`,
      {
        method: "POST",
        headers: {
          Origin: frontendOrigin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );

    assert.equal(registration.status, 401);
    assert.equal(
      registration.headers.get("access-control-allow-origin"),
      frontendOrigin,
    );

    const blockedPreflight = await fetch(`${baseUrl}/api/events/test/register`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://untrusted.example",
        "Access-Control-Request-Method": "POST",
      },
    });

    assert.equal(blockedPreflight.status, 403);
    assert.equal(blockedPreflight.headers.get("access-control-allow-origin"), null);

    console.log("CORS tests passed: allowed registration preflight/request and blocked origin.");
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
