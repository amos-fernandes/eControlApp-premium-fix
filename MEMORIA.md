# MEMORIA: eControlApp - Correção de Erros

## Contexto
Este arquivo documenta todas as interações e correções realizadas para resolver problemas no eControlApp. O objetivo principal é garantir que as ordens de serviço sejam carregadas corretamente e que a autenticação funcione de acordo com o padrão do eControle Pro.

## Data de Início
2024-06-08

## Perfil do Assistente
- **Identidade**: Ed
- **Especialidades**: React Native, TypeScript, Node.js, Expo CLI, Java
- **Experiência**: Ph.D. em React Native
- **Missão**: Corrigir bugs e implementar funcionalidades no eControlApp

## Problemas Identificados e Soluções Aplicadas

---

### 1. Erro 401 Unauthorized ao Buscar Ordens de Serviço
**Causa**: O token de autenticação não estava sendo transmitido corretamente para o servidor.
**Solução**:
- Ajuste no `AuthContext.tsx`: Garantir que a URL base sempre termine com `/api`
- Alinhamento do `AUTH_PATHS` para usar `/auth/sign_in` como endpoint padrão (igual ao Pro app)

---

### 2. Erro de Parse JSON: "Unexpected token < in JSON at position 0"
**Causa**: O servidor estava retornando HTML (página de login) em vez de JSON.
**Solução**:
- Tratamento defensivo no `fetchServiceOrders` para verificar o `content-type` da resposta
- Garantir que a URL base sempre inclua `/api` antes de fazer requisições

---

### 3. Erro: "Cannot update a component while rendering another component"
**Causa**: O `handleError` estava chamando `logout` diretamente durante o render.
**Solução**:
- Uso de `useEffect` no `index.tsx` para chamar o `handleError` após o render

---

### 4. Erro: "Cannot read property 'id' of null"
**Causa**: Os arrays de dados contavam com valores `null` ou `undefined`.
**Soluções**:
- Adicionar tratamento defensivo nas funções auxiliares: `hasVoyage`, `getVoyageName`, `getRouteName`
- Filtrar valores nulos nas telas de:
  - Principal (`index.tsx`)
  - Viagens (`voyages.tsx`)
  - Rotas (`routes.tsx`)

---

### 5. Erro: "Encountered two children with the same key"
**Causa**: Ordens de serviço com `id` undefined ou duplicado.
**Solução**:
- Melhoria no `keyExtractor` do FlatList para usar índice como fallback
- Tratamento defensivo para garantir que `o.id` não seja undefined

---

## Arquivos Modificados
1. `auth.tsx` - Ajustes no endpoint de login e URL base
2. `api.ts` - Melhoria no tratamento de respostas API e funções auxiliares
3. `index.tsx` - Tratamento de erros e filtragem de valores nulos
4. `voyages.tsx` - Filtragem de valores nulos e tratamento defensivo
5. `routes.tsx` - Filtragem de valores nulos e tratamento defensivo

## Debugging Adicionado
- Logs detalhados no `fetchServiceOrders` para verificar o tipo e a estrutura da resposta API
- Verificação do `content-type` das respostas
- Filtragem de itens inválidos (null/undefined) antes do processamento

## Testes Realizados
- Requisição para `/api/auth/sign_in` com credenciais válidas: Funcionou
- Requisição para `/api/service_orders` com token válido: Funcionou
- Verificação da resposta da API: Retorna 20 ordens de serviço no formato esperado

## Credenciais de Teste
- **Email**: suporte@econtrole.com
- **Senha**: ecomotoapp
- **URL Base**: https://gsambientais.econtrole.com/api

## Conclusão
O app agora está funcionando corretamente:
- Autenticação com Devise Token Auth
- Carregamento das ordens de serviço com tratamento de erros
- Navegação entre telas (Principal, Viagens, Rotas)
- Tratamento defensivo para valores nulos e erros de API

---

## Próximos Passos
- Monitorar os logs para identificar quaisquer outros erros
- Testar a funcionalidade de logout e relogin
- Verificar a performance do app com um número maior de ordens de serviço

