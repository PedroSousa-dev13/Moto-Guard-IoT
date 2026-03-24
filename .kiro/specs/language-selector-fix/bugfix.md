# Bugfix Requirements Document

## Introduction

O utilizador reportou que na página de Settings existe um seletor de idioma (Português, English, Español), mas apesar de ter sido implementada a lógica de i18n, a interface não muda de idioma quando o utilizador tenta selecionar um idioma diferente. O sistema de internacionalização está completo com I18nProvider, TranslatedApp wrapper, useI18n hook, e traduções em localStorage, mas algo impede que a mudança de idioma seja refletida na interface.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN o utilizador seleciona um idioma diferente no dropdown de Settings (PT, EN, ES) THEN a interface não muda de idioma ou não reflete a mudança esperada

1.2 WHEN o utilizador seleciona um idioma e a página recarrega (window.location.reload()) THEN as traduções não são aplicadas aos componentes da aplicação

1.3 WHEN o sistema tenta aplicar as traduções após mudança de idioma THEN os componentes não re-renderizam com as novas traduções

### Expected Behavior (Correct)

2.1 WHEN o utilizador seleciona um idioma diferente no dropdown de Settings THEN o sistema SHALL atualizar imediatamente todas as traduções visíveis na interface

2.2 WHEN o utilizador seleciona um idioma e a página recarrega THEN o sistema SHALL carregar e aplicar as traduções do idioma selecionado a todos os componentes

2.3 WHEN o sistema deteta uma mudança de idioma THEN o sistema SHALL forçar a re-renderização de todos os componentes que usam traduções

### Unchanged Behavior (Regression Prevention)

3.1 WHEN o utilizador acede à aplicação pela primeira vez sem idioma configurado THEN o sistema SHALL CONTINUE TO usar Português como idioma padrão

3.2 WHEN o utilizador usa a função t() do hook useI18n com uma chave válida THEN o sistema SHALL CONTINUE TO retornar a tradução correta para o idioma atual

3.3 WHEN o utilizador muda outras definições em Settings (tema, unidades, etc.) THEN o sistema SHALL CONTINUE TO guardar e aplicar essas alterações corretamente

3.4 WHEN uma chave de tradução não existe no idioma selecionado THEN o sistema SHALL CONTINUE TO fazer fallback para Português e depois Inglês
