For every frontend task, first inspect the existing design system and identify the page's primary user goal. Then propose a visual direction, component structure, interaction states, responsive behavior, accessibility requirements, motion behavior, media placeholders, and performance risks before implementing. Do not produce generic template UI. Create an original, coherent EpiCare experience that is premium, emotionally intelligent, accessible, fast, and medically trustworthy.

## Frontend UI/UX Design Invariants

### Rule priority

These invariants apply to every frontend implementation unless the user explicitly overrides a specific requirement.

When inspecting an existing codebase, preserve working product behavior and existing accessibility patterns. Improve the visual design without unnecessarily rewriting stable functionality.

If a requirement is ambiguous, choose the safest, most accessible, most performant interpretation and briefly state the assumption before implementation.

### Required frontend workflow

Before modifying frontend code, the agent must:

1. Inspect the existing routes, components, design tokens, dependencies, and styling conventions.
2. Identify the primary user goal of the page or feature.
3. Identify existing reusable components before creating new ones.
4. Propose the visual direction and page composition.
5. Define the component structure and data flow.
6. Define interaction states and edge cases.
7. Define responsive behavior across viewport sizes.
8. Define accessibility and keyboard behavior.
9. Define motion behavior and reduced-motion fallbacks.
10. Identify required media assets and create documented placeholders.
11. Identify performance risks.
12. Implement the smallest modular solution that satisfies the requirements.
13. Test the changed experience and report any remaining limitations.

Do not begin implementation until the plan is clear, unless the task is a trivial one-line fix.

### Product vision

EpiCare must feel like a premium, human-centered healthcare product from 2026—not a generic dashboard, template, or AI-generated website.

The experience should communicate:

- Trust, safety, empathy, clinical credibility, and calm.
- A memorable visual identity that feels original rather than copied.
- The quality of a top-tier startup, medical product, and editorial brand combined.
- A realistic, polished, high-production interface that could be confidently shown in a design portfolio, product launch, or social-media case study.

Do not create visual effects merely to appear impressive. Every design decision must improve clarity, trust, usability, emotional connection, or product comprehension.

### Visual direction

Use a sophisticated visual system combining:

- Earthy greens, warm beige, soft sand, natural neutrals, medical blues, white, and carefully controlled accent colors.
- Premium glass surfaces with translucency, backdrop blur, layered depth, subtle borders, realistic shadows, and restrained highlights.
- High-quality typography with strong hierarchy, readable body text, carefully controlled letter spacing, and responsive type scaling.
- Editorial composition, asymmetric layouts, bento-style content groups, generous whitespace, intentional grids, and strong visual rhythm.
- Tactile details such as fine borders, soft gradients, subtle grain, realistic lighting, gentle depth, and carefully placed texture.
- Human and emotionally warm imagery instead of generic stock photography.
- Clear visual distinction between patient-facing, caregiver-facing, and clinical information.

Glassmorphism must support hierarchy and depth. Never use excessive blur, low-contrast text, decorative noise, or translucent surfaces that reduce readability.

### Signature experience

Each major page may have one memorable visual or interaction concept when it improves comprehension, trust, navigation, or emotional connection. Do not force a signature effect onto utility pages, forms, emergency flows, or clinically important tasks.

- A meaningful scroll narrative.
- An interactive health journey.
- A living care timeline.
- A responsive data visualization.
- A contextual 3D or depth-based object.
- A visual explanation of a complex medical process.
- A human-centered storytelling section.
- A distinctive dashboard composition.

The signature concept must remain understandable without animation and must not interfere with essential healthcare tasks.

Do not imitate a specific website, designer, Dribbble shot, Behance project, social-media advertisement, or competitor. Use external work only as inspiration, then create an original EpiCare interpretation.

### Motion and animation

Motion should make the interface feel responsive, alive, and premium while remaining calm and appropriate for healthcare.

Use:

- Scroll-triggered reveal animations for meaningful sections, with reduced-motion and performance fallbacks. Essential content must remain usable without animation.
- Staggered entrance animations for grouped content.
- Smooth page and section transitions.
- Kinetic or variable typography only where it improves storytelling.
- Hover, press, focus, loading, success, error, and disabled states.
- Subtle parallax, depth movement, magnetic interactions, and pointer responses where appropriate.
- Spring-like transitions with consistent easing and duration tokens.
- Skeleton loaders and meaningful progress states instead of unexplained spinners.

Animations must be purposeful, brief, smooth, and interruptible. Never animate every element at once.

Always support:

- `prefers-reduced-motion`.
- Keyboard navigation.
- Touch devices without hover.
- Low-power and slow-network devices.
- Users who disable animation.

Important content must be visible and understandable without JavaScript animation. Avoid forced scrolling, infinite animation, excessive parallax, flashing effects, and motion that could distract or disorient users.

### Interaction quality

Every interactive control must provide a complete state system:

- Default.
- Hover.
- Focus-visible.
- Pressed.
- Selected.
- Loading.
- Success.
- Error.
- Disabled.

Buttons and icons should use subtle scale, color, elevation, border, or glow changes—not exaggerated effects.

All icons must have an accessible label or be paired with visible explanatory text. Do not use icons alone when their meaning is ambiguous.

Interactions must provide immediate feedback. Destructive or clinically important actions require clear confirmation, understandable wording, and a safe recovery path.

