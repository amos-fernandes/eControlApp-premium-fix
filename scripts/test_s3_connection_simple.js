const axios = require('axios');

const AWS_CONFIG = {
  accessKeyId: 'AKIA6AYP5D5ZAQ7K5NGO', 
  secretAccessKey: '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', 
  region: 'us-east-2',
  bucketName: 'bkt-econtrole', 
  folderName: 'imagens-econtole',
};

async function testS3Connection() {
  console.log('🔍 Testando conexão com AWS S3...');
  
  try {
    // Teste 1: Verificar se o bucket é acessível (usando HEAD request)
    console.log('1️⃣  Testando acessibilidade do bucket...');
    const bucketUrl = `https://${AWS_CONFIG.bucketName}.s3.${AWS_CONFIG.region}.amazonaws.com`;
    
    const bucketResponse = await axios.head(bucketUrl);
    console.log('✅ Bucket acessível');
    
    // Teste 2: Verificar se a pasta existe
    console.log('2️⃣  Testando acesso à pasta imagens-econtole...');
    const folderUrl = `${bucketUrl}/${AWS_CONFIG.folderName}`;
    
    try {
      const folderResponse = await axios.head(folderUrl);
      console.log('✅ Pasta imagens-econtole existe');
    } catch (folderError) {
      if (folderError.response?.status === 404) {
        console.log('⚠️  Pasta imagens-econtole não existe (será criada automaticamente no primeiro upload)');
      } else {
        console.log('❌ Erro ao acessar pasta:', folderError.response?.status, folderError.response?.statusText);
      }
    }
    
    // Teste 3: Testar upload de um arquivo de teste
    console.log('3️⃣  Testando upload de arquivo de teste...');
    const testFileName = `test_connection_${Date.now()}.txt`;
    const testFileUrl = `${bucketUrl}/${AWS_CONFIG.folderName}/${testFileName}`;
    const testContent = 'Arquivo de teste para verificação de conectividade com AWS S3';
    
    const uploadResponse = await axios.put(testFileUrl, testContent, {
      headers: {
        'Content-Type': 'text/plain',
        'x-amz-acl': 'public-read',
      },
    });
    
    console.log('✅ Upload realizado com sucesso');
    console.log('   URL do arquivo:', testFileUrl);
    
    // Teste 4: Testar download do arquivo
    console.log('4️⃣  Testando download do arquivo...');
    const downloadResponse = await axios.get(testFileUrl);
    console.log('✅ Download realizado com sucesso');
    console.log('   Conteúdo:', downloadResponse.data);
    
    // Teste 5: Testar exclusão do arquivo
    console.log('5️⃣  Testando exclusão do arquivo...');
    const deleteResponse = await axios.delete(testFileUrl);
    console.log('✅ Arquivo deletado com sucesso');
    
    console.log('\n🎉 TODOS OS TESTES CONCLUÍDOS COM SUCESSO!');
    console.log('✅ Configuração AWS S3 está funcional');
    console.log('✅ Bucket:', AWS_CONFIG.bucketName);
    console.log('✅ Pasta:', AWS_CONFIG.folderName);
    console.log('✅ Região:', AWS_CONFIG.region);
    console.log('\n💡 Próximo passo: O build está em progresso e deve ser concluído em minutos');
    
  } catch (error) {
    console.log('\n❌ ERRO NOS TESTES:');
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

testS3Connection();
