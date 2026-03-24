# Plano de Implementação: Suporte ao Idioma Espanhol

## Overview

Substituir o placeholder `const es = { ...translations.en }` em `translations.ts` por um dicionário ES completo com traduções reais em espanhol para todas as chaves (base + extended), e atualizar os testes para verificar paridade de chaves, valores não vazios e distinção ES vs EN.

## Tasks

- [x] 1. Implementar o dicionário ES completo em `translations.ts`
  - Substituir `const es = { ...translations.en }` por um objeto `es` com traduções reais em espanhol para todas as chaves do dicionário base (`translations.pt`) e do `extendedTranslations.pt`
  - O objeto `es` deve ser declarado antes do `Object.assign` e cobrir os mesmos namespaces: `common`, `nav`, `sidebar`, `dashboard`, `trips`, `tripDetail`, `garage`, `settings`, `auth`, `demo`, `alerts`, `analytics`, `map`, `profile`, `error`, `units` (base) e todos os namespaces do `extendedTranslations`
  - Garantir que chaves como `common.save` → "Guardar", `settings.title` → "Configuración", `nav.trips` → "Viajes" são distintas das traduções EN
  - O `translationsWithEs` deve continuar a exportar `{ pt, en, es }` sem alterações à interface pública
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1_

  - [ ]* 1.1 Escrever property test: Paridade de chaves ES ↔ PT
    - **Property 1: Para qualquer chave em PT merged (base + extended), essa chave existe em ES; e vice-versa**
    - Usar `fc.constantFrom(...Object.keys(mergedPt))` para iterar sobre todas as chaves
    - **Validates: Requirements 1.1, 1.2, 1.3, 3.1**

  - [ ]* 1.2 Escrever property test: Traduções ES não vazias
    - **Property 2: Para qualquer chave em ES, o valor não é string vazia**
    - Usar `fc.constantFrom(...Object.keys(es))` e verificar `value.length > 0`
    - **Validates: Requirements 1.1, 1.2, 5.2**

- [ ] 2. Checkpoint — Verificar paridade de chaves e valores não vazios
  - Garantir que todos os testes de paridade e não-vazio passam, pedir ao utilizador se surgirem dúvidas.

- [x] 3. Atualizar/criar testes de distinção ES vs EN e de lookup correto
  - No ficheiro `app/frontend/src/i18n/__tests__/translations.test.ts`, adicionar:
    - Teste de exemplo: `common.save` em ES é `"Guardar"` (≠ `"Save"`)
    - Teste de exemplo: `settings.title` em ES é `"Configuración"` (≠ `"Settings"`)
    - Teste de exemplo: `nav.trips` em ES é `"Viajes"` (≠ `"Trips"`)
    - Teste de exemplo: `translationsWithEs` tem a propriedade `es`
    - Teste de exemplo: o dicionário ES tem pelo menos tantas chaves quanto PT
  - _Requirements: 1.4, 5.1, 5.3_

  - [ ]* 3.1 Escrever property test: Lookup correto com idioma "es"
    - **Property 3: Para qualquer chave em ES, `translationsWithEs.es[key]` retorna exatamente o valor definido no dicionário ES**
    - Usar `fc.constantFrom(...Object.keys(translationsWithEs.es))` e verificar igualdade direta
    - **Validates: Requirements 2.1, 2.2, 3.2, 3.3, 3.4**

  - [ ]* 3.2 Escrever property test: Round-trip de mudança de idioma
    - **Property 5: Para qualquer idioma L ∈ {pt, en} e qualquer chave k, o valor em L antes e depois de "passar por ES" é idêntico**
    - Usar `fc.constantFrom('pt', 'en')` combinado com `fc.constantFrom(...keys)`
    - **Validates: Requirements 4.1, 4.2, 4.4**

  - [ ]* 3.3 Escrever property test: Idempotência de seleção de idioma ES
    - **Property 6: Aceder a `translationsWithEs.es[key]` N vezes (N ≥ 1) produz sempre o mesmo resultado**
    - Usar `fc.integer({min:1, max:10})` para N e `fc.constantFrom(...keys)` para a chave
    - **Validates: Requirements 4.3**

- [ ] 4. Checkpoint final — Garantir que todos os testes passam
  - Garantir que todos os testes passam, pedir ao utilizador se surgirem dúvidas.

## Notes

- Tasks marcadas com `*` são opcionais e podem ser saltadas para um MVP mais rápido
- O ficheiro a modificar é apenas `app/frontend/src/i18n/translations.ts` (dicionário ES) e `app/frontend/src/i18n/__tests__/translations.test.ts` (testes)
- A biblioteca para property tests é **fast-check** (`fc`) — já disponível no projeto
- Cada property test deve correr no mínimo 100 iterações
- A interface pública (`translationsWithEs`, `TranslationKey`) não muda
