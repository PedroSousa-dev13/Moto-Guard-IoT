# Language Selector Fix - Bugfix Design

## Overview

O sistema de internacionalização (i18n) está implementado com I18nProvider, TranslatedApp wrapper, useI18n hook e traduções completas em PT/EN/ES. No entanto, quando o utilizador seleciona um idioma diferente na página Settings, a interface não muda de idioma. A causa raiz identificada é que o TranslatedApp wrapper está posicionado ACIMA do Router no App.tsx, o que significa que a mudança de `_renderKey` força o unmount/remount de toda a árvore React incluindo o Router, causando perda de estado de navegação e impedindo a re-renderização correta dos componentes internos.

A solução é reposicionar o TranslatedApp wrapper DENTRO do Router, envolvendo apenas o conteúdo que precisa de re-renderizar quando o idioma muda, preservando o estado do Router.

## Glossary

- **Bug_Condition (C)**: A condição que desencadeia o bug - quando o utilizador seleciona um idioma diferente no dropdown de Settings
- **Property (P)**: O comportamento desejado - todos os componentes devem re-renderizar com as traduções do novo idioma
- **Preservation**: Comportamento existente que deve permanecer inalterado - idioma padrão PT, fallback de traduções, outras settings
- **I18nProvider**: Contexto React que fornece o estado do idioma atual e a função `t()` para traduções
- **TranslatedApp**: Componente wrapper que força re-render de todos os filhos quando `_renderKey` muda
- **_renderKey**: Contador interno no I18nContext que incrementa quando o idioma muda, usado como prop `key` no TranslatedApp
- **Router (BrowserRouter)**: Componente do react-router-dom que mantém o estado de navegação da aplicação
- **useI18n hook**: Hook que retorna `{ language, setLanguage, t, _renderKey }` do I18nContext

## Bug Details

### Bug Condition

O bug manifesta-se quando o utilizador seleciona um idioma diferente (EN ou ES) no dropdown de Settings. O sistema chama `setLanguage()` que atualiza o estado e incrementa `_renderKey`, mas a interface não reflete a mudança de idioma porque o TranslatedApp está posicionado acima do Router na hierarquia de componentes.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { action: 'selectLanguage', newLanguage: Language }
  OUTPUT: boolean
  
  RETURN input.action == 'selectLanguage'
         AND input.newLanguage IN ['pt', 'en', 'es']
         AND input.newLanguage != currentLanguage
         AND TranslatedApp is positioned ABOVE Router in component tree
