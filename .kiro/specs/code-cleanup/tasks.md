# Tasks — Code Cleanup

## Task List

- [x] 1. Limpeza de Dead Code no Frontend
  - [x] 1.1 Identificar imports não utilizados em todos os ficheiros `.ts`/`.tsx` de `app/frontend/src/`
  - [x] 1.2 Remover imports não utilizados identificados
  - [x] 1.3 Identificar funções e variáveis exportadas não referenciadas por nenhum ficheiro ativo
  - [x] 1.4 Remover funções e variáveis dead code identificadas
  - [x] 1.5 Verificar compilação TypeScript do Frontend (`tsc --noEmit`)
  - [x] 1.6 Executar test suite do Frontend (`vitest --run`) e confirmar que todos os testes passam

- [x] 2. Limpeza de Dead Code no Backend
  - [x] 2.1 Identificar imports não utilizados em todos os ficheiros `.ts` de `app/backend/src/`
  - [x] 2.2 Remover imports não utilizados identificados
  - [x] 2.3 Identificar funções e variáveis exportadas não referenciadas por nenhum ficheiro ativo
  - [x] 2.4 Remover funções e variáveis dead code identificadas
  - [x] 2.5 Verificar compilação TypeScript do Backend (`tsc --noEmit`)
  - [x] 2.6 Executar test suite do Backend (`vitest --run` em `app/`) e confirmar que todos os testes passam

- [x] 3. Remoção de Stubs e TODOs no Frontend
  - [x] 3.1 Localizar todos os `// TODO`, `// FIXME` e `/* placeholder */` em `app/frontend/src/`
  - [x] 3.2 Para cada stub encontrado, determinar se a funcionalidade está planeada no roadmap ativo
  - [x] 3.3 Remover stubs não planeados e as suas referências
  - [x] 3.4 Substituir stubs planeados por `// PLANNED: <descrição>`
  - [x] 3.5 Verificar compilação TypeScript do Frontend após remoção de stubs
  - [x] 3.6 Confirmar ausência de `// TODO` / `// FIXME` não substituídos no Frontend

- [x] 4. Remoção de Stubs e TODOs no Backend
  - [x] 4.1 Localizar todos os `// TODO`, `// FIXME` e `/* placeholder */` em `app/backend/src/`
  - [x] 4.2 Para cada stub encontrado, determinar se a funcionalidade está planeada no roadmap ativo
  - [x] 4.3 Remover stubs não planeados e as suas referências
  - [x] 4.4 Substituir stubs planeados por `// PLANNED: <descrição>`
  - [x] 4.5 Verificar compilação TypeScript do Backend após remoção de stubs
  - [x] 4.6 Confirmar ausência de `// TODO` / `// FIXME` não substituídos no Backend

- [x] 5. Remoção de Stubs e TODOs no ML Module
  - [x] 5.1 Localizar todos os `# TODO`, `# FIXME`, `pass` (em funções não triviais) e `raise NotImplementedError` em `ml/`
  - [x] 5.2 Para cada stub encontrado, determinar se a funcionalidade está planeada
  - [x] 5.3 Remover stubs não planeados e as suas referências
  - [x] 5.4 Substituir stubs planeados por `# PLANNED: <descrição>`
  - [x] 5.5 Verificar importação do ML Module (`python -c "import features; import infer"`)

- [x] 6. Limpeza de Obsolete Tests no Frontend
  - [x] 6.1 Identificar testes que importam componentes, hooks ou utilitários removidos nas tarefas 1–3
  - [x] 6.2 Identificar testes duplicados (mesmo `describe` + `it` + asserção central)
  - [x] 6.3 Verificar que nenhum teste a remover pertence a caminho crítico (autenticação, notificações, alertas)
  - [x] 6.4 Remover blocos `it(...)` de testes obsoletos identificados
  - [x] 6.5 Manter apenas uma instância de cada teste duplicado
  - [x] 6.6 Executar test suite do Frontend e confirmar que todos os testes passam sem erros

- [x] 7. Limpeza de Obsolete Tests no Backend
  - [x] 7.1 Identificar testes em `app/tests/` que importam funções ou módulos removidos nas tarefas 2–4
  - [x] 7.2 Identificar testes duplicados no Backend
  - [x] 7.3 Verificar que nenhum teste a remover pertence a caminho crítico (autenticação, pipeline ML, alertas, email)
  - [x] 7.4 Remover blocos `it(...)` de testes obsoletos identificados
  - [x] 7.5 Manter apenas uma instância de cada teste duplicado
  - [x] 7.6 Executar test suite do Backend e confirmar que todos os testes passam sem erros

- [x] 8. Limpeza de Obsolete Tests no ML Module
  - [x] 8.1 Identificar testes em `ml/tests/` que importam funções removidas de `features.py` ou `infer.py`
  - [x] 8.2 Identificar métodos de teste duplicados (mesma asserção central sobre o mesmo input)
  - [x] 8.3 Remover métodos de teste obsoletos identificados
  - [x] 8.4 Manter apenas uma instância de cada teste duplicado
  - [x] 8.5 Executar test suite do ML Module (`pytest ml/tests/ -v`) e confirmar que todos os testes passam

- [x] 9. Verificação Final de Integridade
  - [x] 9.1 Executar compilação TypeScript do Frontend (`tsc --noEmit`) — deve passar sem erros
  - [x] 9.2 Executar compilação TypeScript do Backend (`tsc --noEmit`) — deve passar sem erros
  - [x] 9.3 Verificar importação do ML Module (`python -c "import features; import infer"`) — deve passar sem erros
  - [x] 9.4 Executar test suite completa do Frontend (`vitest --run`) — todos os testes devem passar
  - [x] 9.5 Executar test suite completa do Backend (`vitest --run` em `app/`) — todos os testes devem passar
  - [x] 9.6 Executar test suite completa do ML Module (`pytest ml/tests/ -v`) — todos os testes devem passar
  - [x] 9.7 Confirmar que os ficheiros de property-based tests existem e passam: `tripComparison.property.test.ts`, `demoData.test.ts`, `test_infer.py`
  - [x] 9.8 Confirmar ausência de `// TODO` / `// FIXME` não substituídos em todo o repositório
