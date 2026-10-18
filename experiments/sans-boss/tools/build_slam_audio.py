"""Convert the documented reference WAV effects without pitch changes."""
from pathlib import Path
import argparse,subprocess
p=argparse.ArgumentParser();p.add_argument('--source-dir',required=True,type=Path);args=p.parse_args()
out=Path(__file__).resolve().parents[1]/'RP/sounds/pinene_sans'
for src,dest,filters in [('snd_ding.wav','gravity_cue','afade=t=in:d=0.002,afade=t=out:st=0.46:d=0.011'),('snd_impact.wav','slam_impact','volume=0.5,afade=t=in:d=0.002')]:
 subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(args.source_dir/src),'-af',filters,'-c:a','libvorbis','-q:a','7',str(out/(dest+'.ogg'))],check=True)
