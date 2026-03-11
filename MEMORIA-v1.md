# MEMORIA: eControlApp - Documentação Completa v1.6.0

## 📋 Visão Geral
**eControlApp** - Aplicativo React Native para gestão de ordens de serviço da eControle Pro.

**Data**: 2026-03-11 (Última atualização)
**Versão Atual**: 1.6.2-pre
**Status**: ✅ Funcional + Cache SQLite + Refresh Token
**Branch**: `developer`

---

## 🎯 NOVIDADES v1.6.2-pre (2026-03-11)

### **Refresh Automático de Token** ✅
- **Problema**: Token expirava rapidamente, forçando logout constante
- **Solução**: `refreshCredentials()` usa `GET /auth/validate_token`
- **Arquivos**: `context/AuthContext.tsx`, `app/(tabs)/index.tsx`
- **Fluxo**:
  1. Token expira (401)
  2. Refresh automático tenta renovar
  3. Se funcionar: continua usando app
  4. Se falhar: logout e login

### **Correção da Coleta** ✅
- **Problema**: Coleta ficava "carregando" infinito
- **Solução**: 
  - Busca OS por `id` OU `identifier`
  - Invalida cache se OS não encontrada
  - Refresh automático na coleta
- **Arquivos**: `app/order/update.tsx`

### **Status nos Cards** ✅
- **Problema**: Status fixo em "Pendente"
- **Solução**: 
  - SESSION_EXPIRED não faz fallback para cache
  - Força recarregamento com status atualizados
  - Botão "Atualizar" limpa cache
- **Arquivos**: `services/servicesOrders.ts`

### **Nome da Viagem no Card** ✅
- **Mudança**: Card mostra nome da viagem ao invés de "OS #33917"
- **Exemplo**: "11/03 ROTA S1" ou "#0001" se não tiver viagem
- **Arquivos**: `components/ServiceOrderCard.tsx`

### **Botões na Tela Principal** ✅
- 🔄 **Atualizar** - Limpa cache e recarrega OS
- 🚪 **Logout** - Logout manual
- ⚙️ **Filtros** - Status, tipo, viagem, rota, datas

---

## 🎯 NOVIDADES v1.6.0 (2026-03-10)

### **Fase 1 - Busca por Identifier** ✅
- **Problema**: OS buscadas por `id` numérico não carregavam corretamente
- **Solução**: Busca por `identifier` (ex: "OS-12345") via query param
- **Arquivos**: `services/api.ts`, `app/order/[id].tsx`
- **API**: `GET /api/service_orders?identifier=OS-12345`

### **Fase 2 - Filtro de 20 Dias** ✅
- **Problema**: Sem filtro de data padrão
- **Solução**: Filtro automático para últimos 20 dias (dinâmico)
- **Arquivos**: `context/FilterContext.tsx`, `components/FilterModal.tsx`
- **Cálculo**: `startDate = hoje - 20 dias`, `endDate = hoje`

### **Fase 3 - Cache SQLite** ✅
- **Problema**: Sem modo offline, dados não persistem
- **Solução**: Cache automático no SQLite com fallback
- **Arquivos**: 
  - `services/servicesOrders.ts` (novo - 450 linhas)
  - `databases/database.ts` (novo - 248 linhas)
- **Benefícios**:
  - ✅ Cache automático de todas as OS
  - ✅ Fallback para cache se API falhar
  - ✅ Modo offline possível
  - ✅ Performance melhorada

### **Unificação das Tabs** ✅
- **Migração**: Todas as tabs usam `getServicesOrders` com cache
- **Arquivos**: `app/(tabs)/index.tsx`, `voyages.tsx`, `routes.tsx`
- **Benefício**: Mesma fonte de dados, não quebra navegação

### **Testes Automatizados** ✅
- **Configuração**: Jest + jest-expo
- **Arquivos**: `jest.config.js`, `package.json`
- **Testes**: 34 testes passando
  - `mtr.test.ts`: 5 testes (I, J, K)
  - `serviceOrders.test.ts`: 12 testes
  - `routes.test.ts`: 11 testes
  - `auth.test.ts`: 6 testes

---

## 🔐 Autenticação

