# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Language Change Updates Interface
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: language change from PT to EN/ES in Settings page
  - Test that when user selects a different language (EN or ES) in Settings dropdown, all visible translations update immediately
  - Verify that components using `t()` function (Sidebar, Navbar, Settings labels) display translations in the new language
  - Test implementation details from Bug Condition in design: `isBugCondition(input)` where `input.action == 'selectLanguage' AND input.newLanguage != currentLanguage`
  - The test assertions should match the Expected Behavior Properties from design: interface shows translations in new language
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found to understand root cause (e.g., "Selected EN but Sidebar still shows 'Monitorização' instead of 'Monitoring'")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Language Settings Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (navigation, authentication, other settings)
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements:
    - Navigation between pages (Dashboard → Trips → Map) preserves Router state
    - Theme setting changes (Light ↔ Dark) apply correctly
    - Units setting changes (Metric ↔ Imperial) save correctly
    - Map style changes (Streets ↔ Satellite) apply correctly
    - Authentication flow (login/logout) works correctly
    - Default language is PT on first access
    - Translation fallback PT → EN works for missing keys
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for language selector not updating interface

  - [x] 3.1 Reposition TranslatedApp wrapper inside Router
    - Move `<TranslatedApp>` from above `<AuthProvider>` to inside `<Router>`
    - Wrap the `<div className="App">` content with `<TranslatedApp>`
    - Ensure hierarchy: I18nProvider → AuthProvider → Router → TranslatedApp → DemoProvider → Layout
    - This preserves Router state while forcing re-render of internal components when `_renderKey` changes
    - _Bug_Condition: isBugCondition(input) where input.action == 'selectLanguage' AND input.newLanguage != currentLanguage AND TranslatedApp is positioned ABOVE Router_
    - _Expected_Behavior: All components using t() re-render with new translations when language changes_
    - _Preservation: Router state, authentication, other settings, default language PT, translation fallback_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4_

  - [x] 3.2 Remove window.location.reload() from Settings.tsx
    - Remove the `if (oldLanguage !== form.language)` block that calls `window.location.reload()`
    - The TranslatedApp wrapper now handles re-rendering automatically via `_renderKey`
    - Keep the `setI18nLanguage(form.language)` call which updates the language state
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Language Change Updates Interface
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify that selecting EN in Settings updates all visible translations (Sidebar, Navbar, Settings labels)
    - Verify that selecting ES in Settings updates all visible translations
    - Verify that no page reload is needed for translations to update
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Language Settings Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix:
      - Navigation between pages works correctly
      - Theme changes apply correctly
      - Units changes save correctly
      - Map style changes apply correctly
      - Authentication flow unchanged
      - Default language is still PT
      - Translation fallback still works
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run all tests (bug condition + preservation)
  - Verify no regressions in existing functionality
  - Verify language selector now updates interface immediately
  - Ask user if questions arise