## Histórico de Versões
- **v1.0**: Primeira correção - Autenticação e carregamento de ordens
- **v1.1**: Melhoria no tratamento de erros e valores nulos
- **v1.2**: Debugging e filtragem de dados inválidos
- **v1.3**: Correção da estrutura de dados da API (customer.name e address.to_s)

---

## v1.3 - Correção da Estrutura de Dados da API (2026-03-06)

### Problema
- **Erro**: "Objects are not valid as a React child" ao renderizar endereço
- **Erro**: "Cliente não informado" mesmo com dados disponíveis
- **Erro**: "Erro ao carregar OS" ao clicar em uma ordem de serviço

### Causa
A API retorna a estrutura de dados em formatos diferentes do esperado:
- **Cliente**: Está em `order.customer.name` (objeto), não em `order.client_name` (string)
- **Endereço**: Está em `order.address.to_s` (string formatada), não em `order.address.name`

### Estrutura Real da API
```json
{
  "id": 34724,
  "status": "scheduled",
  "voyage": { "id": 5275, "name": "07/04 - ROTA S2A" },
  "customer": {
    "name": "CLARUS ODONTOLOGIA ESPECIALIZADA LTDA",
    "document_value": "44769322000175"
  },
  "address": {
    "name": null,
    "to_s": "Rua Camilo Scurço, n° 428, Vila Figueira, Suzano - São Paulo (08.676-140)",
    "zone": "S2A"
  },
  "service_executions": [...]
}
```

### Solução
1. **Atualizada interface `ServiceOrder`** em `services/api.ts`:
   - Adicionado campo `customer?: { name?: string; document_value?: string }`
   - Adicionado campo `so_type?: string`
   - Adicionado campo `service_date?: string`
   - Adicionado campo `identifier?: string`
   - Atualizado `address` para aceitar `to_s` e `name` como null

2. **Criadas novas funções auxiliares** em `services/api.ts`:
   - `getAddressName()`: Retorna `address.to_s` ou `address.name`
   - `getClientName()`: Retorna `customer.name` ou `client_name` ou `cliente_nome`

3. **Atualizados componentes**:
   - `ServiceOrderCard.tsx`: Usa `getClientName()` e `getAddressName()`
   - `app/order/[id].tsx`: Usa `getClientName()` e `getAddressName()`
   - `app/(tabs)/index.tsx`: Usa `getClientName()` na busca local

### Arquivos Modificados
1. `services/api.ts` - Interface e funções auxiliares atualizadas
2. `components/ServiceOrderCard.tsx` - Usa funções auxiliares corretas
3. `app/order/[id].tsx` - Usa funções auxiliares corretas
4. `app/(tabs)/index.tsx` - Usa `getClientName()` na busca

### Testes Realizados
- ✅ Carregamento de ordens de serviço: Funcionando
- ✅ Exibição do nome do cliente: Correto
- ✅ Exibição do endereço: Correto
- ✅ Navegação para detalhes da OS: Funcionando

### Credenciais de Teste
- **Email**: suporte@econtrole.com
- **Senha**: ecomotoapp
- **URL Base**: https://gsambientais.econtrole.com/api

---

## v1.4 - Funcionalidade de Coleta e Conferência (2026-03-06)

### Nova Funcionalidade
Implementada tela completa de coleta de dados no local do cliente, com envio para conferência.

### Problema Resolvido
Anteriormente, não havia como registrar os dados da coleta no local:
- Peso dos resíduos coletados
- Equipamentos coletados/emprestados
- Horários de chegada/saída
- Quilometragem
- Certificado/Memo
- Observações do motorista

### Solução Implementada

#### 1. Nova Tela: `app/order/update.tsx`
Tela completa de coleta com:
- **Pesagem de Serviços**: Input de peso para cada serviço da OS
- **Equipamentos Coletados**: Checkbox para selecionar equipamentos retirados
- **Equipamentos Emprestados**: Checkbox para selecionar equipamentos deixados no cliente
- **Horários**: Registro de chegada e saída
- **Quilometragem**: KM inicial e final
- **Certificado/Memo**: Campo para número do certificado
- **Observações**: Campo de texto para observações do motorista
- **Botão "Enviar para Conferência"**: Envia todos os dados para o servidor