### Credenciais de Teste
- **Email**: `motoristaapp@econtrole.com`
- **Senha**: `ecomotoapp`
- **URL Base**: `https://gsambientais.econtrole.com/api`

### Sistema de Autenticação
- **Devise Token Auth** (padrão eControle Pro)
- Token transmitido via headers: `access-token`, `client`, `uid`
- Tratamento de expiração de sessão (401)
- Logout automático em caso de token expirado

### **Cache de Token (v1.6.0)** 💾
- **AsyncStorage**: Credenciais completas (`econtrole_credentials`)
- **AsyncStorage**: URL base (`econtrole_base_url`)
- **SQLite**: Credenciais backup (tabela `credentials`)
- **SecureStore**: Domínio/URL (chave `domain`)

**Fluxo de Navegação:**
```
Login → Token salvo (AsyncStorage + SQLite)
  ↓
Tab Ordens → Usa credentials do AuthContext
  ↓
Tab Viagens → Usa MESMAS credentials (não quebra!)
  ↓
Tab Rotas → Usa MESMAS credentials (não quebra!)
  ↓
Settings → Mostra usuário do cache
```

✅ **Nenhuma tab quebra a navegação!**

---

## 🗄️ Estrutura do Banco SQLite (v1.6.0)

### **Tabelas Principais**

```sql
-- Ordens de Serviço
CREATE TABLE service_orders (
  id INTEGER PRIMARY KEY,
  identifier TEXT,           -- Ex: "OS-12345"
  status TEXT,
  service_date TEXT,
  customer_id INTEGER,
  customer_name TEXT,
  address_text TEXT,         -- Endereço formatado
  observations TEXT,
  driver_observations TEXT,
  created_at TEXT,
  vehicle_info TEXT,         -- JSON
  voyage_info TEXT           -- JSON
);

-- Execuções de Serviço (itens da OS)
CREATE TABLE service_executions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_order_id INTEGER,  -- FK → service_orders.id
  service_name TEXT,
  amount INTEGER,
  unit_name TEXT,
  item_weights TEXT          -- JSON dos pesos
);

-- Credenciais de Autenticação
CREATE TABLE credentials (
  _id TEXT PRIMARY KEY,
  accessToken TEXT,
  uid TEXT,
  client TEXT,
  created_at TEXT
);

-- Usuários
CREATE TABLE users (
  _id TEXT PRIMARY KEY,
  email TEXT,
  name TEXT,
  created_at TEXT
);

-- MTRs Emitidos
CREATE TABLE mtrs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_order_id INTEGER,  -- FK → service_orders.id
  mtr_id TEXT UNIQUE,
  status TEXT,
  emission_date TEXT,
  download_path TEXT,
  created_at TEXT
);

-- Fotos da OS
CREATE TABLE service_order_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_order_id INTEGER,  -- FK → service_orders.id
  image_url TEXT,
  image_path TEXT,
  created_at TEXT
);
```

### **Funções CRUD (databases/database.ts)**

```typescript
// Credenciais
insertCredentials(cred)
getCredentials()

// Usuários
insertUser(user)

// Ordens de Serviço
insertServiceOrder(order)        // Salva OS + execuções (transação)
getServiceOrders()               // Todas as OS
getServiceOrder(id)              // OS específica por ID

// MTRs
insertMTR(serviceOrderId, mtrId, status)
getMTRsByServiceOrder(serviceOrderId)
getMTRById(mtrId)
updateMTRStatus(mtrId, status)

// Fotos
insertServiceOrderImage(serviceOrderId, imageUrl, imagePath)
getServiceOrderImages(serviceOrderId)
deleteServiceOrderImages(serviceOrderId)

// Utilitários
clearDatabase()                  // Limpa tudo
initDatabase()                   // Cria tabelas
```

### **Serviço Unificado (services/servicesOrders.ts)**

```typescript
// Busca OS da API + cache automático
getServicesOrders({ filters })
  → API → SQLite → Retorna dados
  → Se API falha → SQLite (fallback)

// Busca OS específica por identifier
getServiceOrder(identifier)
  → SQLite (cache) → Retorna
  → Se não existe → API → SQLite → Retorna

// Funções auxiliares
getServiceOrdersFromCache()
getServiceOrderFromCacheByIdentifier(identifier)
getServiceOrderFromCacheById(id)
clearServiceOrdersCache()
isCacheEmpty()

// Helpers de exibição
getClientName(order)
getAddressName(order)
getRouteName(order)
getVoyageName(order)
hasVoyage(order)

// Upload
uploadPhoto(config, orderId, uri)
```

