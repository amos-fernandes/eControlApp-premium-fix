const axios = require('axios');
const aws4 = require('aws4');

const AWS_CONFIG = {
  accessKeyId: 'AKIA6AYP5D5ZAQ7K5NGO', 
  secretAccessKey: '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', 
  region: 'us-east-2',
  bucketName: 'bkt-econtrole', 
  folderName: 'imagens-econtole',
};

async function testAWS4Signature() {
  console.log('🔍 Testando upload com assinatura V4 usando aws4...');
  
  try {
    const testFileName = `test_aws4_${Date.now()}.txt`;
    const fullPath = `${AWS_CONFIG.folderName}/${testFileName}`;
    const testFileContent = 'Arquivo de teste para verificação de upload com aws4';
    
    const url = `https://${AWS_CONFIG.bucketName}.s3.${AWS_CONFIG.region}.amazonaws.com/${fullPath}`;
    
    // Create request options without ACL since bucket doesn't allow it
    const opts = {
      host: `${AWS_CONFIG.bucketName}.s3.${AWS_CONFIG.region}.amazonaws.com`,
      path: `/${fullPath}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: testFileContent,
    };
    
    // Sign the request
    aws4.sign(opts, {
      accessKeyId: AWS_CONFIG.accessKeyId,
      secretAccessKey: AWS_CONFIG.secretAccessKey,
    });
    
    console.log('1️⃣  Tentando upload para:', url);
    
    const response = await axios.put(url, testFileContent, {
      headers: opts.headers,
    });
    
    console.log('✅ Upload com assinatura V4 (aws4) realizado com sucesso!');
    console.log('   Status:', response.status);
    console.log('   Status Text:', response.statusText);
    console.log('   URL do arquivo:', url);
    
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

testAWS4Signature();
