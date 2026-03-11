const axios = require('axios');
const aws4 = require('aws4');

const AWS_CONFIG = {
  accessKeyId: 'AKIA6AYP5D5ZAQ7K5NGO', 
  secretAccessKey: '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', 
  region: 'us-east-2',
  bucketName: 'bkt-econtrole', 
  folderName: 'imagens-econtole',
};

async function test() {
  console.log('🔍 Testando upload para AWS S3...');
  
  const testFileName = 'test_build_' + Date.now() + '.txt';
  const fullPath = AWS_CONFIG.folderName + '/' + testFileName;
  const testContent = 'Teste para verificar se o upload está funcionando no build ' + Date.now();
  
  const url = 'https://' + AWS_CONFIG.bucketName + '.s3.' + AWS_CONFIG.region + '.amazonaws.com/' + fullPath;
  
  const opts = {
    host: AWS_CONFIG.bucketName + '.s3.' + AWS_CONFIG.region + '.amazonaws.com',
    path: '/' + fullPath,
    method: 'PUT',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: testContent,
  };
  
  aws4.sign(opts, {
    accessKeyId: AWS_CONFIG.accessKeyId,
    secretAccessKey: AWS_CONFIG.secretAccessKey,
  });
  
  try {
    const response = await axios.put(url, testContent, {
      headers: opts.headers,
    });
    
    console.log('✅ UPLOAD REALIZADO COM SUCESSO!');
    console.log('📁 Arquivo:', testFileName);
    console.log('🌐 URL:', url);
    console.log('🎯 Status:', response.status);
    console.log('🎉 Upload para AWS S3 está funcionando perfeitamente!');
    
  } catch (error) {
    console.error('❌ ERRO NO UPLOAD:', error.response?.status, error.response?.statusText);
    if (error.response?.data) {
      console.error('📦 Dados:', error.response.data);
    }
  }
}

test();
