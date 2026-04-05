# Documento de Requisitos

## Introdução

Adicionar suporte completo ao idioma espanhol (es) na aplicação MotoGuard IoT. Atualmente a aplicação suporta português (pt) e inglês (en), e a infraestrutura técnica já está parcialmente preparada para espanhol — o tipo `Language` inclui `"es"`, o seletor de idioma já apresenta a opção "Español", e o `I18nContext` já usa `translationsWithEs`. No entanto, as traduções em espanhol são atualmente uma cópia direta do inglês (`const es = { ...translations.en }`), sem qualquer tradução real.

Esta funcionalidade consiste em substituir esse placeholder por traduções espanholas reais e completas, cobrindo todas as chaves existentes nos dicionários `translations` e `extendedTranslations`, e garantir que o sistema de fallback e os testes refletem o novo idioma.

## Glossário

- **I18n_System**: O sistema de internacionalização da aplicação, composto por `translations.ts`, `I18nContext.tsx`, `TranslatedApp.tsx` e o hook `useI18n`.
- **Translation_Key**: Uma chave de string no formato `namespace.identifier` (ex: `common.save`) que identifica uma entrada de tradução.
- **Language_Selector**: O elemento `<select>` na página de Definições que permite ao utilizador escolher o idioma da interface.
- **Fallback_Chain**: A sequência de idiomas consultados quando uma chave não existe no idioma atual: idioma atual → português (pt) → inglês (en) → chave original.
- **ES_Dictionary**: O objeto de traduções em espanhol a ser criado em `translations.ts`, cobrindo todos os namespaces existentes.
- **Extended_Translations**: O objeto `extendedTranslations` em `translations.ts` que contém traduções adicionais para PT e EN além do dicionário base.
- **Round_Trip**: Propriedade que garante que uma operação seguida da sua inversa retorna ao estado original (ex: mudar para ES e voltar para PT restaura as traduções portuguesas).

---

## Requisitos

### Requisito 1: Dicionário de Traduções Espanholas Completo

**User Story:** Como utilizador de língua espanhola, quero que toda a interface da aplicação esteja traduzida para espanhol, para que possa usar a aplicação na minha língua nativa.

#### Critérios de Aceitação

1. THE I18n_System SHALL conter um dicionário ES com traduções reais em espanhol para todas as Translation_Keys presentes no dicionário PT.
2. THE I18n_System SHALL conter um dicionário ES com traduções reais em espanhol para todas as Translation_Keys presentes no `extendedTranslations` PT.
3. WHEN o dicionário ES é comparado com o dicionário PT, THE I18n_System SHALL ter o mesmo conjunto de Translation_Keys em ambos os dicionários.
4. THE I18n_System SHALL ter traduções ES distintas das traduções EN para todas as chaves onde o espanhol difere do inglês (ex: `common.save` → "Guardar", não "Save").
5. IF uma Translation_Key existe em PT mas não existe em ES, THEN THE Fallback_Chain SHALL retornar a tradução PT como fallback.

---

### Requisito 2: Integração com o Seletor de Idioma

**User Story:** Como utilizador, quero selecionar espanhol no seletor de idioma das Definições, para que a interface mude imediatamente para espanhol.

#### Critérios de Aceitação

1. WHEN o utilizador seleciona "Español" no Language_Selector, THE I18n_System SHALL atualizar o idioma ativo para `"es"`.
2. WHEN o idioma ativo é `"es"`, THE I18n_System SHALL apresentar todas as strings da interface usando o ES_Dictionary.
3. WHEN o utilizador seleciona "Español" no Language_Selector, THE I18n_System SHALL persistir a preferência `"es"` em `localStorage` via `settings.ts`.
4. WHEN a aplicação é recarregada após o utilizador ter selecionado espanhol, THE I18n_System SHALL inicializar com o idioma `"es"`.
5. THE Language_Selector SHALL apresentar a opção espanhol com a etiqueta "🇪🇸 Español".

---

### Requisito 3: Cobertura Completa de Namespaces

**User Story:** Como utilizador de língua espanhola, quero que todas as secções da aplicação estejam traduzidas, para que não encontre texto em inglês ou português ao navegar.

#### Critérios de Aceitação

1. THE ES_Dictionary SHALL conter traduções para todos os namespaces existentes: `common`, `nav`, `sidebar`, `dashboard`, `trips`, `tripDetail`, `garage`, `settings`, `auth`, `demo`, `alerts`, `analytics`, `map`, `gpx`, `profile`, `resetPassword`, `onboarding`, `command`, `simulator`, `about`, `home`, `category`, `source`, `eventType`, `status`, `motoCategory`, `time`, `validation`, `notification`, `error`, `units`.
2. WHEN o idioma ativo é `"es"`, THE I18n_System SHALL apresentar o texto do namespace `settings` (título, subtítulo, opções) em espanhol.
3. WHEN o idioma ativo é `"es"`, THE I18n_System SHALL apresentar o texto do namespace `nav` e `sidebar` em espanhol.
4. WHEN o idioma ativo é `"es"`, THE I18n_System SHALL apresentar mensagens de erro (`error.*`) e validação (`validation.*`) em espanhol.

---

### Requisito 4: Propriedade Round-Trip de Mudança de Idioma

**User Story:** Como utilizador, quero poder alternar entre idiomas sem perder traduções, para que a interface seja sempre consistente independentemente da ordem em que mudo de idioma.

#### Critérios de Aceitação

1. WHEN o utilizador muda de PT para ES e depois volta para PT, THE I18n_System SHALL apresentar as mesmas traduções portuguesas que apresentava antes da mudança.
2. WHEN o utilizador muda de EN para ES e depois volta para EN, THE I18n_System SHALL apresentar as mesmas traduções inglesas que apresentava antes da mudança.
3. WHEN o utilizador muda de idioma para ES múltiplas vezes consecutivas, THE I18n_System SHALL apresentar o mesmo resultado que se tivesse mudado apenas uma vez (idempotência).
4. FOR ALL sequências de mudanças de idioma entre PT, EN e ES, THE I18n_System SHALL sempre apresentar as traduções corretas para o idioma final selecionado.

---

### Requisito 5: Cobertura de Testes para Espanhol

**User Story:** Como developer, quero que os testes existentes cubram o idioma espanhol, para que regressões nas traduções ES sejam detetadas automaticamente.

#### Critérios de Aceitação

1. THE I18n_System SHALL ter testes que verificam que o dicionário ES existe e tem o mesmo conjunto de Translation_Keys que PT e EN.
2. THE I18n_System SHALL ter testes que verificam que as traduções ES não estão vazias.
3. THE I18n_System SHALL ter testes que verificam que as traduções ES são distintas das traduções EN para uma amostra representativa de chaves.
4. WHEN o idioma é alterado para ES, THE I18n_System SHALL ter testes que verificam que a interface apresenta texto em espanhol (propriedade round-trip PT → ES → PT).
5. IF o dicionário ES tiver menos Translation_Keys que o dicionário PT, THEN THE I18n_System SHALL falhar os testes de paridade de chaves.
