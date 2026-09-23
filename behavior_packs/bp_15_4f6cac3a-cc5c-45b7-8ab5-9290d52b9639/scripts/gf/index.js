import { installCombatFeedback } from "./feedback/CombatFeedback.js";
import { PendingActivations } from "./effects/PendingActivations.js";
import { world, system, EntityDamageCause, ItemStack } from "@minecraft/server";
import { ActionFormData } from "@minecraft/server-ui";
import { registry, collection, grantCard } from "./api.js";
import { createCollectionMenu } from "./ui/CollectionMenu.js";
export { registry, collection, grantCard };
import { DeckManager } from "./deck/DeckManager.js";
import { CombatResolver } from "./combat/CombatResolver.js";
import { createCardMenu } from "./ui/CardMenu.js";
import { FormSessions } from "./ui/FormSessions.js";
import { CaseActions } from "./ui/CaseActions.js";
import { createCaseMenu } from "./ui/CaseMenu.js";
import { installRuntime } from "./Runtime.js";

export const decks = new DeckManager(registry, undefined, undefined, collection);
export const feedback = installCombatFeedback(world, system, EntityDamageCause.magic);
export const combat = new CombatResolver(decks, (target, damage, source, context) => feedback.apply(target, damage, source, context), feedback);
const sessions = new FormSessions();
export const activations = new PendingActivations(decks, combat, sessions, system);
export const actions = new CaseActions(decks, combat, sessions, activations);
const menu = createCardMenu(decks, combat, actions, sessions);
const collectionMenus = createCollectionMenu(decks, collection, sessions, () => new ActionFormData());
const cases = createCaseMenu(decks, actions, sessions, () => new ActionFormData(), collectionMenus);
installRuntime({
  world, system, decks, sessions, menu, cases, activations, grantCard,
  createItem: (id, count) => new ItemStack(id, count),
});
