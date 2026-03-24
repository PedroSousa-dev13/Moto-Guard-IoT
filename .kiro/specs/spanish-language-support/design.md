# Design: Suporte ao Idioma Espanhol

## Overview

Adicionar traduções espanholas reais ao sistema i18n da aplicação MotoGuard IoT. A infraestrutura já está preparada — o tipo `Language` inclui `"es"`, o seletor de idioma já apresenta "Español", e o `I18nContext` já usa `translationsWithEs`. A única mudança necessária é substituir o placeholder `const es = { ...translations.en }` por um dicionário ES completo com traduções reais.

O âmbito é deliberadamente estreito: **um único ficheiro**, `app/frontend/src/i18n/translations.ts`, recebe um dicionário `es` com todas as chaves cobertas.

## Architecture

Nenhuma mudança arquitetural é necessária. O sistema i18n existente já suporta três idiomas:

```
I18nContext.tsx
  └── usa translationsWithEs (de translations.ts)
        ├── pt  (completo)
        ├── en  (completo)
        └── es  (atualmente cópia de EN → substituir por dicionário real)
```

O fluxo de resolução de uma chave permanece inalterado:

```
t(key) → ES_Dictionary[key] ?? PT[key] ?? EN[key] ?? key
```

## Components and Interfaces

### Ficheiro modificado: `translations.ts`

A única alteração é substituir:

```typescript
// Antes
const es = { ...translations.en };
```

por:

```typescript
// Depois
const es = {
  // dicionário completo com traduções ES reais
  'common.save': 'Guardar',
  'common.cancel': 'Cancelar',
  // ... todas as chaves
};
```

O objeto `es` deve cobrir as chaves do objeto `translations` (base) e do `extendedTranslations` — o mesmo conjunto que PT e EN após o `Object.assign` no final do ficheiro.

### Interface pública (sem alterações)

```typescript
export const translationsWithEs: { pt: {...}, en: {...}, es: {...} }
export type TranslationKey = keyof typeof translations.pt
```

Nenhum componente, hook, contexto ou rota precisa de ser alterado.

## Data Models

O dicionário ES segue a mesma estrutura flat de chaves `namespace.identifier` usada por PT e EN. Não há tipos novos.

```typescript
// Estrutura existente — sem alterações
type Language = 'pt' | 'en' | 'es';
type TranslationKey = keyof typeof translations.pt;
```

A paridade de chaves entre PT, EN e ES é um invariante que os testes devem verificar.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Paridade de chaves ES ↔ PT

*Para qualquer* chave presente no dicionário merged PT (base + extended), essa chave deve existir no dicionário ES; e para qualquer chave em ES, deve existir em PT. O conjunto de chaves deve ser idêntico.

**Validates: Requirements 1.1, 1.2, 1.3, 3.1**

### Property 2: Traduções ES não vazias

*Para qualquer* chave no dicionário ES, o valor associado não deve ser uma string vazia.

**Validates: Requirements 1.1, 1.2, 5.2**

### Property 3: Lookup correto com idioma "es"

*Para qualquer* chave presente no ES_Dictionary, quando o idioma ativo é `"es"`, a função `t(key)` deve retornar exatamente o valor definido em ES_Dictionary para essa chave.

**Validates: Requirements 2.1, 2.2, 3.2, 3.3, 3.4**

### Property 4: Fallback chain para chaves ausentes em ES

*Para qualquer* chave que exista em PT mas não em ES, quando o idioma ativo é `"es"`, a função `t(key)` deve retornar a tradução PT (e não a chave em bruto nem a tradução EN).

**Validates: Requirements 1.5**

### Property 5: Round-trip de mudança de idioma

*Para qualquer* idioma L ∈ {pt, en} e qualquer chave k, mudar o idioma de L para ES e depois de volta para L deve resultar em `t(k)` retornar o mesmo valor que retornava antes da mudança.

**Validates: Requirements 4.1, 4.2, 4.4**

### Property 6: Idempotência de seleção de idioma

*Para qualquer* chave k, mudar o idioma para `"es"` N vezes consecutivas (N ≥ 1) deve produzir o mesmo resultado que mudar uma única vez.

**Validates: Requirements 4.3**

## Error Handling

Não há novos caminhos de erro introduzidos por esta feature. O mecanismo de fallback existente já trata chaves ausentes. O único risco é uma chave em PT não ter correspondência em ES — o fallback chain garante que a UI nunca mostra uma chave em bruto.

Durante o desenvolvimento, se uma chave for adicionada a PT/EN no futuro sem ser adicionada a ES, o teste de paridade de chaves (Property 1) falhará, alertando o developer.

## Testing Strategy

### Abordagem dual

Os testes existem em `app/frontend/src/i18n/__tests__/translations.test.ts`. A estratégia combina:

- **Testes de exemplo**: verificam comportamentos específicos e conhecidos (ex: `common.save` → "Guardar")
- **Testes de propriedade**: verificam invariantes universais sobre o conjunto completo de chaves

### Testes de propriedade (property-based)

Biblioteca: **fast-check** (já disponível no ecossistema TypeScript/Vitest).

Cada teste de propriedade deve correr no mínimo **100 iterações**.

Tag format: `Feature: spanish-language-support, Property {N}: {texto}`

| Propriedade | Teste |
|---|---|
| P1: Paridade de chaves | Iterar sobre todas as chaves de PT e verificar existência em ES |
| P2: Valores não vazios | Iterar sobre todas as chaves de ES e verificar `value.length > 0` |
| P3: Lookup correto | `fc.constantFrom(...keys)` → verificar `t(key, 'es') === es[key]` |
| P4: Fallback chain | Chave fictícia em PT mas não em ES → `t(key, 'es')` retorna valor PT |
| P5: Round-trip | `fc.constantFrom('pt', 'en')` + `fc.constantFrom(...keys)` → mudar L→ES→L preserva valor |
| P6: Idempotência | `fc.integer({min:1, max:10})` → mudar para ES N vezes = mudar uma vez |

### Testes de exemplo (unit)

- `common.save` em ES é `"Guardar"` (não `"Save"`)
- `settings.title` em ES é `"Configuración"` (não `"Settings"`)
- `nav.trips` em ES é `"Viajes"` (não `"Trips"`)
- O Language_Selector contém a opção `"🇪🇸 Español"`
- Após mudar para ES, `localStorage` contém `"es"`
- Após reload com `localStorage = "es"`, o idioma inicial é `"es"`

### Equilíbrio

Os testes de propriedade cobrem a correção estrutural (paridade, não-vazio, lookup). Os testes de exemplo cobrem a qualidade das traduções (distinção ES vs EN para chaves representativas) e comportamentos de UI específicos. Evitar duplicar cobertura entre os dois tipos.
