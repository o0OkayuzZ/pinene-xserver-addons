"""Build the user-selected 00:21 gravity cue and a separate impact effect."""
from pathlib import Path
import argparse,subprocess
p=argparse.ArgumentParser();p.add_argument('--gravity-reference',required=True,type=Path);p.add_argument('--impact-reference',required=True,type=Path);args=p.parse_args()
out=Path(__file__).resolve().parents[1]/'RP/sounds/pinene_sans'
subprocess.run(['ffmpeg','-v','error','-y','-ss','21.135','-i',str(args.gravity_reference),'-t','0.5','-af','afade=t=in:d=0.002,afade=t=out:st=0.48:d=0.02','-c:a','libvorbis','-q:a','7',str(out/'gravity_cue.ogg')],check=True)
subprocess.run(['ffmpeg','-v','error','-y','-i',str(args.impact_reference),'-af','volume=0.5,afade=t=in:d=0.002','-c:a','libvorbis','-q:a','7',str(out/'slam_impact.ogg')],check=True)