---

## 📱 Funcionalidades Principais

### 1. Lista de Ordens de Serviço
- **Tela**: `app/(tabs)/index.tsx`
- Carrega OS da API `/api/service_orders`
- Filtros disponíveis: Status, Tipo, Viagem, Rota, Data
- Busca local por cliente, OS ou rota
- Pull-to-refresh para atualizar dados

### 2. Detalhes da OS
- **Tela**: `app/order/[id].tsx`
- Exibe informações completas da OS
- Cliente, endereço, serviços, equipamentos
- Botão **"Iniciar Coleta"** para abrir tela de atualização

### 3. Coleta e Conferência
- **Tela**: `app/order/update.tsx`
- **Pesagem de Serviços**: Input de peso para cada serviço
- **Equipamentos**: Coletados e emprestados (checkbox)
- **Horários**: Chegada e saída
- **Quilometragem**: Inicial e final
- **Certificado/Memo**: Campo de texto
- **Observações**: Campo de texto livre
- **Google Maps**: Abre endereço no mapa
- **MTR**: Emitir antes de enviar para conferência
- **Enviar para Conferência**: Finaliza coleta

### 4. Viagens
- **Tela**: `app/(tabs)/voyages.tsx`
- Agrupa OS por viagem
- Abre/fecha grupos de OS
- Mostra OS sem viagem separadamente

### 5. Rotas
- **Tela**: `app/(tabs)/routes.tsx`
- Agrupa OS por rota e viagem
- Visualização hierárquica
- Expande/contrai grupos

---

## 🗂️ Estrutura de Dados da API

### ServiceOrder (Principal)
```typescript
interface ServiceOrder {
  id: number | string;
  status: string;
  type?: string;
  so_type?: string;
  customer?: { name?: string; document_value?: string };
  address?: string | {
    name?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    zone?: string;
    logistic_profile?: string;
    to_s?: string;
  };
  voyage?: { name?: string; id?: string | number } | string | null;
  voyage_name?: string;
  voyage_id?: string | number | null;
  route_name?: string;
  collection_route?: string;
  service_executions?: ServiceExecution[];
  collected_equipment?: Equipment[];
  lended_equipment?: Equipment[];
  services?: Service[];
  equipments?: Equipment[];
  photos?: string[];
  mtr_id?: string | number | null;
  driver_observations?: string;
  departure_date?: string;
  arrival_date?: string;
  start_km?: string;
  end_km?: string;
  certificate_memo?: string;
  identifier?: string;
  service_date?: string;
  scheduled_date?: string;
}
```

### ServiceExecution
```typescript
interface ServiceExecution {
  id: number | string;
  service?: {
    id: number | string;
    name: string;
    description?: string;
    unit?: { name?: string; abbreviation?: string };
  };
  unit?: { name?: string; abbreviation?: string };
  service_item_weights?: any[];
}
```

---

## 🔧 Funções Auxiliares (api.ts)

```typescript
// Extrai nome do cliente
getClientName(order): string

// Extrai endereço formatado
getAddressName(order): string

// Extrai nome da rota
getRouteName(order): string

// Extrai nome da viagem
getVoyageName(order): string | null

// Verifica se tem viagem
hasVoyage(order): boolean
```

---

## 🎨 Componentes Principais

### ServiceOrderCard
- Exibe resumo da OS na lista
- Mostra: número, status, cliente, endereço, rota, viagem
- Animação de pressão ao clicar

### StatusBadge
- Badge colorida por status
- Cores: Verde (Concluída), Azul (Em conferência), etc.

### FilterModal
- Modal de filtros (bottom sheet)
- Filtros: Status, Tipo, Viagem, Rota

### EmptyState
- Estado vazio para listas
- Ícone e mensagem contextual

### LoadingShimmer
- Skeleton loading
- Animação de carregamento

---

## 🚀 Fluxos de Uso