### Accessibility and healthcare safety

Accessibility is a non-negotiable product requirement, not a later enhancement.

Use:

- Semantic HTML.
- WCAG 2.2 AA-friendly contrast and focus indicators.
- Correct heading hierarchy.
- Proper form labels, descriptions, validation, and error messages.
- Screen-reader announcements for dynamic state changes.
- Full keyboard operation.
- Touch targets appropriate for mobile use.
- No information conveyed by color alone.
- Accessible dialogs with focus trapping and escape behavior.
- Clear language suitable for users with different health literacy levels.

Never use visual polish to hide important medical information, warnings, consent requirements, or privacy controls.

### Modals, dialogs, and overlays

Confirmation dialogs, authentication prompts, consent flows, urgent alerts, and loading overlays must:

- Be centered and responsive.
- Use an accessible dialog implementation.
- Trap focus correctly.
- Close safely with Escape where appropriate.
- Prevent accidental background interaction.
- Use a blurred or dimmed backdrop without making the underlying content confusing.
- Explain what will happen before the user confirms.
- Provide visible loading, success, and failure states.

Do not use a modal when inline feedback or a dedicated page would be clearer.

### Responsive behavior

Design mobile-first and test at minimum:

- Small mobile screens.
- Large mobile screens.
- Tablet.
- Laptop.
- Large desktop.
- Touch and mouse input.
- Narrow and wide text settings.
- Zoomed layouts.

Do not simply shrink the desktop interface. Recompose the layout, navigation, data cards, forms, charts, and dialogs for each breakpoint.

### Realism and media

Use realistic visual details only when they improve understanding or trust.

For missing assets, create explicit placeholders and document:

- What asset is required.
- Whether it should be a photograph, illustration, video, 3D object, icon, or animation.
- Required dimensions and aspect ratio.
- Required filename.
- Exact folder location.
- Accessibility alt text or transcript requirements.
- Whether a lightweight fallback is required.

Do not invent final medical imagery, patient stories, testimonials, clinical outcomes, or healthcare claims.

### Component and implementation rules

Use official, documented, accessible libraries and standard hooks whenever they provide the required behavior.

Prefer:

- Small, reusable, composable components.
- A shared design-token system.
- Centralized colors, spacing, typography, radii, shadows, motion, and breakpoints.
- Typed component APIs.
- Semantic HTML.
- CSS variables and responsive styles.
- Official accessibility patterns.
- Reusable loading, empty, error, success, and permission states.

Do not duplicate components, hard-code repeated values, create fake interactions, or invent inaccessible custom controls when a reliable official implementation exists.

Every new component must define its states, responsive behavior, accessibility behavior, and failure state.

### Performance and quality gates

Premium design must not mean a heavy or slow website.

Before considering a feature complete:

- Avoid unnecessary JavaScript and excessive animation libraries.
- Lazy-load images, video, and non-critical content.
- Optimize image formats and dimensions.
- Respect reduced-motion preferences.
- Avoid large uncompressed media and unnecessary WebGL.
- Prevent layout shifts.
- Test on slow networks and low-end mobile devices.
- Keep animations GPU-friendly where possible.
- Use progressive enhancement and provide a usable fallback.
- Check keyboard access, screen-reader behavior, contrast, and focus visibility.
- Check loading, empty, error, offline, permission, and destructive-action states.

### Performance targets

Use these targets where technically applicable:

- Aim for INP below 200 ms on representative devices.
- Avoid layout shifts caused by images, fonts, dialogs, or late-loaded content.
- Reserve dimensions for media before it loads.
- Keep initial JavaScript and animation work as small as reasonably possible.
- Do not add a dependency when the existing stack or platform APIs can solve the problem.
- Prefer CSS transforms and opacity for animated visual effects.
- Do not use WebGL, video backgrounds, large 3D assets, or continuous effects without documenting their product value and fallback.

### Acceptance criteria

A frontend task is not complete until:

- The primary user task is obvious within the first few seconds.
- The page has designed loading, empty, error, success, disabled, and permission states where relevant.
- No essential information depends on hover, animation, color, or JavaScript.
- All interactive elements have visible focus states.
- Forms have labels, instructions, validation, and recovery guidance.
- The layout remains usable at mobile, tablet, desktop, zoomed, and narrow-width conditions.
- Reduced-motion users receive an equivalent, understandable experience.
- No console errors, broken links, missing keys, or unnecessary duplicated components remain.
- Images and media do not cause avoidable layout shifts.
- The final result is visually coherent with the existing EpiCare design system.

### Design review standard

Before finalizing a page, ask:

1. Does this feel distinctively like EpiCare?
2. Is the visual concept memorable without harming usability?
3. Does every animation communicate something?
4. Can a user complete the main task without waiting for animation?
5. Does the interface work with keyboard, screen reader, touch, reduced motion, and slow internet?
6. Are the most important medical actions visually clear?
7. Are the loading, empty, error, and success states designed?
8. Is the design original rather than a copy of social-media inspiration?
9. Is the implementation modular and maintainable?
10. Would this still look excellent six months from now?

When requirements conflict, prioritize in this order:

1. Patient safety and correctness.
2. Accessibility and comprehension.
3. Performance and reliability.
4. Usability and task completion.
5. Visual originality and delight.
