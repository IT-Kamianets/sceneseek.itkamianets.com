# Agent Guide

This repository is an Angular 22 HoReCa marketing site template that consumes base conventions,
AI guidance, and reusable defaults from the npm package `@wawjs/ngx-default`.

Treat this project as a prerender-first business website. The app owns its pages, routes, layouts,
business content, company profile, static assets, and bootstrap wiring. Reusable default feature
APIs must be imported from `@wawjs/ngx-default`.

## Quick Reference

- Stack: Angular 22, TypeScript 6, Angular SSR/prerender, Tailwind CSS, SCSS
- Package manager: `npm`
- Main goal: fast, clean, SEO-friendly HoReCa landing pages
- Primary output: prerendered static site from `dist/app/browser`
- Local app source: `src/`
- App-owned data bridge and company profile: `src/app/feature/bootstrap/` and
  `src/app/feature/company/`
- Reusable package: `@wawjs/ngx-default`
- Package guidance: `node_modules/@wawjs/ngx-default/ai/`

## Package Guidance

After reading this file, load the package guidance from:

```text
node_modules/@wawjs/ngx-default/ai/
```

The package is scoped. Use `node_modules/@wawjs/ngx-default`, not
`node_modules/wawjs/ngx-default`.

Start with `node_modules/@wawjs/ngx-default/ai/onboarding.md`, then open only the guides needed for
the task:

- `node_modules/@wawjs/ngx-default/ai/architecture.md`
- `node_modules/@wawjs/ngx-default/ai/code-style.md`
- `node_modules/@wawjs/ngx-default/ai/content-pages.md`
- `node_modules/@wawjs/ngx-default/ai/seo.md`
- `node_modules/@wawjs/ngx-default/ai/media.md`
- `node_modules/@wawjs/ngx-default/ai/tooling.md`
- `node_modules/@wawjs/ngx-default/ai/task-execution.md`
- `node_modules/@wawjs/ngx-default/ai/decisions/index.md`

Read the decisions index when a task changes a long-lived convention, resolves an ambiguity likely
to recur, or affects package-facing behavior.

## Companion `@wawjs/*` Package Guidance

Installed `@wawjs/*` packages may provide a package-level `AI.md` file at:

```text
node_modules/@wawjs/<package>/AI.md
```

Before adding or changing code that uses one of these companion packages, read that package's
`AI.md` first.

Current companion package guides include:

- `node_modules/@wawjs/ngx-core/AI.md`
- `node_modules/@wawjs/ngx-translate/AI.md`
- `node_modules/@wawjs/ngx-ui/AI.md`

## Universal Rules

- Treat this repo as a marketing website first, not as a complex application shell.
- Prefer simple, static, content-first pages over heavy abstractions.
- Preserve prerender compatibility by default.
- Keep changes small, clear, and easy to review.
- Prefer Tailwind for layout, spacing, typography, sizing, responsive behavior, and utility styling.
- Use local page content/config over new services unless reuse is real and repeated.
- Do not introduce CMS, API fetching, dashboards, or heavy state management unless explicitly
  requested.

## Default Technical Stance

Use these as defaults unless the local code or the task gives a concrete reason to do otherwise:

- Angular 22 modern patterns only.
- Standalone components are the default. Do not add NgModules for new work.
- Do not set `changeDetection: ChangeDetectionStrategy.OnPush`; OnPush is the Angular 22 default.
- Use `ChangeDetectionStrategy.Eager` only when eager change detection is explicitly required.
- Use `@Service()` for plain root singleton services. Keep `@Injectable()` for guards or deeper DI configuration.
- Use signals for local UI state and derived state.
- Prefer native control flow (`@if`, `@for`, `@switch`) in templates.
- Use Angular 22 template spread and short arrow functions only for small local UI glue. Keep filtering, sorting, async work, and workflow decisions in TypeScript.
- Use grouped `@case` blocks and `@default never;` when switching over a closed union type.
- Use Angular bindings instead of manual DOM work.
- Use `NgOptimizedImage` for static images when feasible.
- Keep browser-only code guarded so prerender remains safe.
- Prefer `ngxResource()` from `@wawjs/ngx-core` for persisted or generic signal-based async reads. Keep direct imperative async code for bootstrap restore, migrations, and startup fallback flows.
- Prefer `ThemeService` from `@wawjs/ngx-ui` for theme mode, density, radius, and persistence instead of adding duplicate browser storage or document attribute logic.

## Template Bootstrap Reminder

This repo is a template. When a user asks to "change SEO", "rebrand the site", "prepare the
template", or similar, do not stop at route meta only.

At minimum, inspect these surfaces and update the ones that still contain template values:

- `src/data/company/company.json` for shared company name, title, description, SEO defaults, and image
- `src/app/app.config.ts` for global metadata defaults that consume company data
- `src/app/app.routes.ts` for per-page `data.meta` overrides
- `src/index.html` for seed title/meta/canonical/social tags that should match the real project
- `src/assets/` for replaceable brand assets such as `logo.png` and `favicon.png`
- `CNAME` for the production domain
- `src/environments/environment.prod.ts` for `companyId` and any public runtime defaults that still
  point to template/demo values

Also check visible content so headings, hero copy, contacts, and CTA text stay aligned with the SEO
metadata.
