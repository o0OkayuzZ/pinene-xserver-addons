"""Author a short, dry retro bone emergence effect without noise samples."""
from pathlib import Path
import math, struct, wave, subprocess
root=Path(__file__).resolve().parents[1]
rate=48000;duration=.085;samples=[];phase=0
for i in range(round(rate*duration)):
    t=i/rate
    # Fast upward chip followed by a low, hollow knock; no random noise.
    frequency=310+620*min(1,t/.018)*math.exp(-t/ .045)
    phase+=2*math.pi*frequency/rate
    chip=sum(math.sin(n*phase)/n**2 for n in [1,3,5,7])
    knock=math.sin(2*math.pi*175*t)*math.exp(-t/.014)
    envelope=min(1,t/.0015)*math.exp(-t/.022)*min(1,(duration-t)/.008)
    samples.append((.72*chip+.28*knock)*envelope*.48)
wav=root/'dist/authored_audio/bone_emerge.wav';wav.parent.mkdir(parents=True,exist_ok=True)
with wave.open(str(wav),'wb') as f:
    f.setparams((1,2,rate,len(samples),'NONE','not compressed'))
    f.writeframes(b''.join(struct.pack('<h',round(x*32767)) for x in samples))
subprocess.run(['ffmpeg','-y','-v','error','-i',str(wav),'-c:a','libvorbis','-q:a','7',str(root/'RP/sounds/pinene_sans/bone_emerge.ogg')],check=True)
print('bone_emerge',duration,'seconds; authored tonal SFX')
