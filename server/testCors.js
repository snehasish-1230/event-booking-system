const assert = require("node:assert/strict");
const express = require("express");
const configureCors = require("./config/cors");
const authRoutes = require("./routes/authRoutes");

const frontendOrigins = [
  "https://event-booking-system-72d4425dq-ff-team8.vercel.app",
  "https://event-booking-system-3jw3p0uq2-ff-team8.vercel.app",
  "https://event-booking-system-xi-two.vercel.app",
];
const app = express();

configureCors(app, {
  nodeEnv: "production",
  clientUrl: frontendOrigins.join(","),
});

app.use(express.json());
app.use("/api/auth", authRoutes);

const server = app.listen(0, "127.0.0.1");

const run = async () => {
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    for (const frontendOrigin of frontendOrigins) {
      const preflight = await fetch(
        `${baseUrl}/api/auth/register`,
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
        `${baseUrl}/api/auth/register`,
        {
          method: "POST",
          headers: {
            Origin: frontendOrigin,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );

      assert.equal(registration.status, 400);
      assert.equal(
        registration.headers.get("access-control-allow-origin"),
        frontendOrigin,
      );
    }

    const blockedPreflight = await fetch(`${baseUrl}/api/auth/register`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://untrusted.example",
        "Access-Control-Request-Method": "POST",
      },
    });

    assert.equal(blockedPreflight.status, 403);
    assert.equal(blockedPreflight.headers.get("access-control-allow-origin"), null);

    console.log(
      "CORS tests passed: both production origins can preflight and reach registration validation; untrusted origin is blocked.",
    );
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
