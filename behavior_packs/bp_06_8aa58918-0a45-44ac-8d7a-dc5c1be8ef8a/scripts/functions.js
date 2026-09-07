import { world, EntityEquippableComponent, EquipmentSlot, ItemStack, system, EntityComponentTypes, ItemEnchantableComponent} from "@minecraft/server";
import { ModalFormData, ActionFormData } from "@minecraft/server-ui";
const w = world.getDimension("overworld");

export function getScore(player, objective) {
	return world.scoreboard.getObjective(objective).getScore(player) ?? 0;
}

export function hitEvent(hit) {
	if(world.getDynamicProperty("spawn_bones")){
		hit.runCommandAsync("loot spawn ~~1~ loot tumba_loot")
	}
	addEffect(hit, "invisibility", 999999, 255, false)
	hit.triggerEvent('new:entity_death');
	hit.runCommandAsync("setblock ~~~ air")
	let random = Math.floor(Math.random()*100)+1;
	if(world.getDynamicProperty("spawn_zombie") && random > 90){
		hit.runCommandAsync("summon zombie ~~1~")
	}
}


export function playerKey(p, cords, dim) {
	try{
		let item;
		let random = Math.floor(Math.random()*100)+1;
		let lore = [
			`§r§bプレイヤー: §6${p.name}`, `§r§b座標: ${cords}`, `§r§bディメンション: §6${dim}`, ``, `§r§cこのアイテムは死亡時に失われません。§r`
			]
		if(world.getDynamicProperty("key_status") == 0){
			item = "new:key"
		}
		if(world.getDynamicProperty("key_status") == 1){
			if(random < random_default){
				item = "new:key2"
			}
			if(random >= random_default){
				item = "new:key"
			}
		}
		system.runTimeout(()=>{
			if(world.getDynamicProperty("show_cords_item") && !world.getDynamicProperty("lose_key")){
				addItem(p, item, true, "none", lore)
			}
			if(!world.getDynamicProperty("show_cords_item") && !world.getDynamicProperty("lose_key")){
				addItem(p, item, true, "none", [""])
				p.addTag(`:${cords}`)
			}
			if(world.getDynamicProperty("show_cords_item") && world.getDynamicProperty("lose_key")){
				addItem(p, item, false, "none", lore)
			}
			if(!world.getDynamicProperty("show_cords_item") && world.getDynamicProperty("lose_key")){
				addItem(p, item, false, "none", [""])
				p.addTag(`:${cords}`)
			}
		}, 2)
	}
	catch(e){

	}
}

export function addItem(player, itemStack, keepOnDeath, lockMode, lore){
	let container = player.getComponent("inventory").container;
	let item = new ItemStack(itemStack);
	item.keepOnDeath = keepOnDeath
	item.lockMode = lockMode;
	item.setLore(lore);
	container.addItem(item);
}
const colorNameChoice = ["§fデフォルト", "§c赤", "§e黄", "§7灰", "§bシアン", "§d紫", "§9青", "§a緑", "§6金", "§4濃い赤", "§3濃いシアン", "§5濃い紫", "§1濃い青", "§2濃い緑", "§8濃い灰"];
export function colorName(p){
	const colorNameStatus = getScore(p, "colorNameStatus")
	const custom = new ModalFormData()
	.title({translate: "title.grave.color_name"})
	.dropdown({translate: "dropdown.grave.color_name"}, colorNameChoice, colorNameStatus)
	custom.show(p).then((response) => {
		if (response.canceled) return
			if (!response.canceled) {
				for(let i = 0; i <= 15; i++){
					if (response.formValues[0] === i) {
						p.runCommandAsync(`scoreboard players set @s colorNameStatus ${i}`)
						p.sendMessage({rawtext:[{translate: "responce.grave.color_name"},{text: ` ${colorNameChoice[i]}`}]})
					}
				}
			}
	})
}

export function visualTombsConfig(p){
	const custom = new ActionFormData()
	.title({translate: "title.grave.visual_config"})
	.button({translate: "button.grave.model_config"})
	.button({translate: "button.grave.color_name"})
	custom.show(p).then((response) => {
		if (response.canceled) return
			if (!response.canceled) {
				if (response.selection == 0) {
					modelTombsConfig(p)
				}
				if (response.selection == 1) {
					colorName(p)
				}
			}
	})
}