#### 2. Atualizações na Tela de Detalhes (`app/order/[id].tsx`)
- Adicionado botão **"Iniciar Coleta"** ao lado do botão "Emitir MTR"
- Layout de ações com dois botões lado a lado
- Navegação para tela de atualização

#### 3. API
- Função `finishServiceOrder()` já existia, usada para enviar dados de conferência
- Endpoint: `POST /api/service_orders/:id/finish`

### Estrutura de Dados Enviada
```json
{
  "arrival_date": "2026-03-06T14:30:00.000Z",
  "departure_date": "2026-03-06T15:45:00.000Z",
  "start_km": "125000",
  "end_km": "125045",
  "certificate_memo": "CERT-12345",
  "driver_observations": "Cliente solicitou...",
  "collected_equipment": [
    { "id": 1, "name": "Descarpack 3L", "serial": "ABC123" }
  ],
  "lended_equipment": [
    { "id": 2, "name": "Bombona", "serial": "XYZ789" }
  ],
  "service_executions": [
    {
      "id": 75620,
      "service_id": 5,
      "amount": 15.5,
      "service_item_weights": null
    }
  ]
}
```

### Arquivos Criados/Modificados
1. `app/order/update.tsx` - **Novo**: Tela de coleta e conferência
2. `app/order/[id].tsx` - Adicionado botão "Iniciar Coleta"
3. `MEMORIA.md` - Documentada nova funcionalidade

### Fluxo de Uso
1. Usuário abre detalhes da OS
2. Clica em **"Iniciar Coleta"**
3. Preenche:
   - Peso de cada serviço
   - Seleciona equipamentos coletados/emprestados
   - Registra horários
   - Preenche KM, certificado, observações
4. Clica em **"Enviar para Conferência"**
5. Dados são enviados para API
6. Retorna para tela anterior com OS atualizada

### Próximos Passos
- [ ] Implementar captura de foto obrigatória antes de enviar
- [ ] Validar campos obrigatórios antes de enviar
- [ ] Persistir dados localmente (SQLite) para modo offline

---

## v1.5 - MTR e Google Maps na Coleta (2026-03-06)

### Novas Funcionalidades

#### 1. Botão "Emitir MTR" na Tela de Coleta
- Adicionado botão **"Emitir MTR"** no rodapé da tela de coleta
- MTR deve ser emitido **antes** de enviar para conferência
- Feedback visual com animação e haptics
- Badge "MTR Emitido" aparece após emissão bem-sucedida

#### 2. Integração com Google Maps
- Card de endereço na tela de coleta com botão **"Abrir Mapa"**
- Ao clicar, abre Google Maps com:
  - **Coordenadas** (latitude/longitude) se disponíveis
  - **Endereço formatado** como fallback
- URL universal: `https://www.google.com/maps/search/?api=1&query=...`

### Interface da Tela de Coleta Atualizada

**Card de Endereço:**
```
┌────────────────────────────────────────┐
│ 📍 Endereço                            │
│    Rua Ana Maria Martinez, n° 180      │
│    Assunção, São Bernardo do Campo     │
│                    [🔗 Abrir Mapa]     │
└────────────────────────────────────────┘
```

**Rodapé com Ações:**
```
┌────────────────────────────────────────┐
│  [📄 Emitir MTR]                       │
│  [✓ Enviar para Conferência]           │
└────────────────────────────────────────┘
```

### Arquivos Modificados
1. `app/order/update.tsx`:
   - Adicionado botão "Emitir MTR"
   - Adicionado card de endereço com botão "Abrir Mapa"
   - Implementado `handleOpenMap()` com Linking
   - Implementado `handleEmitMTR()` com confirmação

### Fluxo Completo Atualizado
1. Detalhes da OS → **"Iniciar Coleta"**
2. Preenche pesos, equipamentos, horários, KM, etc.
3. **Opcional**: Clica em **"Emitir MTR"** → Confirma → MTR emitido
4. **Opcional**: Clica no **endereço** → Abre Google Maps
5. Clica em **"Enviar para Conferência"** → Dados enviados

### Credenciais de Teste
- **Email**: suporte@econtrole.com
- **Senha**: ecomotoapp
- **URL Base**: https://gsambientais.econtrole.com/api