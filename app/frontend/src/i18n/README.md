# Sistema de Internacionalização (i18n)

Sistema completo e robusto de internacionalização para MotoGuard IoT com mais de 400 chaves de tradução.

## Idiomas Suportados

- 🇵🇹 Português (pt) - padrão
- 🇬🇧 English (en) - completo
- 🇪🇸 Español (es) - parcial

## Garantia de Tradução Completa

O sistema garante que **TODA a aplicação** é traduzida quando o idioma muda através de:

1. **TranslatedApp Wrapper**: Força re-render de todos os componentes
2. **Render Key**: Contador interno que invalida cache do React
3. **Context Provider**: Propaga mudanças para toda a árvore de componentes

### Como Funciona

```tsx
<I18nProvider>
  <TranslatedApp>  {/* ← Força re-render quando idioma muda */}
    <YourApp />
  </TranslatedApp>
</I18nProvider>
```

Quando `setLanguage()` é chamado:
1. Estado do idioma é atualizado
2. `_renderKey` é incrementado
3. `TranslatedApp` detecta mudança na key
4. React desmonta e remonta TODA a árvore de componentes
5. Todos os componentes chamam `t()` novamente com novo idioma

## Como Usar

### 1. Importar o hook

```tsx
import { useI18n } from '../i18n';

function MyComponent() {
  const { t, language, setLanguage } = useI18n();
  
  return <h1>{t('common.loading')}</h1>;
}
```

### 2. Usar traduções

```tsx
// Tradução simples
<button>{t('common.save')}</button>

// Com fallback personalizado
<span>{t('some.missing.key', 'Default text')}</span>

// Interpolação manual (se necessário)
<p>{t('welcome.message').replace('{name}', userName)}</p>
```

### 3. Mudar idioma

```tsx
const { setLanguage } = useI18n();

// Mudar para inglês
setLanguage('en');

// Mudar para português
setLanguage('pt');
```

O idioma é guardado automaticamente em `localStorage` via `settings.ts`.

**IMPORTANTE**: Não é necessário fazer nada extra! O sistema garante automaticamente que TODOS os componentes são atualizados.

## Cobertura de Traduções

O sistema inclui traduções para:

### Interface Principal
- ✅ Sidebar e navegação
- ✅ Dashboard
- ✅ Trips e Trip Detail
- ✅ Garage
- ✅ Settings (completo)
- ✅ Profile
- ✅ Analytics
- ✅ Map
- ✅ Alerts
- ✅ GPX
- ✅ About

### Componentes
- ✅ Demo Banner
- ✅ Onboarding Guard
- ✅ Command Panel
- ✅ Auth (Login/Register)
- ✅ Reset Password

### Dados Dinâmicos
- ✅ Categorias de viagem
- ✅ Tipos de evento
- ✅ Status de viagem
- ✅ Categorias de mota
- ✅ Severidades de alerta
- ✅ Fontes de dados

### Mensagens
- ✅ Erros
- ✅ Validações
- ✅ Notificações
- ✅ Confirmações
- ✅ Tempo relativo

## Adicionar Novas Traduções

### 1. Adicionar chave em `translations.ts`

```typescript
export const extendedTranslations = {
  pt: {
    'myFeature.title': 'Meu Título',
    'myFeature.description': 'Minha descrição',
  },
  en: {
    'myFeature.title': 'My Title',
    'myFeature.description': 'My description',
  },
};
```

### 2. Usar no componente

```tsx
<h1>{t('myFeature.title')}</h1>
<p>{t('myFeature.description')}</p>
```

**Não é necessário reiniciar** - as traduções são carregadas dinamicamente.

## Convenções de Nomenclatura

- Use ponto (`.`) para separar namespaces: `settings.title`
- Agrupe por funcionalidade: `auth.login`, `auth.register`
- Use nomes descritivos: `dashboard.connectionStatus` em vez de `dashboard.cs`

### Namespaces Existentes