export function modelTombsConfig(p){
	const custom = new ActionFormData()
	.title({translate: "title.grave.model_config"})
	.button({translate: "button.grave.random_model"})
	for (let i = 1; i <= 17; i++) {
		custom.button({rawtext:[{translate: "button.grave.model_select"},{text: ` ${i}`}]}, `textures/models_img/tomb_${i}`);
	}
	custom.show(p).then((response) => {
        if (response.canceled) {
            return;
        }
		if (response.selection == 0) {
			p.runCommandAsync(`scoreboard players set @s modelTombs 0`)
			p.sendMessage({rawtext:[{translate: "responce.grave.random_model"}]})
		}
        for(let r = 1; r <= 17; r++){
			if (response.selection == r) {
				p.runCommandAsync(`scoreboard players set @s modelTombs ${r}`)
				p.sendMessage({rawtext:[{translate: "responce.grave.model"},{text: ` ${r}`}]})
			}
		}
    });
}

export function config(p){ 
	const custom = new ModalFormData()
	.title({translate: "title.grave.config"})
	.dropdown("鍵の種類", ["通常の鍵", "ランダムな鍵"], key_status)
	.toggle({translate: "options.config.owner"}, owner_restriction)
	.toggle({translate: "options.config.name"}, tombs_name)
	.toggle({translate: "options.config.show_chat"}, show_cords_chat)
	.toggle({translate: "options.config.show_key"}, show_cords_item)
	.toggle({translate: "options.config.lose"}, lose_key)
	.toggle({translate: "options.config.inv"}, empty_inv)
	.toggle({translate: "options.config.zombie"}, spawn_zombie)
	.toggle({translate: "options.config.bones"}, spawn_bones)
	custom.show(p).then((response) => {
		if (response.canceled) return
			if (!response.canceled) {

				if (response.formValues[0] === 0) {
					world.setDynamicProperty("key_status", 0)
					key_status = true
				}
				if (response.formValues[0] === 1) {
					world.setDynamicProperty("key_status", 1)
					key_status = false
				} 

				if (response.formValues[1] === true) {
					world.setDynamicProperty("owner_restriction", true)
					owner_restriction = true
				} 
				if (response.formValues[2] === true) {
					world.setDynamicProperty("tombs_name", true)
					tombs_name = true
				}
				if (response.formValues[3] === true) {
					world.setDynamicProperty("show_cords_chat", true)
					show_cords_chat = true
				}
				if (response.formValues[4] === true) {
					world.setDynamicProperty("show_cords_item", true)
					show_cords_item = true
				}
				if (response.formValues[5] === true) {
					world.setDynamicProperty("lose_key", true)
					lose_key = true
				}
				if (response.formValues[6] === true) {
					world.setDynamicProperty("empty_inv", true)
					empty_inv = true
				}
				if (response.formValues[7] === true) {
					world.setDynamicProperty("spawn_zombie", true)
					spawn_zombie = true
				}
				if (response.formValues[8] === true) {
					world.setDynamicProperty("spawn_bones", true)
					spawn_bones = true
				}




				
				
				if (response.formValues[1] === false) {
					world.setDynamicProperty("owner_restriction", false)
					owner_restriction = false
				} 
				if (response.formValues[2] === false) {
					world.setDynamicProperty("tombs_name", false)
					tombs_name = false
				}
				if (response.formValues[3] === false) {
					world.setDynamicProperty("show_cords_chat", false)
					show_cords_chat = false
				}
				if (response.formValues[4] === false) {
					world.setDynamicProperty("show_cords_item", false)
					show_cords_item = false
				}
				if (response.formValues[5] === false) {
					world.setDynamicProperty("lose_key", false)
					lose_key = false
				}
				if (response.formValues[6] === false) {
					world.setDynamicProperty("empty_inv", false)
					empty_inv = false
				}
				if (response.formValues[7] === false) {
					world.setDynamicProperty("spawn_zombie", false)
					spawn_zombie = false
				}
				if (response.formValues[8] === false) {
					world.setDynamicProperty("spawn_bones", false)
					spawn_bones = false
				}

				p.sendMessage("§a設定を保存しました")
			}
		});
}

