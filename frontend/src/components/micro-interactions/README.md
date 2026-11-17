# Micro-interactions Cyphera

Dependencies are installed in the frontend workspace:

```sh
npm install framer-motion react-confetti --workspace @agri/frontend
```

To mount the interactive example in `frontend/src/app/page.tsx`:

```tsx
import MicroInteractionsExample from "../components/micro-interactions/MicroInteractionsExample";

export default function Page() {
  return <MicroInteractionsExample />;
}
```

The existing dashboard page has not been replaced. You can render the example
inside an existing page instead, or import each component separately.

```tsx
"use client";

import { useState } from "react";
import AnimatedTank from "../components/micro-interactions/AnimatedTank";
import AIScanner from "../components/micro-interactions/AIScanner";
import TaskCheckbox from "../components/micro-interactions/TaskCheckbox";

export default function Page() {
  const [done, setDone] = useState(false);
  const [loading] = useState(false); // Replace with your actual API loading state.

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <AnimatedTank fillPercentage={75} />
      {loading && <AIScanner />}
      <TaskCheckbox label="Pemeriksaan lahan selesai"
        checked={done} onCheckedChange={setDone} />
    </div>
  );
}
```

- `AnimatedTank`: clamps finite values to 0–100; invalid numbers become 0.
  Uses transform animation and exposes a labeled ARIA meter.
- `AIScanner`: `active` controls the loop. Accepts an optional image as children.
  It is a loading visual only, not an AI API integration. Unmount or deactivate
  when loading ends or the containing panel is hidden.
- `TaskCheckbox`: controlled checkbox supporting native button keyboard events.
  Persist the requested change before updating `checked` if saving can fail.
  Initial checked tasks do not celebrate. Confetti is rendered in a body portal
  without capturing clicks and is removed after three seconds; timers and resize
  listeners are cleaned up. It is dynamically imported on demand.
- All three respect reduced-motion preferences; confetti is omitted and the
  scanner becomes stationary when reduced motion is enabled.

References: [Motion accessibility](https://motion.dev/docs/react-accessibility),
[react-confetti](https://www.npmjs.com/package/react-confetti).
