import mongoose from 'mongoose';
import dns from 'node:dns';

// Error codes that indicate the DNS lookup itself failed (e.g. mobile-hotspot
// routers that refuse Node's c-ares SRV lookups for Atlas `mongodb+srv` URIs).
const DNS_ERROR_CODES = ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ENODATA', 'ESERVFAIL', 'ETIMEOUT', 'EDNSREFUSED'];

function isDnsError(err) {
  return DNS_ERROR_CODES.includes(err?.code) || /querySrv|getaddrinfo|dns/i.test(err?.message || '');
}

export default async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error('MONGO_URI is not set. Copy server/.env.example to server/.env and fill it.');
  }

  mongoose.set('strictQuery', true);
  const options = { serverSelectionTimeoutMS: 15000 };

  try {
    // First try with the system DNS resolver (works on most networks).
    const conn = await mongoose.connect(uri, options);
    console.log(`✅ MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    if (!isDnsError(err)) throw err;

    // Some networks (often mobile hotspots) refuse the SRV/TXT lookups that
    // Atlas connection strings need. Retry once with public DNS resolvers.
    try {
      const servers = process.env.DNS_SERVERS
        ? process.env.DNS_SERVERS.split(',').map((s) => s.trim())
        : ['8.8.8.8', '1.1.1.1'];
      dns.setServers(servers);
      console.log(`🌐 DNS lookup failed (${err.code}), retrying with: ${servers.join(', ')}`);
      const conn = await mongoose.connect(uri, options);
      console.log(`✅ MongoDB connected: ${conn.connection.host}`);
      return conn;
    } catch {
      // Invalid DNS_SERVERS value or the retry also failed — surface the original error.
      throw err;
    }
  }
}
