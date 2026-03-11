const axios = require('axios');
const crypto = require('crypto-js');

const AWS_CONFIG = {
  accessKeyId: 'AKIA6AYP5D5ZAQ7K5NGO', 
  secretAccessKey: '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', 
  region: 'us-east-2',
  bucketName: 'bkt-econtrole', 
  folderName: 'imagens-econtole',
};

// Helper function to create AWS V4 signature with correct AWS timestamp format
const createSignature = (method, path, headers, body, timestamp) => {
  const date = timestamp.split('T')[0];
  
  const canonicalUri = encodeURIComponent(path).replace(/%2F/g, '/');
  const canonicalQuery = '';
  const canonicalHeaders = Object.keys(headers)
    .sort()
    .map(key => `${key.toLowerCase()}:${headers[key]}`)
    .join('\n');
  const signedHeaders = Object.keys(headers)
    .sort()
    .map(key => key.toLowerCase())
    .join(';');
  
  const payloadHash = crypto.SHA256(body || '').toString(crypto.enc.Hex);
  
  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuery,
    canonicalHeaders + '\n',
    signedHeaders,
    payloadHash
  ].join('\n');
  
  const credentialScope = `${date}/${AWS_CONFIG.region}/s3/aws4_request`;
  const canonicalRequestHash = crypto.SHA256(canonicalRequest).toString(crypto.enc.Hex);
  const stringToSign = `AWS4-HMAC-SHA256\n${timestamp}\n${credentialScope}\n${canonicalRequestHash}`;
  
  const kDate = crypto.HmacSHA256(date, 'AWS4' + AWS_CONFIG.secretAccessKey);
  const kRegion = crypto.HmacSHA256(AWS_CONFIG.region, kDate);
  const kService = crypto.HmacSHA256('s3', kRegion);
  const kSigning = crypto.HmacSHA256('aws4_request', kService);
  
  const signature = crypto.HmacSHA256(stringToSign, kSigning).toString(crypto.enc.Hex);
  
  return {
    signature,
    credentialScope,
    signedHeaders,
    timestamp
  };
};

// Generate AWS format timestamp: YYYYMMDDTHHMMSSZ
function getAWSDate() {
  const now = new Date();
  const pad = (n) => n.toString().padStart(2, '0');
  
  return (
    `${now.getUTCFullYear()}` +
    `${pad(now.getUTCMonth() + 1)}` +
    `${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}` +
    `${pad(now.getUTCMinutes())}` +
    `${pad(now.getUTCSeconds())}Z`
  );
}

async function testSignatureBasedUpload() {
  console.log('🔍 Testando upload com assinatura V4 para AWS S3...');
  
  try {
    const testFileName = `test_signature_${Date.now()}.txt`;
    const fullPath = `${AWS_CONFIG.folderName}/${testFileName}`;
    const testFileContent = 'Arquivo de teste para verificação de upload com assinatura V4';
    
    const timestamp = getAWSDate();
    
    const headers = {
      'Host': `${AWS_CONFIG.bucketName}.s3.${AWS_CONFIG.region}.amazonaws.com`,
      'x-amz-date': timestamp,
      'x-amz-content-sha256': crypto.SHA256(testFileContent).toString(crypto.enc.Hex),
      'x-amz-acl': 'public-read',
      'Content-Type': 'text/plain',
    };
    
    const signatureInfo = createSignature('PUT', fullPath, headers, testFileContent, timestamp);
    
    headers['Authorization'] = `AWS4-HMAC-SHA256 Credential=${AWS_CONFIG.accessKeyId}/${signatureInfo.credentialScope}, SignedHeaders=${signatureInfo.signedHeaders}, Signature=${signatureInfo.signature}`;
    
    const s3Url = `https://${AWS_CONFIG.bucketName}.s3.${AWS_CONFIG.region}.amazonaws.com/${fullPath}`;
    
    console.log('1️⃣  Tentando upload para:', s3Url);
    console.log('2️⃣  Timestamp:', timestamp);
    
    const response = await axios.put(s3Url, testFileContent, {
      headers,
    });
    
    console.log('✅ Upload com assinatura V4 realizado com sucesso!');
    console.log('   Status:', response.status);
    console.log('   Status Text:', response.statusText);
    console.log('   URL do arquivo:', s3Url);
    
    console.log('\n🎉 UPLOAD TESTE CONCLUÍDO COM SUCESSO!');
    console.log('✅ Assinatura V4 está funcionando');
    console.log('✅ Configuração AWS S3 está funcional');
    console.log('✅ Bucket:', AWS_CONFIG.bucketName);
    console.log('✅ Pasta:', AWS_CONFIG.folderName);
    console.log('✅ Região:', AWS_CONFIG.region);
    
  } catch (error) {
    console.log('\n❌ ERRO NO UPLOAD:');
    if (error.response) {
      console.log(`Status: ${error.response.status}`);
      console.log(`Mensagem: ${error.response.statusText}`);
      console.log(`Dados:`, error.response.data);
    } else if (error.request) {
      console.log('Nenhuma resposta recebida do servidor');
    } else {
      console.log('Erro de configuração:', error.message);
    }
  }
}

testSignatureBasedUpload();
