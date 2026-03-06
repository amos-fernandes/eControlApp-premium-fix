# eControle App Premium — Correções Aplicadas

## Bugs Corrigidos

### 1. **[CRASH] `lib/query-client.ts` — EXPO_PUBLIC_DOMAIN obrigatório**
- **Problema**: `getApiUrl()` lançava exceção se `EXPO_PUBLIC_DOMAIN` não estivesse definido. Isso era código do servidor Replit exportado por engano para o app mobile.
- **Correção**: Removido todo o código de proxy/servidor. `QueryClient` agora usa configuração padrão limpa para mobile.

### 2. **[CRASH ANDROID/iOS antigo] `(tabs)/_layout.tsx` — NativeTabs instável**
- **Problema**: `isLiquidGlassAvailable()` de `expo-glass-effect` + `expo-router/unstable-native-tabs` são APIs experimentais/iOS 26+. Causava crash no Android e em iPhones sem iOS 26.
- **Correção**: Removido o `NativeTabLayout` experimental. Mantido apenas o `ClassicTabLayout` estável que funciona em todas as plataformas.

### 3. **[BUG] `components/FilterModal.tsx` — Estado desatualizado (stale closure)**
- **Problema**: O estado local (`local`) não era sincronizado quando `props.filters` mudava externamente (ex: botão "Limpar tudo" na lista). Ao reabrir o modal, mostrava filtros desatualizados.
- **Correção**: Adicionado `useEffect` que sincroniza `local` com `filters` toda vez que o modal abre (`visible` muda para `true`).

### 4. **[BUG] `app/(tabs)/index.tsx` — Pull-to-refresh bloqueado na lista vazia**
- **Problema**: `scrollEnabled={filtered.length > 0}` desabilitava o scroll quando a lista estava vazia, impedindo o gesto de pull-to-refresh para recarregar.
- **Correção**: Removida a prop `scrollEnabled` — o `RefreshControl` sempre funciona agora.

### 5. **[BUG] `app/order/[id].tsx` — Upload de foto não chamava a API**
- **Problema**: `handleAddPhoto` mostrava "Foto adicionada" com sucesso, mas NUNCA chamava `uploadPhoto()`. A foto nunca era enviada ao servidor.
- **Correção**: Agora chama corretamente `uploadPhoto({ baseUrl, credentials }, order.id, uri)` e invalida o cache da query para recarregar a OS.

### 6. **[BUG] `services/api.ts` — Sem timeout nas requisições**
- **Problema**: Requisições para o servidor podiam travar indefinidamente sem timeout.
- **Correção**: Adicionado `AbortController` com timeout de 15 segundos em todas as chamadas de API.

### 7. **[BUG] `services/api.ts` — URL base com barra final causava URLs duplicadas**
- **Problema**: Se `baseUrl = "https://econtrole.com/"`, a URL ficava `https://econtrole.com//api/v1/...`.
- **Correção**: Aplicado `.replace(/\/$/, "")` em todas as funções antes de construir URLs.

### 8. **[CONFIG] `app.json` — Origin apontando para Replit**
- **Problema**: `expo-router` configurado com `"origin": "https://replit.com/"` — causaria problemas de deep linking em produção.
- **Correção**: Removida a configuração de `origin` (usa padrão do Expo).

### 9. **[CONFIG] `babel.config.js` — `unstable_transformImportMeta` ativado**
- **Problema**: Flag experimental que pode causar problemas de build.
- **Correção**: Removido. Usando `babel-preset-expo` padrão.

### 10. **[MELHORIA] `services/api.ts` — Campos do Pro integrados**
- Adicionados campos do eControleApp-Pro: `service_executions`, `collected_equipment`, `lended_equipment`, `driver_observations`, `start_km`, `end_km`, `certificate_memo`.
- Tela de detalhe (`order/[id].tsx`) agora exibe KM inicial/final e observações do motorista.

### 11. **[LIMPEZA] Arquivos de servidor removidos**
- Removidos: `server/`, `drizzle.config.ts`, `shared/schema.ts`, `scripts/build.js` — eram código backend Node.js que não pertence ao app mobile.

## Funcionalidades mantidas do Pro
- ✅ Login com QR Code (múltiplos formatos: JSON, texto, URL, token)
- ✅ Login com e-mail/senha + configurações avançadas de servidor
- ✅ Lista de OS com filtros e busca
- ✅ Detalhes da OS com serviços, equipamentos, fotos
- ✅ Emissão de MTR
- ✅ Agrupamento por Viagens e Rotas
- ✅ Configurações + logout
- ✅ Suporte a dark mode
