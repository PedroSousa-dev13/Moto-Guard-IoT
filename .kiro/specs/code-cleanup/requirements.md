# Requirements Document

## Introduction

O projeto MotoGuard IoT acumulou, ao longo do desenvolvimento iterativo, código que já não serve propósito ativo: funções e variáveis não referenciadas, stubs e TODOs que nunca foram implementados, e testes que cobrem código removido ou que duplicam verificações já existentes. Esta limpeza abrange o frontend (React/TypeScript), o backend (Node.js/TypeScript) e o módulo ML (Python), com o objetivo de reduzir ruído, melhorar a legibilidade e garantir que a suite de testes reflita apenas comportamento real e atual do sistema.

## Glossary

- **Dead_Code**: Código que existe no repositório mas nunca é executado nem referenciado por nenhum caminho de execução ativo.
- **Stub**: Função, método ou módulo com corpo vazio, `throw new Error("not implemented")`, `pass`, `TODO`, `FIXME` ou `placeholder` que indica implementação pendente.
- **Obsolete_Test**: Teste que verifica comportamento de código já removido, que duplica exatamente outro teste existente, ou cujo `describe`/`it` descreve funcionalidade que não existe no sistema.
- **Frontend**: Aplicação React/TypeScript em `app/frontend/src/`.
- **Backend**: Serviço Node.js/TypeScript em `app/backend/src/`.
- **ML_Module**: Scripts Python em `ml/` e `ml/tests/`.
- **Test_Suite**: Conjunto de ficheiros de teste em `app/tests/`, `app/frontend/src/**/*.test.{ts,tsx}` e `ml/tests/`.
- **Cleanup_Tool**: O processo (humano ou automatizado) que executa esta limpeza.
- **CI**: Pipeline de integração contínua que executa a Test_Suite.

---

## Requirements

### Requirement 1: Identificação de Dead Code no Frontend

**User Story:** Como developer, quero identificar e remover código morto no frontend, para que o código-base seja mais fácil de ler e manter.

#### Acceptance Criteria

1. THE Cleanup_Tool SHALL identificar todas as funções, variáveis e imports exportados no Frontend que não são referenciados por nenhum ficheiro ativo.
2. WHEN uma função ou variável é identificada como Dead_Code, THE Cleanup_Tool SHALL removê-la sem alterar o comportamento observável da aplicação.
3. WHEN um import é identificado como não utilizado num ficheiro do Frontend, THE Cleanup_Tool SHALL remover esse import.
4. IF a remoção de Dead_Code quebrar a compilação TypeScript, THEN THE Cleanup_Tool SHALL restaurar o estado anterior e registar o conflito.
5. THE Frontend SHALL compilar sem erros de TypeScript após a remoção de Dead_Code.

---

### Requirement 2: Identificação de Dead Code no Backend

**User Story:** Como developer, quero identificar e remover código morto no backend, para que os serviços sejam mais fáceis de auditar e manter.

#### Acceptance Criteria

1. THE Cleanup_Tool SHALL identificar todas as funções, variáveis e imports exportados no Backend que não são referenciados por nenhum ficheiro ativo.
2. WHEN uma função ou variável é identificada como Dead_Code no Backend, THE Cleanup_Tool SHALL removê-la sem alterar o comportamento dos endpoints REST ativos.
3. WHEN um import é identificado como não utilizado num ficheiro do Backend, THE Cleanup_Tool SHALL remover esse import.
4. IF a remoção de Dead_Code no Backend quebrar a compilação TypeScript, THEN THE Cleanup_Tool SHALL restaurar o estado anterior e registar o conflito.
5. THE Backend SHALL compilar sem erros de TypeScript após a remoção de Dead_Code.

---

### Requirement 3: Remoção de Stubs e TODOs não implementados no Frontend

**User Story:** Como developer, quero remover stubs e TODOs que nunca serão implementados no frontend, para que o código reflita apenas funcionalidade real.

#### Acceptance Criteria

1. THE Cleanup_Tool SHALL identificar todos os Stubs no Frontend, incluindo funções com corpo `throw new Error("not implemented")`, comentários `// TODO`, `// FIXME`, e blocos `/* placeholder */`.
2. WHEN um Stub é identificado e a funcionalidade correspondente não está planeada no roadmap ativo, THE Cleanup_Tool SHALL remover o Stub e qualquer referência a ele.
3. WHEN um Stub é identificado e a funcionalidade está planeada, THE Cleanup_Tool SHALL manter o Stub e adicionar um comentário `// PLANNED: <descrição>` em substituição do TODO/FIXME.
4. THE Frontend SHALL compilar sem erros após a remoção de Stubs.

---

### Requirement 4: Remoção de Stubs e TODOs não implementados no Backend

**User Story:** Como developer, quero remover stubs e TODOs que nunca serão implementados no backend, para que os serviços reflitam apenas lógica real.

#### Acceptance Criteria

1. THE Cleanup_Tool SHALL identificar todos os Stubs no Backend, incluindo funções com corpo `throw new Error("not implemented")`, comentários `// TODO`, `// FIXME`, e blocos `/* placeholder */`.
2. WHEN um Stub é identificado e a funcionalidade correspondente não está planeada no roadmap ativo, THE Cleanup_Tool SHALL remover o Stub e qualquer referência a ele.
3. WHEN um Stub é identificado e a funcionalidade está planeada, THE Cleanup_Tool SHALL manter o Stub e adicionar um comentário `// PLANNED: <descrição>` em substituição do TODO/FIXME.
4. THE Backend SHALL compilar sem erros após a remoção de Stubs.

---

### Requirement 5: Remoção de Stubs e TODOs no ML_Module

