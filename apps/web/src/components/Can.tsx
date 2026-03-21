'use client';

import { createContext } from 'react';
import { createContextualCan } from '@casl/react';
import type { AppAbility } from '@twicely/casl/types';

// Context for providing ability to the component tree
export const AbilityContext = createContext<AppAbility>(undefined!);

// Contextual Can component for UI permission gating
export const Can = createContextualCan(AbilityContext.Consumer);
