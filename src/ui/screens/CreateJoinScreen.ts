// src/ui/screens/CreateJoinScreen.ts

// Conceptual screen: Create or Join a room.
// No rendering framework assumed.
// No side effects.

export type CreateJoinViewModel = {
  canCreate: boolean;
  canJoin: boolean;
  joinCode?: string;
};

export function createCreateJoinViewModel(): CreateJoinViewModel {
  return {
    canCreate: true,
    canJoin: true,
  };
}