**User Story:** Como developer, quero remover stubs e TODOs não implementados no módulo ML, para que os scripts Python reflitam apenas lógica funcional.

#### Acceptance Criteria

1. THE Cleanup_Tool SHALL identificar todos os Stubs no ML_Module, incluindo funções com corpo `pass`, `raise NotImplementedError`, comentários `# TODO` e `# FIXME`.
2. WHEN um Stub é identificado e a funcionalidade não está planeada, THE Cleanup_Tool SHALL remover o Stub e qualquer referência a ele.
3. WHEN um Stub é identificado e a funcionalidade está planeada, THE Cleanup_Tool SHALL substituir o comentário por `# PLANNED: <descrição>`.
4. THE ML_Module SHALL executar sem erros de importação após a remoção de Stubs.

---

### Requirement 6: Limpeza de Obsolete_Tests no Frontend

**User Story:** Como developer, quero remover testes obsoletos ou duplicados no frontend, para que a Test_Suite seja confiável e rápida.

#### Acceptance Criteria

1. THE Cleanup_Tool SHALL identificar todos os Obsolete_Tests no Frontend, incluindo testes que referenciam componentes, hooks ou utilitários removidos.
2. THE Cleanup_Tool SHALL identificar testes duplicados no Frontend, definidos como dois ou mais testes com o mesmo `describe` + `it` e a mesma asserção central.
3. WHEN um Obsolete_Test é identificado, THE Cleanup_Tool SHALL remover o bloco `it(...)` correspondente.
4. WHEN um teste duplicado é identificado, THE Cleanup_Tool SHALL manter apenas uma instância e remover as restantes.
5. IF a remoção de um teste reduzir a cobertura de um caminho crítico (autenticação, pipeline ML, notificações), THEN THE Cleanup_Tool SHALL registar o aviso sem remover o teste.
6. THE Test_Suite do Frontend SHALL executar sem erros após a limpeza.

---

### Requirement 7: Limpeza de Obsolete_Tests no Backend

**User Story:** Como developer, quero remover testes obsoletos ou duplicados no backend, para que a Test_Suite reflita apenas comportamento atual dos serviços.

#### Acceptance Criteria

1. THE Cleanup_Tool SHALL identificar todos os Obsolete_Tests no Backend, incluindo testes que importam funções ou módulos removidos.
2. THE Cleanup_Tool SHALL identificar testes duplicados no Backend, definidos como dois ou mais testes com o mesmo `describe` + `it` e a mesma asserção central.
3. WHEN um Obsolete_Test é identificado, THE Cleanup_Tool SHALL remover o bloco `it(...)` correspondente.
4. WHEN um teste duplicado é identificado, THE Cleanup_Tool SHALL manter apenas uma instância e remover as restantes.
5. IF a remoção de um teste reduzir a cobertura de um caminho crítico (autenticação, pipeline ML, alertas), THEN THE Cleanup_Tool SHALL registar o aviso sem remover o teste.
6. THE Test_Suite do Backend SHALL executar sem erros após a limpeza.

---

### Requirement 8: Limpeza de Obsolete_Tests no ML_Module

**User Story:** Como developer, quero remover testes obsoletos ou duplicados no módulo ML, para que os testes Python reflitam apenas o comportamento atual do pipeline.

#### Acceptance Criteria

1. THE Cleanup_Tool SHALL identificar todos os Obsolete_Tests no ML_Module, incluindo testes que importam funções removidas de `features.py` ou `infer.py`.
2. THE Cleanup_Tool SHALL identificar testes duplicados no ML_Module, definidos como dois ou mais métodos de teste com a mesma asserção central sobre o mesmo input.
3. WHEN um Obsolete_Test é identificado, THE Cleanup_Tool SHALL remover o método de teste correspondente.
4. WHEN um teste duplicado é identificado, THE Cleanup_Tool SHALL manter apenas uma instância e remover as restantes.
5. THE Test_Suite do ML_Module SHALL executar sem erros após a limpeza.

---

### Requirement 9: Preservação de Testes Válidos

**User Story:** Como developer, quero garantir que os testes válidos e ativos não são removidos durante a limpeza, para que a cobertura de funcionalidades críticas seja mantida.

#### Acceptance Criteria

1. THE Cleanup_Tool SHALL preservar todos os testes que verificam comportamento ativo e documentado no sistema, incluindo testes de property-based testing com `fast-check` e `hypothesis`.
2. WHEN um teste usa property-based testing, THE Cleanup_Tool SHALL tratá-lo como não-removível a menos que a função testada tenha sido removida.
3. THE Test_Suite completa (Frontend + Backend + ML_Module) SHALL passar sem falhas após a limpeza.
4. FOR ALL testes preservados, a execução da Test_Suite após a limpeza SHALL produzir o mesmo resultado que antes da limpeza (round-trip de resultados).

---

### Requirement 10: Integridade da Compilação após Limpeza

**User Story:** Como developer, quero garantir que o projeto compila e os testes passam após a limpeza, para que a limpeza não introduza regressões.

#### Acceptance Criteria

1. WHEN a limpeza de Dead_Code, Stubs ou Obsolete_Tests é concluída, THE Frontend SHALL compilar com `tsc --noEmit` sem erros.
2. WHEN a limpeza é concluída, THE Backend SHALL compilar com `tsc --noEmit` sem erros.
3. WHEN a limpeza é concluída, THE ML_Module SHALL importar sem erros com `python -c "import features; import infer"`.
4. WHEN a limpeza é concluída, THE Test_Suite SHALL executar com todos os testes a passar.
5. IF algum passo de verificação falhar, THEN THE Cleanup_Tool SHALL reverter as alterações do passo falhado e registar o erro detalhado.