### Fluxo Principal
```
Login → Lista de OS → Detalhes da OS → Iniciar Coleta
  ↓                                        ↓
  └─────────────────────────────────  Preencher dados
                                          ↓
                                    Emitir MTR (opcional)
                                          ↓
                                    Abrir Mapa (opcional)
                                          ↓
                                    Enviar para Conferência
```

### Fluxo de Viagens/Rotas
```
Lista de OS → Viagens/Rotas → Agrupamento por nome
                                   ↓
                            Clica para expandir
                                   ↓
                            Clica na OS → Detalhes
```

---

## 🐛 Problemas Conhecidos e Soluções

### 1. Erro 401 Unauthorized
**Causa**: Token não transmitido corretamente  
**Solução**: Headers padronizados com Devise Token Auth

### 2. Erro de Parse JSON
**Causa**: API retornando HTML em vez de JSON  
**Solução**: Verificação de content-type + fallback

### 3. "Cannot update a component while rendering"
**Causa**: Logout chamado durante render  
**Solução**: Uso de useEffect para handleError

### 4. "Objects are not valid as a React child"
**Causa**: address como objeto sendo renderizado  
**Solução**: Função getAddressName() extrai to_s

### 5. "Cliente não informado"
**Causa**: customer.name não estava sendo lido  
**Solução**: Função getClientName() lê customer.name

### 6. Erro ao carregar detalhes da OS
**Causa**: API de detalhes retorna HTML  
**Solução**: Usar dados do cache da lista

---

## 📁 Estrutura de Arquivos

```
eControlApp-premium-fix/
├── app/
│   ├── (tabs)/
│   │   ├── index.tsx          # Lista de OS
│   │   ├── voyages.tsx        # Viagens
│   │   ├── routes.tsx         # Rotas
│   │   └── settings.tsx       # Configurações
│   ├── order/
│   │   ├── [id].tsx           # Detalhes da OS
│   │   └── update.tsx         # Coleta/Conferência
│   ├── (auth)/
│   │   └── login.tsx          # Login
│   └── _layout.tsx            # Layout principal
├── components/
│   ├── ServiceOrderCard.tsx
│   ├── StatusBadge.tsx
│   ├── FilterModal.tsx
│   ├── EmptyState.tsx
│   └── LoadingShimmer.tsx
├── context/
│   ├── AuthContext.tsx
│   └── FilterContext.tsx
├── services/
│   └── api.ts
├── constants/
│   ├── colors.ts
│   └── theme.ts
└── MEMORIA.md
```

---

## 🧪 Testes Manuais

### Checklist de Teste
- [ ] Login com credenciais válidas
- [ ] Carregamento da lista de OS
- [ ] Filtro por status funciona
- [ ] Filtro por tipo funciona
- [ ] Filtro por viagem funciona
- [ ] Busca local funciona
- [ ] Detalhes da OS abre
- [ ] Iniciar Coleta abre tela
- [ ] Preencher pesos funciona
- [ ] Selecionar equipamentos funciona
- [ ] Abrir mapa funciona
- [ ] Emitir MTR funciona
- [ ] Enviar para conferência funciona
- [ ] Viagens agrupam corretamente
- [ ] Rotas agrupam corretamente
- [ ] Logout funciona
- [ ] Re-login funciona

---

## 📊 API Endpoints

### Autenticação
```
POST /api/auth/sign_in
Headers: Content-Type: application/json
Body: { email, password }
Response: { access-token, client, uid, ... }
```

### Listar OS
```
GET /api/service_orders?[params]
Headers: access-token, client, uid
Response: { items: ServiceOrder[], pagination, states_data }
```

### Detalhes da OS
```
GET /api/service_orders/:id
(Usa cache da lista - endpoint retorna HTML)
```

### Finalizar OS
```
POST /api/service_orders/:id/finish
Body: { arrival_date, departure_date, start_km, end_km, ... }
Response: ServiceOrder atualizada
```

### Upload de Foto
```
POST /api/service_orders/:id/photos
Body: FormData com photo
```

### Emitir MTR
```
POST http://159.89.191.25:8000/mtr/webhook/econtrol/emit/:token
Body: { service_order_id, tracking_code }
Response: { mtr_id, numero_mtr, status, pdf_url }
```