export function getColorCode(p) {
	const colorCodes = [
		"§f", // Default
		"§c", // Red
		"§e", // Yellow
		"§7", // Grey
		"§b", // Cyan
		"§d", // Purple
		"§9", // Blue
		"§a", // Green
		"§6", // Orange
		"§4", // Dark Red
		"§3", // Dark Cyan
		"§5", // Dark Purple
		"§1", // Dark Blue
		"§2", // Dark Green
		"§8"  // Dark Grey
	];
	const colorNameStatus = getScore(p, "colorNameStatus");
	return colorCodes[colorNameStatus];
}


export function dead_event(p) {
	const location = {
		x: Math.floor(p.location.x),
		y: Math.floor(p.location.y),
		z: Math.floor(p.location.z)
	}
	const tumba = p.dimension.spawnEntity('new:tumba', location);
	allTransf(p, tumba)
	const modelTombsScore = getScore(p, "modelTombs");
	if(modelTombsScore==0){
		tumba.triggerEvent(`minecraft:entity_spawned`)
	}
	if(modelTombsScore>0){
		tumba.triggerEvent(`tombs_event`)
		tumba.triggerEvent(`set_var${modelTombsScore-1}`)
	}
	if(world.getDynamicProperty("show_cords_chat")){
		p.runCommandAsync(`tellraw @s {"rawtext":[{"translate":"action.players.death"},{"text": "§bx: §6${Math.floor(p.location.x)} §by: §6${Math.floor(p.location.y)} §bz: §6${Math.floor(p.location.z)} in §7${p.dimension.id}"}]}`)
	}
	const getColor = getColorCode(p)
	if(world.getDynamicProperty("tombs_name")){
		tumba.nameTag = `${getColor}${p.name}`;
	}
	if(world.getDynamicProperty("tombs_name") == false){
		tumba.addTag(`${p.name}`);
	}
	p.addTag(`cords:§6${Math.floor(p.location.x)} ${Math.floor(p.location.y)} ${Math.floor(p.location.z)}`);
	p.addTag(`dim:${p.dimension.id}`)
	p.addTag("dead");
}

function mustBeOmitted(item) {
  if (item.keepOnDeath) return true;
  const enchantable = item.getComponent(
    ItemEnchantableComponent.componentId
  );
  if (enchantable?.getEnchantment("vanishing")) return true;
  return false;
}
function tryToAddToInventory(destiny, item) {
  const invDestiny = destiny.getComponent(
    EntityComponentTypes.Inventory
  );
  if (!invDestiny?.container) return false;
  try {
    const spare = invDestiny.container.addItem(item);
    return !spare;
  } catch {
    return false;
  }
}
function transEquipmentSlot(origin, destiny, slot) {
  const eqOrigin = origin.getComponent(
    EntityComponentTypes.Equippable
  );
  if (!eqOrigin) return false;
  let originSlot;
  try {
    originSlot = eqOrigin.getEquipmentSlot(slot);
  } catch {
    return false;
  }
  if (!originSlot?.isValid || !originSlot.hasItem()) return false;
  const item = originSlot.getItem();
  if (!item) return false;
  if (mustBeOmitted(item)) return false;
  const eqdestiny = destiny.getComponent(
    EntityComponentTypes.Equippable
  );
  if (eqdestiny) {
    try {
      const destinySlot = eqdestiny.getEquipmentSlot(slot);
      if (destinySlot?.isValid && !destinySlot.hasItem()) {
        destinySlot.setItem(item);
        originSlot.setItem();
        return true;
      }
    } catch {
    }
  }
  if (tryToAddToInventory(destiny, item)) {
    originSlot.setItem();
    return true;
  }
  return false;
}
function transfNormalInv(origin, destiny) {
  const invOrigin = origin.getComponent(
    EntityComponentTypes.Inventory
  );
  const invDestiny = destiny.getComponent(
    EntityComponentTypes.Inventory
  );
  if (!invOrigin?.container || !invDestiny?.container) return 0;
  const contOrigin = invOrigin.container;
  let movidos = 0;
  for (let i = 0; i < contOrigin.size; i++) {
    const item = contOrigin.getItem(i);
    if (!item) continue;
    if (mustBeOmitted(item)) continue;
    try {
      const spare = invDestiny.container.addItem(item);
      if (!spare) {
        contOrigin.setItem(i);
        movidos++;
      } else if (spare.amount < item.amount) {
        contOrigin.setItem(i, spare);
        movidos++;
      }
    } catch {
    }
  }
  return movidos;
}
export function allTransf(origin, destiny) {
  let total = 0;
  total += transfNormalInv(origin, destiny);
  const equipmentSlots = [
    EquipmentSlot.Head,
    EquipmentSlot.Chest,
    EquipmentSlot.Legs,
    EquipmentSlot.Feet,
    EquipmentSlot.Offhand,
  ];
  for (const slot of equipmentSlots) {
    if (transEquipmentSlot(origin, destiny, slot)) {
      total++;
    }
  }
  return total;
}

