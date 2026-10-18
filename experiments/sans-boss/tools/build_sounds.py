"""Author original retro blaster effects inspired by Undertale's sound direction.
No game samples are included. Requires NumPy, SciPy and ffmpeg to regenerate.
The already-generated OGG files are bundled; normal pack builds need no audio tools.
"""
from pathlib import Path
import math,subprocess,wave,sys
import numpy as np
from scipy import signal
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'RP/sounds/pinene_sans'
TEMP=ROOT/'dist/authored_audio'
RATE=22050
rng=np.random.default_rng(11062026)
SELECT=set(sys.argv[1:])

def phase(freq):return np.cumsum(freq)*2*np.pi/RATE

def finish(name,a):
    if SELECT and name not in SELECT:return
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

# Reference-informed growl: two low voices and a rising/falling formant,
# rather than a clean bass sine or a bright generic laser chirp.
t=np.arange(round(.96*RATE))/RATE;u=t/.96
p1=phase(108+23*u+2*np.sin(2*np.pi*13*t))
p2=phase(184+13*u+3*np.sin(2*np.pi*9*t))
center=200+1350*np.exp(-((u-.56)/.20)**2)
a=np.zeros_like(t)
for k in range(1,22):
    freq=k*(108+23*u)
    formant=np.exp(-.5*((freq-center)/(150+.20*center))**2)
    weight=.24/k+.28*formant/(k**.25)
    a+=weight*np.sin(k*p1+.22*np.sin(2*np.pi*(19+k)*t))
for k in range(1,12):
    a+=(.13/k)*np.sin(k*p2+.3*np.sin(2*np.pi*17*t))
noise=rng.standard_normal(len(t))
noise=signal.sosfilt(signal.butter(2,[180,4800],btype='bandpass',fs=RATE,output='sos'),noise)
a+=noise*.12
attack=(1-np.exp(-t*170))
env=attack*(1-u)**.82*(1+.32*np.exp(-((u-.15)/.12)**2))
a*=env*(.85+.15*np.sin(2*np.pi*21*t)**2)
finish('blaster_charge',a)

# Stable low resonances and rough broadband bite, with a decaying blast tail.
t=np.arange(round(.86*RATE))/RATE
p1=phase(113+21*np.exp(-t*32))
p2=phase(145+9*np.exp(-t*18))
buzz=.46*signal.sawtooth(p1,width=.31)+.26*signal.sawtooth(p2,width=.61)+.27*np.sin(2*np.pi*78*t)
noise=rng.standard_normal(len(t))
noise=signal.sosfilt(signal.butter(2,[110,5000],btype='bandpass',fs=RATE,output='sos'),noise)
rasp=.70+.30*np.sin(2*np.pi*41*t+1.3*np.sin(2*np.pi*12*t))
a=buzz*rasp+noise*(.47*np.exp(-t*9)+.22)
collapse=np.clip((t-.4)/.4,0,1)
env=(1-np.exp(-t*1100))*(.8*np.exp(-t*1.8)+.2)*(1-collapse*collapse*(3-2*collapse))
tail=.04*np.exp(-np.maximum(t-.8,0)*65)*(t>=.8)
a*=env+tail
finish('blaster_fire',a)

rng=np.random.default_rng(11062027)
t=np.arange(round(.09*RATE))/RATE
p=phase(1400-650*t/.09)
a=(.7*signal.square(p)+.2*rng.standard_normal(len(t)))*(1-t/.09)**1.7*(.5+.5*signal.square(2*np.pi*65*t))
finish('karma_hit',a)
