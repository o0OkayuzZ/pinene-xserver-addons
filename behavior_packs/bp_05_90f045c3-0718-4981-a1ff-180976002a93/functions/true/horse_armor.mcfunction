## Deathnerite
execute as @e[type=horse,hasitem={location=slot.armor, item=true_dn:deathnerite_horse_armor}] at @s run tag @s add true:deathnerite_horse_armor
execute as @e[type=horse] at @s unless entity @s[hasitem=[{location=slot.armor, item=true_dn:deathnerite_horse_armor}]] run tag @s remove true:deathnerite_horse_armor

execute as @e[type=horse,tag=true:deathnerite_horse_armor] at @s run replaceitem entity @s slot.weapon.offhand 0 true_dn:deathnerite_horse_armor
execute as @e[type=horse,tag=true:deathnerite_horse_armor] at @s run effect @s resistance 1 3 true

## Parcanite
execute as @e[type=horse,hasitem={location=slot.armor, item=true_dn:parcanite_horse_armor}] at @s run tag @s add true:parcanite_horse_armor
execute as @e[type=horse] at @s unless entity @s[hasitem=[{location=slot.armor, item=true_dn:parcanite_horse_armor}]] run tag @s remove true:parcanite_horse_armor

execute as @e[type=horse,tag=true:parcanite_horse_armor] at @s run replaceitem entity @s slot.weapon.offhand 0 true_dn:parcanite_horse_armor
execute as @e[type=horse,tag=true:parcanite_horse_armor] at @s run effect @s resistance 1 3 true

execute as @e[type=horse] at @s unless entity @s[hasitem=[{location=slot.armor, item=true_dn:parcanite_horse_armor}]] unless entity @s[hasitem=[{location=slot.armor, item=true_dn:deathnerite_horse_armor}]] run replaceitem entity @s slot.weapon.offhand 0 air