export function setScore(player, objective, score) {
	return world.scoreboard.getObjective(objective).setScore(player, score) ?? 0;
}
export function addScore(player, objective, score) {
	return world.scoreboard.getObjective(objective).addScore(player, score) ?? 0;
}


export function addEffect(player, effectType, duration, level, particles) {
	return player.addEffect(effectType, duration*2, {amplifier: level, showParticles: particles}) ?? 0;
}
export function removeEffect(player, effectType) {
	return player.removeEffect(effectType) ?? 0;
}

export function config_default(p){
	if(world.getDynamicProperty("key_status")){
		key_status = true
	}
	if(!world.getDynamicProperty("key_status")){
		key_status = false
	}
	if(world.getDynamicProperty("owner_restriction")){
		owner_restriction = true
	}
	if(!world.getDynamicProperty("owner_restriction")){
		owner_restriction = false
	}
	if(world.getDynamicProperty("show_cords_item")){
		show_cords_item = true
	}
	if(!world.getDynamicProperty("show_cords_item")){
		show_cords_item = false
	}
	if(world.getDynamicProperty("show_cords_chat")){
		show_cords_chat = true
	}
	if(!world.getDynamicProperty("show_cords_chat")){
		show_cords_chat = false
	}
	if(world.getDynamicProperty("lose_key")){
		lose_key = true
	}
	if(!world.getDynamicProperty("lose_key")){
		lose_key = false
	}
	if(world.getDynamicProperty("tombs_name")){
		tombs_name = true
	}
	if(!world.getDynamicProperty("tombs_name")){
		tombs_name = false
	}
	if(world.getDynamicProperty("empty_inv")){
		empty_inv = true
	}
	if(!world.getDynamicProperty("empty_inv")){
		empty_inv = false
	}
	if(world.getDynamicProperty("spawn_zombie")){
		spawn_zombie = true
	}
	if(!world.getDynamicProperty("spawn_zombie")){
		spawn_zombie = false
	}
	if(world.getDynamicProperty("spawn_bones")){
		spawn_bones = true
	}
	if(!world.getDynamicProperty("spawn_bones")){
		spawn_bones = false
	}
}

export function getEquip(p) {
	const equip = p.getComponent(EntityEquippableComponent.componentId);
	let head = equip?.getEquipment(EquipmentSlot.Head);
	let chest = equip?.getEquipment(EquipmentSlot.Chest);
	let legs = equip?.getEquipment(EquipmentSlot.Legs);
	let feet = equip?.getEquipment(EquipmentSlot.Feet);
	let off = equip?.getEquipment(EquipmentSlot.Offhand);
	const inventory = p.getComponent("minecraft:inventory");
	if (!equip || !inventory?.container) return;
	let inv = inventory.container;
	const healthComponent = p.getComponent("minecraft:health");
	if (!healthComponent) return;
	let health = healthComponent.currentValue
	if(head){
		p.addTag("getHead")
	}
	if(head == undefined && health > 0){
		p.removeTag("getHead")
	}

	if(chest){
		p.addTag("getChest")
	}
	if(chest == undefined && health > 0){
		p.removeTag("getChest")
	}

	if(legs){
		p.addTag("getLegs")
	}
	if(legs == undefined && health > 0){
		p.removeTag("getLegs")
	}

	if(feet){
		p.addTag("getFeet")
	}
	if(feet == undefined && health > 0){
		p.removeTag("getFeet")
	}
	if(off){
		p.addTag("getOff")
	}
	if(off == undefined && health > 0){
		p.removeTag("getOff")
	}

	if(inv.emptySlotsCount < 36){
		p.removeTag("empty")
	}
	if(inv.emptySlotsCount >= 36 && health > 0){
		p.addTag("empty")
	}
}

let show_cords_chat = true;
let show_cords_item = true;
let owner_restriction = true;
let tombs_name = true;
let lose_key = false;
let key_status = 0;
let random_default = 90;
let empty_inv = true;
let spawn_zombie = false;
let spawn_bones = false;