END FUNCTION
```

### Examples

- **Exemplo 1**: Utilizador está em Settings com idioma PT, seleciona EN no dropdown → interface permanece em PT (esperado: mudar para EN)
- **Exemplo 2**: Utilizador está em Dashboard com idioma PT, vai a Settings, seleciona ES → interface permanece em PT (esperado: mudar para ES)
- **Exemplo 3**: Utilizador seleciona EN, a página recarrega (window.location.reload()) → interface permanece em PT (esperado: carregar em EN)
- **Edge case**: Utilizador seleciona o mesmo idioma atual → nenhuma mudança visível (comportamento correto, não é bug)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- O idioma padrão ao aceder à aplicação pela primeira vez deve continuar a ser Português (PT)
- A função `t()` do hook useI18n deve continuar a retornar traduções corretas com fallback PT → EN
- Outras definições em Settings (tema, unidades, mapStyle, etc.) devem continuar a guardar e aplicar corretamente
- O atributo `document.documentElement.lang` deve continuar a ser atualizado quando o idioma muda
- Chaves de tradução inexistentes devem continuar a fazer fallback para PT, depois EN, depois retornar a chave

**Scope:**
Todas as interações que NÃO envolvem mudança de idioma devem ser completamente inalteradas. Isto inclui:
- Navegação entre páginas (Router state)
- Autenticação e logout
- Guardar outras settings (tema, unidades, alertas, thresholds)
- Funcionalidade de todos os componentes (Dashboard, Trips, Map, etc.)

## Hypothesized Root Cause

Baseado na análise do código, a causa raiz mais provável é:

1. **Posicionamento Incorreto do TranslatedApp**: O TranslatedApp está envolvendo o Router no App.tsx:
   ```tsx
   <I18nProvider>
     <TranslatedApp>  {/* ← PROBLEMA: acima do Router */}
       <AuthProvider>
         <Router>
           {/* ... */}
         </Router>
       </AuthProvider>
     </TranslatedApp>
   </I18nProvider>
   ```
   Quando `_renderKey` muda, o TranslatedApp força unmount/remount de TODA a árvore incluindo o Router, o que pode causar perda de estado de navegação e impedir a re-renderização correta.

2. **Reload da Página Mascarando o Problema**: O código em Settings.tsx tem um `window.location.reload()` após mudança de idioma:
   ```tsx
   if (oldLanguage !== form.language) {
     setTimeout(() => {
       window.location.reload();
     }, 500);
   }
   ```
   Este reload é uma tentativa de forçar a atualização, mas não funciona porque o problema está na hierarquia de componentes.

3. **Falta de Dependência do _renderKey**: Componentes que usam `useI18n()` obtêm a função `t()`, mas não têm dependência explícita de `_renderKey`, então não re-renderizam quando o idioma muda.

## Correctness Properties

Property 1: Bug Condition - Language Change Updates Interface

_For any_ user action where a different language is selected in Settings (selectLanguage with newLanguage != currentLanguage), the fixed application SHALL immediately update all visible translations in the interface to the selected language, causing all components using the `t()` function to re-render with the new translations.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Non-Language Settings Behavior

_For any_ user interaction that does NOT involve changing the language (navigation, authentication, saving other settings like theme/units/alerts), the fixed application SHALL produce exactly the same behavior as the original application, preserving all existing functionality including Router state, authentication state, and other settings persistence.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

A solução correta é reposicionar o TranslatedApp wrapper para DENTRO do Router, envolvendo apenas o conteúdo que precisa de re-renderizar quando o idioma muda.

**File**: `app/frontend/src/App.tsx`

**Function**: `App` component

**Specific Changes**:

1. **Mover TranslatedApp para dentro do Router**: Reposicionar o wrapper TranslatedApp para que envolva apenas o conteúdo interno do Router, não o Router em si
   - Remover `<TranslatedApp>` de acima do `<AuthProvider>`
   - Adicionar `<TranslatedApp>` dentro do `<Router>`, envolvendo o `<div className="App">`
   - Isto preserva o estado do Router enquanto força re-render dos componentes internos

2. **Remover window.location.reload()**: Eliminar o código que força reload da página em Settings.tsx
   - Remover o bloco `if (oldLanguage !== form.language) { setTimeout(() => window.location.reload() }) }`
   - O TranslatedApp wrapper agora garante re-render automático

3. **Verificar hierarquia de contextos**: Garantir que a ordem dos providers está correta
   - I18nProvider (mais externo - fornece idioma)
   - AuthProvider (fornece autenticação)
   - Router (mantém estado de navegação)
   - TranslatedApp (força re-render quando idioma muda)
   - DemoProvider (fornece modo demo)

4. **Testar re-render de componentes**: Verificar que componentes como Sidebar, Navbar, Settings re-renderizam corretamente
   - Sidebar usa `t('sidebar.monitoring')`, `t('nav.dashboard')`, etc.
   - Settings usa `t('settings.title')`, `t('settings.language')`, etc.
   - Todos devem atualizar quando `_renderKey` incrementa

5. **Manter comportamento de saveSettings**: A função `saveSettings()` deve continuar a guardar no localStorage
   - `setLanguage()` já chama `saveSettings()` internamente no I18nContext
   - Settings.tsx deve apenas chamar `setI18nLanguage(form.language)`

## Testing Strategy

### Validation Approach

A estratégia de testes segue uma abordagem de duas fases: primeiro, demonstrar o bug no código não corrigido (exploratory testing), depois verificar que o fix funciona corretamente e preserva comportamentos existentes.

### Exploratory Bug Condition Checking

**Goal**: Demonstrar o bug ANTES de implementar o fix. Confirmar ou refutar a análise de causa raiz. Se refutarmos, precisamos re-hipotizar.

**Test Plan**: Executar a aplicação no estado atual, navegar para Settings, tentar mudar o idioma de PT para EN, observar que a interface não muda. Inspecionar a hierarquia de componentes no React DevTools para confirmar que TranslatedApp está acima do Router.

**Test Cases**:
1. **Language Change in Settings**: Selecionar EN no dropdown de Settings → interface permanece em PT (falhará no código não corrigido)
2. **Language Change with Page Reload**: Selecionar ES e aguardar o reload → interface permanece em PT (falhará no código não corrigido)
3. **Sidebar Translation Check**: Após mudança de idioma, verificar se Sidebar mostra "Monitoring" em vez de "Monitorização" (falhará no código não corrigido)
4. **Component Tree Inspection**: Usar React DevTools para verificar que TranslatedApp está acima de Router (confirmará a causa raiz)

**Expected Counterexamples**:
- Interface não muda de idioma após seleção no dropdown
- `window.location.reload()` não resolve o problema
- Possíveis causas: TranslatedApp posicionado incorretamente, Router state sendo perdido, componentes não re-renderizando

### Fix Checking

**Goal**: Verificar que para todas as entradas onde a condição de bug se aplica (mudança de idioma), a aplicação corrigida produz o comportamento esperado (interface atualiza).

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := App_fixed(input)
  ASSERT expectedBehavior(result)
    // expectedBehavior: interface shows translations in new language
    // All components using t() display correct translations
    // Sidebar shows translated navigation labels
    // Settings shows translated labels and descriptions
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todas as entradas onde a condição de bug NÃO se aplica (outras interações), a aplicação corrigida produz o mesmo resultado que a aplicação original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT App_original(input) = App_fixed(input)
    // Navigation between pages works identically
    // Authentication flow unchanged
    // Other settings (theme, units) save and apply correctly
    // Router state preserved during navigation
END FOR
```

