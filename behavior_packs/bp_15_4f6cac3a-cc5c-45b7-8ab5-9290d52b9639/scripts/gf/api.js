// Same-pack acquisition API: importing this module does not install runtime/event handlers.
import { CardRegistry } from "./core/CardRegistry.js";
import { CardCollection } from "./collection/CardCollection.js";
import { createOwnershipApi } from "./collection/OwnershipApi.js";
export const registry = new CardRegistry();
export const collection = new CardCollection(registry);
export const { grantCard } = createOwnershipApi(collection);
