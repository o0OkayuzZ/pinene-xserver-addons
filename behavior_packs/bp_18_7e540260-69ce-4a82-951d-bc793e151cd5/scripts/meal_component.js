import { system } from '@minecraft/server';
import { MEALS } from './meal_catalog.generated.js';
import { applyMealEffects } from './meal_effects.js';

// onConsume runs after the item is actually eaten, not when use begins.
// See Microsoft Learn: Building with Custom Components (format 1.21.90).
system.beforeEvents.startup.subscribe(({ itemComponentRegistry }) => {
  itemComponentRegistry.registerCustomComponent('pine:meal_effects', {
    onConsume({ source, itemStack }) {
      try {
        const result = applyMealEffects(source, MEALS[itemStack?.typeId]);
        if (result.status === 'cooldown') {
          source.onScreenDisplay?.setActionBar(`食事効果の再発動まで ${result.remainingSeconds}秒`);
        }
        if (result.failed?.length) console.warn('[PineFood] meal effect failed: ' + result.failed.join(','));
      } catch (error) {
        console.warn('[PineFood] meal consumption: ' + String(error));
      }
    }
  });
});
