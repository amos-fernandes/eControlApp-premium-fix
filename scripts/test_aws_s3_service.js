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
  console.log('🔍 Testando serviço AWS S3...');
  
  const testFileName = 'test_service_' + Date.now() + '.txt';
  const fullPath = AWS_CONFIG.folderName + '/' + testFileName;
  const testContent = 'Teste do serviço AWS S3 para o app eControle';
  
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
    
    console.log('✅ Upload realizado com sucesso!');
    console.log('📁 Arquivo:', testFileName);
    console.log('🌐 URL:', url);
    console.log('🎯 Status:', response.status);
    
    // Test download
    const downloadResponse = await axios.get(url);
    console.log('✅ Download realizado com sucesso!');
    console.log('📄 Conteúdo:', downloadResponse.data);
    
    // Test delete
    const deleteOpts = {
      host: opts.host,
      path: opts.path,
      method: 'DELETE',
      headers: {},
    };
    
    aws4.sign(deleteOpts, {
      accessKeyId: AWS_CONFIG.accessKeyId,
      secretAccessKey: AWS_CONFIG.secretAccessKey,
    });
    
    await axios.delete(url, {
      headers: deleteOpts.headers,
    });
    
    console.log('✅ Arquivo deletado com sucesso!');
    console.log('🎉 TODOS OS TESTES CONCLUÍDOS!');
    
  } catch (error) {
    console.error('❌ ERRO:', error.response?.status, error.response?.statusText);
    if (error.response?.data) {
      console.error('📦 Dados:', error.response.data);
    }
  }
}

test();