---

## 🎯 Próximas Melhorias

### Prioridade Alta
- [ ] Validação de campos obrigatórios na coleta
- [ ] Foto obrigatória antes de enviar para conferência
- [ ] Persistência SQLite para modo offline

### Prioridade Média
- [ ] Download de MTR em PDF
- [ ] Histórico de OS finalizadas
- [ ] Exportação de relatórios

### Prioridade Baixa
- [ ] Modo escuro completo
- [ ] Notificações push
- [ ] Sincronização em segundo plano
- [ ] Múltiplas empresas

---

## 🔧 Correções de Filtros (v1.1)

### Problemas Corrigidos
1. **Logout ao aplicar filtros**: Tratamento de erro melhorado para não fazer logout em caso de filtros sem resultados
2. **Filtro de datas**: Adicionado seletor de período (início/fim) no FilterModal
3. **Filtro "Todas"**: Agora mostra todas as OS quando nenhum filtro está ativo

### Novos Filtros Disponíveis
- **Status**: Todos, Em conferência, Iniciada, Concluída, Cancelada
- **Tipo**: Todos, Coleta, Entrega
- **Viagem**: Todos, Com Viagem, Sem Viagem
- **Rota**: Texto livre
- **Período**: Data inicial e data final (seletor calendário)

### Uso dos Filtros
1. Abre modal de filtros (botão sliders)
2. Seleciona status/tipo/viagem
3. Digita nome da rota (opcional)
4. Seleciona período (opcional)
5. Aplica filtros
6. Filtra por cliente/OS/rota na busca local (opcional)

---

## 📝 Notas de Desenvolvimento

### Convenções de Código
- TypeScript estrito
- Componentes funcionais com hooks
- React Query para cache de dados
- Expo Router para navegação
- StyleSheet para estilos

### Dependências Principais
- React Native + Expo
- TypeScript
- React Query (@tanstack/react-query)
- Expo Router
- Axios (para API)

### Padrões de Design
- Componentes reutilizáveis
- Separação de responsabilidades
- Tratamento defensivo de erros
- Logs de debug em desenvolvimento

---

## 🆕 Histórico de Atualizações Recentes

### v1.6.0 - Cache SQLite + Identifier + 20 Dias (2026-03-10)

**Branch**: `developer`  
**Commits**: 6  
**Status**: ✅ Testado (34 testes passando)

#### **Fase 1 - Busca por Identifier** ✅
**Problema**: OS buscadas por `id` numérico não carregavam corretamente, trazendo apenas algumas OS.

**Solução**:
- `services/api.ts`: `fetchServiceOrder()` agora busca por `identifier` via query param
- API: `GET /api/service_orders?identifier=OS-12345`
- `app/order/[id].tsx`: Navegação usa `identifier` como chave principal (fallback para `id`)
- Display: "OS OS-12345" ou "#0001" se não tiver identifier

**Arquivos Modificados**:
- `services/api.ts` - Busca por identifier
- `app/(tabs)/index.tsx` - Navegação passa identifier
- `app/order/[id].tsx` - Busca por identifier

---

#### **Fase 2 - Filtro de 20 Dias** ✅
**Problema**: Sem filtro de data padrão, OS não carregavam corretamente.

**Solução**:
- `context/FilterContext.tsx`: Filtro padrão `startDate` e `endDate` (últimos 20 dias)
- Cálculo dinâmico: `startDate = hoje - 20 dias`, `endDate = hoje`
- `components/FilterModal.tsx`: Reset mantém filtro de 20 dias
- `app/(tabs)/index.tsx`: Envia `start_date` e `end_date` na requisição

**Arquivos Modificados**:
- `context/FilterContext.tsx` - Filtro padrão 20 dias
- `components/FilterModal.tsx` - Reset mantém 20 dias
- `app/(tabs)/index.tsx` - Envia datas na API

---

#### **Fase 3 - Cache SQLite** ✅
**Problema**: Sem modo offline, dados não persistiam, navegação entre tabs quebrava.

