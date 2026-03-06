# MEMORIA: eControlApp v1.0 - Documentação Completa

## 📋 Visão Geral
**eControlApp** - Aplicativo React Native para gestão de ordens de serviço da eControle Pro.

**Data**: 2026-03-06  
**Versão Atual**: 1.0.0  
**Status**: ✅ Funcional

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

## 📞 Suporte

### Logs de Debug
Ative logs no terminal para ver:
- URLs das requisições
- Estrutura das respostas API
- Erros de autenticação
- Filtros aplicados

### Como Reportar Bugs
1. Descreva o passo a passo para reproduzir
2. Inclua logs do terminal
3. Informe versão do app
4. Anexe screenshots se aplicável

---

**Última Atualização**: 2026-03-06  
**Versão**: 1.0.0  
**Status**: ✅ Produção
