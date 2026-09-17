import crypto from "crypto";

const STUN_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];

function configuredUrls() {
  return [
    process.env.TURN_SERVER_URL,
    ...(process.env.TURN_SERVER_URLS || "").split(","),
  ].map(value => String(value || "").trim()).filter(Boolean);
}

function coturnCredentials() {
  const urls = configuredUrls();
  const sharedSecret = String(process.env.TURN_SECRET || "").trim();
  const baseUsername = String(process.env.TURN_USERNAME || "").trim();
  const password = String(process.env.TURN_PASSWORD || "").trim();

  if (!urls.length) return [];
  if (sharedSecret && baseUsername) {
    const expiry = Math.floor(Date.now() / 1000) + 3600;
    const username = `${expiry}:${baseUsername}`;
    const credential = crypto.createHmac("sha1", sharedSecret).update(username).digest("base64");
    return urls.map(url => ({ urls: url, username, credential }));
  }
  return urls.map(url => ({
    urls: url,
    ...(baseUsername ? { username: baseUsername } : {}),
    ...(password ? { credential: password } : {}),
  }));
}

function cloudTurnServers() {
  const urls = [
    process.env.CLOUD_TURN_SERVER_URL,
    ...(process.env.CLOUD_TURN_SERVER_URLS || "").split(","),
  ].map(value => String(value || "").trim()).filter(Boolean);
  const username = String(process.env.CLOUD_TURN_USERNAME || "").trim();
  const credential = String(process.env.CLOUD_TURN_CREDENTIAL || "").trim();
  return urls.map(url => ({
    urls: url,
    ...(username ? { username } : {}),
    ...(credential ? { credential } : {}),
  }));
}

export function getIceServers() {
  const provider = String(process.env.TURN_PROVIDER || "coturn").trim().toLowerCase();
  const providerServers = provider === "cloud" || provider === "cloudflare"
    ? cloudTurnServers()
    : coturnCredentials();
  return [...STUN_SERVERS, ...providerServers];
}

export function hasTurnConfiguration() {
  return getIceServers().length > STUN_SERVERS.length;
}