**Solução**:
- `services/servicesOrders.ts`: Novo serviço unificado (450 linhas)
  - `getServicesOrders()`: Busca API + cache automático no SQLite
  - `getServiceOrder(identifier)`: Busca por identifier com cache integrado
  - Fallback automático para cache se API falhar
  - Funções auxiliares: `getClientName`, `getAddressName`, etc.
  - `uploadPhoto()`: Upload de fotos para OS

- `databases/database.ts`: Esquema SQLite completo (248 linhas)
  - Tabelas: `service_orders`, `service_executions`, `credentials`, `users`, `mtrs`
  - Funções CRUD para persistência local
  - Suporte a modo offline

- **Migração das Tabs**:
  - `app/(tabs)/index.tsx` - Usa `getServicesOrders`
  - `app/(tabs)/voyages.tsx` - Usa `getServicesOrders`
  - `app/(tabs)/routes.tsx` - Usa `getServicesOrders`
  - Navegação usa `identifier` (fallback para `id`)

**Benefícios**:
- ✅ Cache automático de todas as OS
- ✅ Modo offline possível (fallback para cache)
- ✅ Arquitetura mais robusta e escalável
- ✅ Performance melhorada (dados locais)
- ✅ Mesma fonte de dados em todas as tabs (não quebra navegação)

**Arquivos Criados**:
- `services/servicesOrders.ts` (novo)
- `databases/database.ts` (novo)

**Arquivos Modificados**:
- `app/(tabs)/index.tsx`
- `app/(tabs)/voyages.tsx`
- `app/(tabs)/routes.tsx`
- `app/order/[id].tsx`
- `services/api.ts` - Marcação @deprecated

---

#### **Testes Automatizados** ✅
**Configuração**: Jest + jest-expo

**Arquivos**:
- `jest.config.js` - Configuração Jest
- `package.json` - Scripts e dependências
- `temp-repo/__tests__/setup.ts` - Mocks

**Testes Disponíveis**:
- `mtr.test.ts`: 5 testes (I, J, K - MTR helpers)
- `serviceOrders.test.ts`: 12 testes (Filtros, OS, Equipamentos)
- `routes.test.ts`: 11 testes (Rotas, Viagens)
- `auth.test.ts`: 6 testes (Autenticação, Login)

**Total**: 34 testes passando ✅

**Comandos**:
```bash
npm test              # Roda todos os testes
npm run test:watch    # Modo watch
npm run test:coverage # Com coverage
```

**Arquivos Modificados**:
- `jest.config.js` (novo)
- `package.json` - Scripts + devDependencies

---

### v1.5 - QRScanner com Base64 (2026-03-06)
**Problema**: QR Code continha apenas subdomínio em Base64 (`Z3NhbWJpZW50YWlz` = `gsambientais`)

**Solução**:
- Adicionado decodificador Base64 no `parseQR()`
- Detecta automaticamente subdomínio em Base64
- Configura URL do servidor: `https://{subdomain}.econtrole.com/api`
- Redireciona para tela de login após configurar URL

**Fluxo QRScanner Atualizado**:
```
QR Code (Base64)
    ↓
Decodifica → "gsambientais"
    ↓
Configura URL → https://gsambientais.econtrole.com/api
    ↓
Tela de Login (email/senha)
    ↓
Login normal
```

**Arquivos Modificados**:
- `app/qrscanner.tsx`: Adicionado `atobPolyfill`, `parseQR` atualizado, handler de subdomain

---

## 💎 Perfil do Assistente (Ed)

**Identidade**: Giga Potato  
**Especialidades**:
- React Native (Ph.D.)
- TypeScript
- Node.js
- Expo CLI
- Java

**Missão**: Corrigir bugs e implementar funcionalidades no eControlApp

**Estilo de Trabalho**:
- ✅ Respostas diretas e práticas
- ✅ Código bem documentado
- ✅ Logs de debug para troubleshooting
- ✅ Soluções testadas antes de entregar
- ✅ Foco em UX do usuário final

**Conquistas**:
- 🏆 Correção de autenticação 401
- 🏆 Parse JSON de respostas HTML
- 🏆 Tratamento de valores null/undefined
- 🏆 Sistema de coleta e conferência
- 🏆 Integração Google Maps
- 🏆 QRScanner com Base64
- 🏆 Filtros avançados com datas

---

## 📞 Suporte e Contexto

