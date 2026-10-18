"""Extract supplied reference blaster SFX, preserving pitch and speed.
Normal builds reuse bundled OGG. The authored karma_hit is unchanged.
"""
from pathlib import Path
import argparse, array, subprocess, sys, wave
ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--reference', required=True, type=Path)
args = parser.parse_args()
with wave.open(str(args.reference), 'rb') as source:
    assert source.getnchannels() == 1 and source.getsampwidth() == 2, 'Expected mono PCM16 WAV'
    rate = source.getframerate()
    samples = array.array('h', source.readframes(source.getnframes()))
if sys.byteorder != 'little': samples.byteswap()
for name, start, end in [('blaster_charge', 1.140, 2.180), ('blaster_fire', 2.200, 4.120)]:
    clip = samples[round(start * rate):round(end * rate)]
    edge = round(.002 * rate)
    for i in range(edge):
        clip[i] = round(clip[i] * i / (edge - 1))
        clip[-1-i] = round(clip[-1-i] * i / (edge - 1))
    wav = ROOT / 'dist/authored_audio' / (name + '.wav')
    ogg = ROOT / 'RP/sounds/pinene_sans' / (name + '.ogg')
    wav.parent.mkdir(parents=True, exist_ok=True)
    ogg.parent.mkdir(parents=True, exist_ok=True)
    if sys.byteorder != 'little': clip.byteswap()
    with wave.open(str(wav), 'wb') as target:
        target.setparams((1, 2, rate, len(clip), 'NONE', 'not compressed'))
        target.writeframes(clip.tobytes())
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav),
                    '-c:a', 'libvorbis', '-q:a', '7', str(ogg)], check=True)
    print(name, len(clip) / rate, 'seconds, original pitch')
