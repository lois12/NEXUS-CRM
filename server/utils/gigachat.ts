import https from 'https';
import crypto from 'crypto';
import { GIGACHAT_API_KEY } from '../config';

// TLS verification disabled only for GigaChat API (self-signed cert)
const gigachatAgent = new https.Agent({ rejectUnauthorized: false });

export function httpsRequest(options: https.RequestOptions, body?: string): Promise<{ status: number; headers: any; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const opts = { ...options, agent: options.agent || gigachatAgent };
    const req = https.request(opts, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({ status: res.statusCode || 0, headers: res.headers, body: Buffer.concat(chunks) });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

export async function getGigaChatToken(): Promise<string> {
  const res = await httpsRequest({
    hostname: 'ngw.devices.sberbank.ru',
    port: 9443,
    path: '/api/v2/oauth',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'Authorization': 'Basic ' + GIGACHAT_API_KEY,
      'RqUID': crypto.randomUUID(),
    },
  }, 'scope=GIGACHAT_API_PERS');

  if (res.status !== 200) {
    throw new Error(`OAuth failed: ${res.status} ${res.body.toString().substring(0, 200)}`);
  }

  const json = JSON.parse(res.body.toString());
  if (!json.access_token) {
    throw new Error('No access_token in response');
  }
  return json.access_token;
}