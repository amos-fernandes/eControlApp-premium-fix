const axios = require('axios');
const fs = require('fs');
const path = require('path');

const AWS_CONFIG = {
  accessKeyId: 'AKIA6AYP5D5ZAQ7K5NGO', 
  secretAccessKey: '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', 
  region: 'us-east-2',
  bucketName: 'bkt-econtrole', 
  folderName: 'imagens-econtole',
};

async function testS3Upload() {
  console.log('🔍 Testando upload direto para AWS S3...');
  
  try {
    // Teste: Upload de um arquivo de teste
    const testFileName = `test_upload_${Date.now()}.txt`;
    const testFileContent = 'Arquivo de teste para verificação de upload com AWS S3';
    const testFilePath = path.join(__dirname, testFileName);
    
    // Criar arquivo temporário
    fs.writeFileSync(testFilePath, testFileContent);
    
    // URL para upload
    const s3Url = `https://${AWS_CONFIG.bucketName}.s3.${AWS_CONFIG.region}.amazonaws.com/${AWS_CONFIG.folderName}/${testFileName}`;
    
    console.log('1️⃣  Tentando upload para:', s3Url);
    
    const fileContent = fs.readFileSync(testFilePath);
    
    const response = await axios.put(s3Url, fileContent, {
      headers: {
        'Content-Type': 'text/plain',
        'x-amz-acl': 'public-read',
      },
    });
    
    console.log('✅ Upload realizado com sucesso!');
    console.log('   Status:', response.status);
    console.log('   Status Text:', response.statusText);
    console.log('   URL do arquivo:', s3Url);
    
    // Limpar arquivo local
    fs.unlinkSync(testFilePath);
    
    console.log('\n🎉 UPLOAD TESTE CONCLUÍDO COM SUCESSO!');
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

testS3Upload();
