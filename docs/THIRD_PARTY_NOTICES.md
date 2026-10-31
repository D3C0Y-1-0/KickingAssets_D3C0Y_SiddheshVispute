# Third-party notices

## Anatomy

Design reference and SVG construction tools: https://github.com/wheresryan22/anatomy

Reviewed README.md, SKILL.md, references/craft.md and references/react.md, plus the desk-computer construction reference, kit API and verification guide. The control station composition and geometry are original to GridSentinel. Its generated path markup uses Anatomy geometry helpers; the scoped CSS uses the kit's shading conventions. No example application or WebGL runtime is imported into the frontend.

Installed with `npx skills add wheresryan22/anatomy -a codex -y` into `.agents/skills/anatomy`. The installed skill is developer tooling, ignored by Git; `skills-lock.json` records the upstream source fingerprint. Generated application SVG geometry is tracked, so ordinary installation, builds and offline use require no skill download. Reinstall the skill only to regenerate the illustration with `node scripts/build-illustration.mjs --audit`.

MIT License

Copyright (c) 2026 Ryan

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Application dependencies

Frontend dependency versions are resolved in frontend/package-lock.json. Python versions are resolved in backend/requirements-lock.txt. Their original licenses remain with the packages. No bundled font, external image, external monitoring service or proprietary dataset is required at runtime.