**Testing Approach**: Property-based testing é recomendado para preservation checking porque:
- Gera muitos casos de teste automaticamente através do domínio de entrada
- Captura edge cases que testes unitários manuais podem perder
- Fornece garantias fortes de que o comportamento permanece inalterado para todas as entradas não-buggy

**Test Plan**: Observar comportamento no código NÃO CORRIGIDO primeiro para navegação, autenticação, outras settings, depois escrever testes property-based capturando esse comportamento.

**Test Cases**:
1. **Navigation Preservation**: Observar que navegação entre Dashboard → Trips → Map funciona corretamente no código não corrigido, depois verificar que continua a funcionar após fix
2. **Theme Setting Preservation**: Observar que mudar tema de Light para Dark funciona no código não corrigido, depois verificar que continua a funcionar após fix
3. **Authentication Preservation**: Observar que login/logout funciona no código não corrigido, depois verificar que continua a funcionar após fix
4. **Default Language Preservation**: Observar que idioma padrão é PT ao aceder pela primeira vez, depois verificar que continua PT após fix

### Unit Tests

- Testar que `setLanguage()` atualiza o estado do idioma no I18nContext
- Testar que `_renderKey` incrementa quando `setLanguage()` é chamado
- Testar que `t()` retorna traduções corretas para cada idioma
- Testar que TranslatedApp re-renderiza quando `_renderKey` muda
- Testar que Settings.tsx chama `setLanguage()` quando o utilizador seleciona um idioma

### Property-Based Tests

- Gerar mudanças aleatórias de idioma (PT ↔ EN ↔ ES) e verificar que interface sempre atualiza corretamente
- Gerar sequências aleatórias de navegação e verificar que Router state é preservado
- Gerar configurações aleatórias de settings e verificar que todas são guardadas corretamente
- Testar que para qualquer chave de tradução válida, `t(key)` retorna uma string não-vazia em qualquer idioma

### Integration Tests

- Testar fluxo completo: abrir aplicação → navegar para Settings → mudar idioma → verificar que toda a interface atualiza
- Testar que mudança de idioma persiste após refresh da página (localStorage)
- Testar que componentes em diferentes níveis da árvore (Sidebar, Navbar, Settings, Dashboard) todos atualizam simultaneamente
- Testar que feedback visual (mensagem "Definições guardadas com sucesso") aparece no idioma correto
