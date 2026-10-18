"""Author original retro blaster effects inspired by Undertale's sound direction.
No game samples are included. Requires NumPy, SciPy and ffmpeg to regenerate.
The already-generated OGG files are bundled; normal pack builds need no audio tools.
"""
from pathlib import Path
import math,subprocess,wave
import numpy as np
from scipy import signal
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'RP/sounds/pinene_sans'
TEMP=ROOT/'dist/authored_audio'
RATE=22050
rng=np.random.default_rng(11062026)

def phase(freq):return np.cumsum(freq)*2*np.pi/RATE

def finish(name,a):
    # Deliberate low-resolution texture, with click-free boundaries.
    a=np.repeat(a[::2],2)[:len(a)]
    a=np.round(np.tanh(a*1.45)*47)/47
    edge=min(100,len(a)//2)
    a[:edge]*=np.linspace(0,1,edge);a[-edge:]*=np.linspace(1,0,edge)
    a*=.78/max(1e-9,float(np.abs(a).max()))
    TEMP.mkdir(parents=True,exist_ok=True);OUT.mkdir(parents=True,exist_ok=True)
    wav=TEMP/(name+'.wav')
    with wave.open(str(wav),'wb') as f:
        f.setnchannels(1);f.setsampwidth(2);f.setframerate(RATE)
        f.writeframes((a*32767).astype('<i2').tobytes())
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(wav),
                    '-c:a','libvorbis','-q:a','5',str(OUT/(name+'.ogg'))],check=True)
    print(name,round(len(a)/RATE,3),'seconds')

t=np.arange(round(.62*RATE))/RATE;u=t/.62
f=520+1400*np.exp(-13*t)+1250*u*u
p=phase(f*(1+.012*np.sin(2*np.pi*31*t)))
carrier=.55*np.sin(p+2.8*np.sin(p*.502))+.28*signal.sawtooth(p,width=.34)+.12*np.sin(p*2.003)
env=(1-np.exp(-t*500))*(1-u)**.48*(.78+.22*np.sin(2*np.pi*18*t)**2)
a=carrier*env
shift=round(.024*RATE);a[shift:]+=.24*a[:-shift]
finish('blaster_charge',a)

t=np.arange(round(.86*RATE))/RATE
p=phase(58+235*np.exp(-t*18)+25*np.exp(-t*3))
buzz=.55*signal.sawtooth(p,width=.17)+.27*np.sin(p*.5)+.22*np.sin(p+3.3*np.sin(2.001*p))
noise=rng.standard_normal(len(t))
noise=signal.sosfilt(signal.butter(2,[180,3600],btype='bandpass',fs=RATE,output='sos'),noise)
rasp=(.4+.6*np.abs(np.sin(2*np.pi*36*t)))
a=buzz*rasp+noise*(.7*np.exp(-t*16)+.16)
collapse=np.clip((t-.4)/.4,0,1);env=(1-np.exp(-t*1100))*(1-collapse*collapse*(3-2*collapse))
# Short, soft residual tail after the beam has narrowed away.
tail=.055*np.exp(-np.maximum(t-.8,0)*65)*(t>=.8)
a*=env+tail
finish('blaster_fire',a)

t=np.arange(round(.09*RATE))/RATE
p=phase(1400-650*t/.09)
a=(.7*signal.square(p)+.2*rng.standard_normal(len(t)))*(1-t/.09)**1.7*(.5+.5*signal.square(2*np.pi*65*t))
finish('karma_hit',a)
