"""Update scripts/entities only in the disposable FINAL validation world while closed."""
from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parents[2]
users=Path.home()/'AppData/Roaming/Minecraft Bedrock/Users'
matches=[f.parent for f in users.glob('*/games/com.mojang/minecraftWorlds/*/levelname.txt') if f.read_text(encoding='utf-8').strip()=='Zombie Gear FINAL isolated validation']
assert len(matches)==1, matches
bp=matches[0]/'behavior_packs/zombiegear_final_test'
source=ROOT/'behavior_packs/bp_09_7c8ac348-47ad-4f71-8503-dc40a6f813f1'
for name in ['scripts','entities']:shutil.copytree(source/name,bp/name,dirs_exist_ok=True)
main=bp/'scripts/main.js'
main.write_text(main.read_text(encoding='utf-8')+'\nexport { corruption, revives, tryRevive, setScore, SCORE, forceMaxHpState, syncStrengthBoost, knockback };\nimport "./engine-smoke.js";\n',encoding='utf-8')
shutil.copyfile(ROOT/'tools/zombie_gear_v4/engine-final-smoke.js',bp/'scripts/engine-smoke.js')
print(bp)
