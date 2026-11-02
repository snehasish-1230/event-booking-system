const assert = require("node:assert/strict");
const express = require("express");
const configureCors = require("./config/cors");
const { globalLimiter } = require("./middlewares/rateLimiter");
const authRoutes = require("./routes/authRoutes");

const frontendOrigins = [
  "https://event-booking-system-bc862y17v-ff-team8.vercel.app",
];
const app = express();

configureCors(app, {
  nodeEnv: "production",
  clientUrl: frontendOrigins.join(","),
});

app.use(express.json());
app.use("/api", globalLimiter);
app.use("/api/auth", authRoutes);

const server = app.listen(0, "127.0.0.1");

const run = async () => {
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    for (const frontendOrigin of frontendOrigins) {
      for (const endpoint of ["/api/auth/register", "/api/auth/login"]) {
        const preflight = await fetch(`${baseUrl}${endpoint}`, {
          method: "OPTIONS",
          headers: {
            Origin: frontendOrigin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "authorization,content-type",
          },
        });

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

        const response = await fetch(`${baseUrl}${endpoint}`, {
          method: "POST",
          headers: {
            Origin: frontendOrigin,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        assert.equal(response.status, 400);
        assert.equal(
          response.headers.get("access-control-allow-origin"),
          frontendOrigin,
        );
      }
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

    const developmentApp = express();
    configureCors(developmentApp, {
      nodeEnv: "development",
      clientUrl: "",
    });
    const developmentServer = developmentApp.listen(0, "127.0.0.1");
    await new Promise((resolve) => developmentServer.once("listening", resolve));
    const developmentAddress = developmentServer.address();
    const developmentBaseUrl = `http://127.0.0.1:${developmentAddress.port}`;

    try {
      for (const origin of ["http://localhost:5173", "http://localhost:5175"]) {
        const preflight = await fetch(`${developmentBaseUrl}/api/auth/login`, {
          method: "OPTIONS",
          headers: {
            Origin: origin,
            "Access-Control-Request-Method": "POST",
          },
        });
        assert.equal(preflight.status, 204);
        assert.equal(preflight.headers.get("access-control-allow-origin"), origin);
      }
    } finally {
      await new Promise((resolve, reject) =>
        developmentServer.close((error) =>
          error ? reject(error) : resolve(),
        ),
      );
    }

    console.log(
      "CORS tests passed: production and localhost origins can preflight; untrusted production origin is blocked.",
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