### Contexto da Conversa
- **Usuário**: Ed (desenvolvedor do eControlApp)
- **Projeto**: eControlApp-premium-fix
- **Objetivo**: App funcional para motoristas coletarem resíduos
- **API**: eControle Pro (Devise Token Auth)
- **Ambiente**: Linux, Expo SDK 54

### Como Continuar
1. Leia este arquivo MEMORIA-v1.md
2. Verifique logs do terminal se houver erros
3. Teste no dispositivo/emulador
4. Reporte issues com logs completos

### Comandos Úteis
```bash
# Desenvolvimento
npx expo start

# Build APK (EAS)
eas build --platform android --profile preview

# Build local (requer Android Studio)
npx expo run:android --variant release

# Instalar dependências
npx expo install <package>
```

---

**Última Atualização**: 2026-03-10  
**Versão**: 1.6.0  
**Status**: ✅ Desenvolvimento (branch `developer`)  
**Próximo Release**: v1.6.0 (merge para master após testes)

---

## 📞 Suporte

### Logs de Debug
Ative logs no terminal para ver:
- URLs das requisições
- Estrutura das respostas API
- Erros de autenticação
- Filtros aplicados
- Cache SQLite (logs: `getServicesOrders: Caching orders...`)

### Como Reportar Bugs
1. Descreva o passo a passo para reproduzir
2. Inclua logs do terminal
3. Informe versão do app
4. Anexe screenshots se aplicável

### Checklist de Testes
Ver arquivo `TESTES.md` para checklist completo de testes manuais.

---

## 🚀 Comandos Úteis (v1.6.0)

```bash
# Desenvolvimento
npx expo start

# Testes
npm test                 # Roda todos os testes
npm run test:watch       # Modo watch
npm run test:coverage    # Com relatório de coverage

# Build APK (EAS)
eas build --platform android --profile preview

# Build local (requer Android Studio)
npx expo run:android --variant release

# Instalar dependências
npx expo install <package>
npm install --save-dev <package>
```

---

## 📊 Resumo da v1.6.0

| Feature | Status | Descrição |
|---------|--------|-----------|
| **Fase 1** | ✅ | Busca OS por `identifier` |
| **Fase 2** | ✅ | Filtro padrão 20 dias |
| **Fase 3** | ✅ | Cache SQLite unificado |
| **Tabs** | ✅ | Todas migradas para cache |
| **Auth** | ✅ | Token persistente (AsyncStorage + SQLite) |
| **Testes** | ✅ | 34 testes passando |

**Commits na branch `developer`**:
```
0a2cdad chore: atualizar jest.config e rodar testes
4904437 chore: adicionar configuração do Jest para testes
8393388 feat: migrar tabs Viagens e Rotas para cache SQLite
24be858 feat: unificação com cache SQLite (Fase 3)
20f46eb feat: buscar OS por identifier e filtro padrão de 20 dias
fd13453 (origin/master) First commit
```

---

**Última Atualização**: 2026-03-11
**Versão**: 1.6.1
**Status**: ✅ Desenvolvimento (branch `developer`)
**Próximo Release**: v1.6.1 (merge para master após testes)

---

## 🆕 v1.6.1 - Correção de Sessão e Cache SQLite (2026-03-11)

### **Problemas Corrigidos**

1. **App não abria** - Credenciais não persistiam no SQLite
2. **SESSION_EXPIRED** - Token expirando rapidamente
3. **Transação aninhada** - Erro ao salvar cache
4. **Status "Pendente"** - Faltando na lista de filtros
5. **Identifier na OS** - Mostrando apenas ID numérico

### **Soluções Implementadas**

#### 1. **Credenciais no SQLite** ✅
- `AuthContext`: Salva credenciais no SQLite ao fazer login
- `insertCredentials()` e `insertUser()` chamados no login
- `logout()` limpa SQLite
- Fallback: AsyncStorage → SQLite

#### 2. **Botão "Limpar Dados Salvos"** ✅
- Tela de login → Configurações avançadas
- Limpa AsyncStorage + SQLite
- Recarrega app automaticamente

#### 3. **Correção de Transação** ✅
- `insertServiceOrderNoTransaction()`: Versão sem transação
- Usada dentro de `withTransactionSync` externo
- Corrige: "cannot start a transaction within a transaction"

