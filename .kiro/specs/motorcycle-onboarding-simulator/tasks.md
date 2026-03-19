# Plano de Implementação: motorcycle-onboarding-simulator

## Visão Geral

Implementação incremental do fluxo de onboarding obrigatório, seleção de categoria na Garagem e adaptação do simulador ao perfil do utilizador. Todas as alterações são exclusivamente no frontend (`app/frontend/src`).

## Tasks

- [x] 1. Criar utilitário `categoryDeviceMap.ts`
  - Criar `src/utils/categoryDeviceMap.ts` com `CATEGORY_DEVICE_MAP`, `CATEGORIES` e `deviceIdFromCategory`
  - Este ficheiro é a base partilhada por `Garage`, `SimulatorContexts` e `CommandPanel`
  - _Requirements: 2.4_

- [x] 2. Atualizar tipo `Motorcycle` em `src/types/index.ts`
  - Adicionar campos `model`, `plate` e `category` à interface `Motorcycle`
  - Estes campos já existem no schema Prisma mas estavam ausentes do tipo TypeScript
  - _Requirements: 2.2, 2.6_

- [x] 3. Criar componente `OnboardingGuard`
  - Criar `src/components/auth/OnboardingGuard.tsx`
  - Lê `user` do `useAuth()`; se `user.email === 'admin@admin.com'` renderiza `children` diretamente
  - Se `location.pathname === '/garage'` renderiza `children` diretamente
  - Caso contrário chama `motorcyclesAPI.getAll()`: loading → spinner, erro → ecrã de erro com retry, 0 motas → `<Navigate to="/garage" replace />`, ≥1 mota → renderiza `children`
  - Estado interno: `{ status: 'loading' | 'ok' | 'redirect' | 'error' }`
  - _Requirements: 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 4. Atualizar `App.tsx` — envolver rotas com `OnboardingGuard`
  - Importar `OnboardingGuard`
  - Envolver todas as rotas protegidas (exceto `/garage`) com `<OnboardingGuard>` dentro de `<ProtectedRoute>`
  - A rota `/garage` mantém apenas `<ProtectedRoute>` sem `OnboardingGuard`
  - _Requirements: 1.2, 1.6_

- [x] 5. Atualizar `Garage.tsx` — categoria em vez de deviceId + remover badge online/offline
  - [x] 5.1 Substituir `deviceId: string` por `category: string` no `FormState` e `EMPTY_FORM`
    - Remover o campo `<input id="g-device">` do formulário
    - Adicionar `<select id="g-category">` com as 8 opções de `CATEGORIES` (importar de `categoryDeviceMap`)
    - Validar que `form.category` não está vazio antes de submeter; mostrar "Seleciona uma categoria" se vazio
    - Em `handleSubmit`, derivar `deviceId` via `deviceIdFromCategory(form.category)` antes de enviar ao backend
    - Em `openEdit`, popular `form.category` a partir de `m.category ?? ""`
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

  - [x] 5.2 Remover badge Online/Offline dos cards de mota
    - Remover imports `Wifi`, `WifiOff`, `useSocket` (se não usado noutro lado), função `isOnline` e o `<span>` do badge
    - _Requirements: 2.7_

- [x] 6. Atualizar `CommandPanel.tsx` — adicionar prop `lockedModel`
  - Adicionar `lockedModel?: string` à interface `CommandPanelProps`
  - Se `lockedModel` está definido: ocultar o `<select>` de MODELOS e usar `lockedModel` como modelo fixo em `handleSendModel`
  - Se `lockedModel` é `undefined`: comportamento atual (seletor livre visível)
  - Se `lockedModel` for string não presente no `CATEGORY_DEVICE_MAP`: `addLog("Modelo inválido", "#ef4444")` e não enviar comando
  - _Requirements: 3.2, 3.3, 3.7, 4.1_

- [x] 7. Atualizar `SimulatorContexts.tsx` — dropdown de motas para Regular_User, admin livre
  - Importar `useAuth`, `motorcyclesAPI`, `CATEGORY_DEVICE_MAP`, `CATEGORIES`
  - Detetar admin por `user?.email === 'admin@admin.com'`
  - Se Regular_User: chamar `motorcyclesAPI.getAll()` no mount; apresentar dropdown de motas; ao selecionar, derivar `lockedModel` via `CATEGORY_DEVICE_MAP[moto.category]`; passar `lockedModel` ao `CommandPanel`; desativar dropdown durante `running`; mostrar erro inline com retry se a chamada falhar
  - Se Admin: não apresentar dropdown de motas; não passar `lockedModel` ao `CommandPanel`
  - Estado adicional: `userMotos`, `selectedMotoId`, `motosError`, `motosLoading`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 3.7, 4.1, 4.2, 4.4_

- [x] 8. Atualizar `LoginSidebar.tsx` — redirect para `/garage` após registo
  - No fluxo de registo (`!isLogin`), após `register()` com sucesso, chamar `onSuccess` com navegação para `/garage`
  - Verificar como `onSuccess` é passado em `Login.tsx` e `HomePage.tsx` e garantir que o redirect para `/garage` é feito nesses contextos
  - _Requirements: 1.1_

- [x] 9. Checkpoint final — verificar integração
  - Garantir que todos os ficheiros compilam sem erros TypeScript
  - Verificar que o fluxo completo funciona: registo → `/garage` → adicionar mota → acesso livre
  - Garantir que o admin acede diretamente sem onboarding
  - Pedir ao utilizador confirmação antes de considerar a feature concluída
