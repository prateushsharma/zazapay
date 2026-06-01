export function validateEnv(): void {
  const required = [
    "PRIVATE_KEY_AGENT_A",
    "PRIVATE_KEY_AGENT_B",
    "STREAMS_PRIVATE_KEY",
  ];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}\n` +
        `Copy .env.example to .env and populate all values.`
    );
  }
}