#### 4. **Tratamento SESSION_EXPIRED** ✅
- `index.tsx`: Logout automático + redirect para login
- `update.tsx`: Alerta de sessão expirada na coleta
- Logs de debug melhorados

#### 5. **Identifier no Card** ✅
- `ServiceOrderCard.tsx`: Mostra `identifier` ou ID formatado
- Ex: "OS-12345" ou "#0001"

#### 6. **Status "Pendente"** ✅
- `FilterModal.tsx`: Adicionado aos filtros
- `StatusBadge.tsx`: Já suportava "Pendente"

### **Arquivos Modificados**

1. `context/AuthContext.tsx` - Salva/busca SQLite
2. `app/(auth)/login.tsx` - Botão limpar dados
3. `databases/database.ts` - `insertServiceOrderNoTransaction`
4. `services/servicesOrders.ts` - Cache sem transação aninhada
5. `app/order/update.tsx` - Tratamento SESSION_EXPIRED
6. `components/ServiceOrderCard.tsx` - Identifier
7. `components/FilterModal.tsx` - Status "Pendente"

### **Comandos Úteis**

```bash
# Desenvolvimento
npx expo start

# Build APK (EAS)
eas build --platform android --profile preview

# Limpar dados do app (se necessário)
# No dispositivo: Settings → Apps → eControle → Clear Data
```

### **Status dos Status da API**

A API retorna os seguintes status:
- `Pendente` - OS aguardando início
- `Em conferência` - OS em conferência
- `Iniciada` - Coleta iniciada
- `Concluída` - OS finalizada
- `Cancelada` - OS cancelada

### **Próximos Passos**

- [ ] Implementar paginação "Carregar mais"
- [ ] Refresh automático de token
- [ ] Persistência de dados da coleta
- [ ] Validação de campos obrigatórios

---

## 📞 Suporte

### Logs de Debug
Ative logs no terminal para ver:
- URLs das requisições
- Estrutura das respostas API
- Erros de autenticação (SESSION_EXPIRED)
- Filtros aplicados
- Cache SQLite (logs: `getServicesOrders: Caching orders...`)
- Distribuição de status (logs: `Status distribution:`)

### Como Reportar Bugs
1. Descreva o passo a passo para reproduzir
2. Inclua logs do terminal
3. Informe versão do app
4. Anexe screenshots se aplicável

### Checklist de Testes
- [x] Login com credenciais válidas
- [x] Credenciais salvas no SQLite
- [x] Carregamento da lista de OS
- [x] Filtro por status (Pendente, Em conferência, etc.)
- [x] Filtro por tipo (Coleta, Entrega)
- [x] Filtro por viagem
- [x] Busca local funciona
- [x] Detalhes da OS abre
- [x] Iniciar Coleta abre tela
- [ ] Preencher pesos e enviar (teste pendente)
- [ ] Selecionar equipamentos funciona
- [ ] Abrir mapa funciona
- [ ] Emitir MTR funciona
- [ ] Enviar para conferência (teste pendente)
- [x] Viagens agrupam corretamente
- [x] Rotas agrupam corretamente
- [x] Logout funciona
- [x] Re-login funciona
- [x] Limpar dados salvos funciona

---

**Última Atualização**: 2026-03-11  
**Versão**: 1.6.1  
**Status**: ✅ Desenvolvimento (branch `developer`)  
**Próximo Release**: v1.6.1 (merge para master após testes)

---

## 📞 Suporte

### Logs de Debug
Ative logs no terminal para ver:
- URLs das requisições
- Estrutura das respostas API
- Erros de autenticação
- Filtros aplicados
- Cache SQLite (logs: `getServicesOrders: Caching orders...`)

### Como Reportar Bugs
1. Descreva o passo a passo para reproduzir
2. Inclua logs do terminal
3. Informe versão do app
4. Anexe screenshots se aplicável

### Checklist de Testes
Ver arquivo `TESTES.md` para checklist completo de testes manuais.

---

**Última Atualização**: 2026-03-10  
**Versão**: 1.6.0  
**Status**: ✅ Desenvolvimento (branch `developer`)