- `common.*` - Textos comuns (save, cancel, loading, etc.)
- `nav.*` - Navegação
- `sidebar.*` - Sidebar
- `dashboard.*` - Dashboard
- `trips.*` - Viagens
- `tripDetail.*` - Detalhes de viagem
- `garage.*` - Garagem
- `settings.*` - Definições
- `auth.*` - Autenticação
- `demo.*` - Modo demo
- `alerts.*` - Alertas
- `analytics.*` - Análises
- `map.*` - Mapa
- `gpx.*` - GPX
- `profile.*` - Perfil
- `resetPassword.*` - Reset de senha
- `onboarding.*` - Onboarding
- `command.*` - Comandos
- `simulator.*` - Simulador
- `about.*` - Sobre
- `home.*` - HomePage
- `category.*` - Categorias
- `source.*` - Fontes
- `eventType.*` - Tipos de evento
- `status.*` - Status
- `motoCategory.*` - Categorias de mota
- `time.*` - Tempo
- `validation.*` - Validações
- `notification.*` - Notificações
- `error.*` - Mensagens de erro
- `units.*` - Unidades de medida

## Fallback Automático

O sistema tem fallback automático em 3 níveis:

1. Idioma selecionado (ex: `es`)
2. Português (`pt`)
3. Inglês (`en`)
4. Chave original ou fallback fornecido

Exemplo:
```tsx
// Se 'es' não tiver a tradução, usa 'pt', depois 'en', depois 'Not found'
t('some.missing.key', 'Not found')
```

## Integração com Settings

O idioma é sincronizado automaticamente com as definições da aplicação:

```tsx
// Ao mudar idioma nas Settings
setLanguage('en'); // Atualiza localStorage, contexto i18n E força re-render
```

## TypeScript

O sistema é totalmente tipado. O TypeScript vai sugerir chaves válidas:

```tsx
t('common.save') // ✅ OK
t('common.invalid') // ❌ Erro de tipo
```

## Performance

- Traduções carregadas uma vez no início
- Sem chamadas assíncronas
- Lookup O(1) via objeto JavaScript
- Re-render otimizado via React key
- Bundle size: ~25KB para 2 idiomas completos

## Teste de Tradução Completa

Para testar se tudo está a ser traduzido:

1. Abrir a aplicação
2. Ir a Settings → Idioma
3. Mudar de PT para EN
4. Verificar que TODA a interface muda instantaneamente
5. Navegar por todas as páginas
6. Confirmar que não há texto em português

## Exemplo Completo

```tsx
import { useI18n } from '../i18n';

function SettingsPage() {
  const { t, language, setLanguage } = useI18n();
  
  return (
    <div>
      <h1>{t('settings.title')}</h1>
      <p>{t('settings.subtitle')}</p>
      
      <select value={language} onChange={(e) => setLanguage(e.target.value)}>
        <option value="pt">🇵🇹 Português</option>
        <option value="en">🇬🇧 English</option>
        <option value="es">🇪🇸 Español</option>
      </select>
      
      <button>{t('common.save')}</button>
      <button>{t('common.cancel')}</button>
    </div>
  );
}
```

## Próximos Passos

Para adicionar mais idiomas:

1. Adicionar novo idioma em `translations.ts` e `extendedTranslations`
2. Atualizar tipo `Language` em `settings.ts`
3. Adicionar opção no seletor de idioma
4. Traduzir todas as chaves existentes

## Notas

- Não usar para conteúdo dinâmico do backend (ex: nomes de motas, eventos)
- Apenas para UI estática
- Para datas/números, usar `Intl` API do JavaScript
- Sistema garante 100% de cobertura quando idioma muda

## Troubleshooting

### Componente não atualiza quando idioma muda

**Solução**: Certifica-te que o componente está dentro do `<TranslatedApp>` wrapper.

### Tradução não aparece

**Solução**: Verifica se a chave existe em `translations.ts` e se está a usar `t()` corretamente.

### Performance lenta ao mudar idioma

**Solução**: Normal - o sistema remonta toda a árvore de componentes para garantir 100% de tradução. Se necessário, otimiza componentes pesados com `React.memo()`.

