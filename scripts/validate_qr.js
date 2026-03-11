// scripts/validate_qr.js
// Lightweight validator for QR parsing and domain normalization used by the app.

function base64Decode(input) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = input.replace(/=+$/, '');
  let output = '';

  if (str.length % 4 === 1) return input;

  for (let bc = 0, bs = 0, buffer, i = 0; (buffer = str.charAt(i++));) {
    buffer = chars.indexOf(buffer);
    if (buffer === -1) return input;

    bs = bc % 4 ? bs * 64 + buffer : buffer;
    if (bc++ % 4) {
      output += String.fromCharCode(255 & (bs >> ((-2 * bc) & 6)));
    }
  }

  return output;
}

function decoded(tenant) {
  if (!tenant || !tenant.domain) return '';
  try {
    const decodedValue = base64Decode(tenant.domain);
    if (/^[\x20-\x7E]*$/.test(decodedValue) && decodedValue.length > 0) return decodedValue;
  } catch (e) {}
  return tenant.domain;
}

function extractFromScanned(data) {
  let extracted = data;
  try {
    const urlObj = new URL(data);
    const params = new URLSearchParams(urlObj.search);
    if (params.has('url')) {
      const decoded = decodeURIComponent(params.get('url') || '');
      if (decoded) extracted = decoded;
    }
  } catch (err) {
    // not a full URL
  }
  return extracted.trim();
}

function normalizeDomainFromStored(parsedSession) {
  if (!parsedSession || !parsedSession.domain) return { status: 404 };
  let domain = parsedSession.domain;

  if (domain.includes('expo-development-client') || domain.includes('192.168') || domain.includes('8081')) {
    return { status: 400, data: 'INVALID_URL_METRO' };
  }

  if (domain.startsWith('http://') || domain.startsWith('https://')) {
    domain = domain.replace(/\/login\/?$/, '');
    domain = domain.replace(/\/$/, '');
    if (!domain.endsWith('/api')) domain = domain + '/api';
    return { status: 200, data: domain };
  }

  const decodedValue = decoded(parsedSession);
  const isPrintable = /^[\x20-\x7E]*$/.test(decodedValue);
  const finalSubdomain = isPrintable && decodedValue ? decodedValue : domain;

  const finalUrl = 'https://' + finalSubdomain + '.econtrole.com/api';
  return { status: 200, data: finalUrl };
}

const tests = [
  { name: 'Full HTTPS URL with /login', input: 'https://cliente.econtrole.com/login', expected: 'https://cliente.econtrole.com/api' },
  { name: 'Full HTTPS URL with trailing slash', input: 'https://cliente.econtrole.com/', expected: 'https://cliente.econtrole.com/api' },
  { name: 'Full HTTP URL without api', input: 'http://cliente.econtrole.com', expected: 'http://cliente.econtrole.com/api' },
  { name: 'Expo dev-client deep link containing url param', input: 'exp+econtrole://expo-development-client/?url=http%3A%2F%2F192.168.1.203%3A8081', expected: { status: 400 } },
  { name: 'Direct short domain (subdomain)', input: 'mytenant123', expectedContains: '.econtrole.com/api' },
  { name: 'Base64 encoded domain', input: (function(){ const b = Buffer.from('mytenant').toString('base64'); return b; })(), expectedContains: '.econtrole.com/api' },
  { name: 'QR short path that redirects (qrco)', input: 'https://qrco.de/bgXkgO/api', expected: 'https://qrco.de/bgXkgO/api' },
];

console.log('Running QR/domain normalization tests...');
for (const t of tests) {
  console.log('\n-- ' + t.name + ' --');
  const extracted = extractFromScanned(t.input);
  console.log('Scanned:', t.input);
  console.log('Extracted:', extracted);

  const parsedSession = { domain: extracted };
  const normalized = normalizeDomainFromStored(parsedSession);
  console.log('Normalized:', normalized);

  if (t.expected) {
    if (typeof t.expected === 'string') {
      if (normalized.data === t.expected) console.log('OK'); else console.log('FAIL (expected', t.expected, ')');
    } else if (typeof t.expected === 'object' && t.expected.status) {
      if (normalized.status === t.expected.status) console.log('OK'); else console.log('FAIL (expected status', t.expected.status, ')');
    }
  } else if (t.expectedContains) {
    if (normalized.data && normalized.data.indexOf(t.expectedContains) !== -1) console.log('OK'); else console.log('FAIL (expected contains', t.expectedContains, ')');
  }
}

console.log('\nDone.');
